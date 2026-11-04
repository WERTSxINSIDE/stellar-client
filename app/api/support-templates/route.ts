import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query, queryAll, queryOne } from "@/lib/db";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";
import { logAdminAction } from "@/lib/audit";
import { normalizeSupportCategory } from "@/lib/support";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: "Не авторизован" }, { status: 401 }) };
  if (!(user.is_admin || user.role === "admin")) {
    return { error: NextResponse.json({ error: "Доступ запрещён" }, { status: 403 }) };
  }
  return { user };
}

export async function GET() {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;

    const templates = await queryAll(
      `SELECT id, title, body, category, created_at, updated_at
       FROM support_templates
       ORDER BY updated_at DESC, id DESC`
    );

    return NextResponse.json({ ok: true, templates });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;
    const user = auth.user;

    const limited = await enforceRateLimit(
      req,
      [
        { scope: "support-template:account", identifier: user.id, limit: 60, windowMs: 60 * 60_000 },
        { scope: "support-template:ip", identifier: getClientIp(req), limit: 120, windowMs: 60 * 60_000 },
      ],
      "Слишком много изменений шаблонов."
    );
    if (limited) return limited;

    const body = await req.json();
    const id = Number(body?.id || 0);
    const title = String(body?.title || "").trim();
    const text = String(body?.body || "").trim();
    const category = body?.category ? normalizeSupportCategory(body.category) : null;

    if (title.length < 2 || title.length > 80) {
      return NextResponse.json({ error: "Название шаблона: от 2 до 80 символов" }, { status: 400 });
    }
    if (text.length < 2 || text.length > 3000) {
      return NextResponse.json({ error: "Текст шаблона: от 2 до 3000 символов" }, { status: 400 });
    }

    let saved;
    if (id > 0) {
      saved = await queryOne(
        `UPDATE support_templates
         SET title = $1, body = $2, category = $3, updated_at = NOW()
         WHERE id = $4
         RETURNING id, title, body, category, created_at, updated_at`,
        [title, text, category, id]
      );
      if (!saved) return NextResponse.json({ error: "Шаблон не найден" }, { status: 404 });
    } else {
      saved = await queryOne(
        `INSERT INTO support_templates (title, body, category, created_by)
         VALUES ($1, $2, $3, $4)
         RETURNING id, title, body, category, created_at, updated_at`,
        [title, text, category, user.id]
      );
    }

    await logAdminAction(user, id > 0 ? "support.template.update" : "support.template.create", null, title);
    return NextResponse.json({ ok: true, template: saved });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;

    const body = await req.json().catch(() => ({}));
    const id = Number(body?.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "Неверный шаблон" }, { status: 400 });
    }

    await query("DELETE FROM support_templates WHERE id = $1", [id]);
    await logAdminAction(auth.user, "support.template.delete", null, `Шаблон #${id}`);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
