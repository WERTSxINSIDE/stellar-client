import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { query, queryAll } from "@/lib/db";
import { logAdminAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });

    const promos = await queryAll(
      `SELECT id, code, amount, max_uses, used_count, active, expires_at, created_at
       FROM promo_codes
       ORDER BY created_at DESC
       LIMIT 200`
    );

    return NextResponse.json({ ok: true, promos });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const code = String(body.code || "").trim().toUpperCase();
    const amount = Math.round(Number(body.amount));
    const maxUses = Math.round(Number(body.max_uses ?? 0));

    if (!/^[A-Z0-9_-]{3,64}$/.test(code)) {
      return NextResponse.json({ error: "Код: 3–64 символа, латиница, цифры, - и _" }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount < 1 || amount > 100000) {
      return NextResponse.json({ error: "Сумма должна быть от 1 до 100 000 ₽" }, { status: 400 });
    }
    if (!Number.isFinite(maxUses) || maxUses < 0 || maxUses > 100000) {
      return NextResponse.json({ error: "Некорректный лимит активаций" }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO promo_codes (code, amount, max_uses)
       VALUES ($1, $2, $3)
       ON CONFLICT (code) DO NOTHING
       RETURNING id, code, amount, max_uses, used_count, active, expires_at, created_at`,
      [code, amount, maxUses]
    );

    if (!result.rows.length) {
      return NextResponse.json({ error: "Промокод с таким кодом уже существует" }, { status: 409 });
    }

    await logAdminAction(admin, "promo_create", null, `${code}: ${amount} ₽, лимит ${maxUses || "∞"}`);

    return NextResponse.json({ ok: true, promo: result.rows[0] });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const id = Number(body.id);
    if (!Number.isInteger(id) || id < 1) {
      return NextResponse.json({ error: "Некорректный промокод" }, { status: 400 });
    }

    const result = await query(
      "UPDATE promo_codes SET active = 0 WHERE id = $1 RETURNING code",
      [id]
    );
    if (!result.rows.length) {
      return NextResponse.json({ error: "Промокод не найден" }, { status: 404 });
    }

    await logAdminAction(admin, "promo_disable", null, String(result.rows[0].code));

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
