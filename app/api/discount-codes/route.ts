import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query, queryAll, queryOne } from "@/lib/db";
import { normalizeCode } from "@/lib/discounts";

export const dynamic = "force-dynamic";

/** Максимальная скидка по коду. */
const MAX_PERCENT = 70;
const MAX_CODES = 8;

type CodeRow = {
  id: number;
  kind: string;
  code: string;
  discount_percent: number;
  max_uses: number;
  used_count: number;
  clicks: number;
  signups: number;
  sales_count: number;
  sales_amount: number;
  active: number;
  expires_at: string | null;
  created_at: string;
};

function makeCode(username: string, kind: string) {
  const base = username
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8) || "STELLAR";
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return normalizeCode(`${kind === "partner" ? "P" : "A"}-${base}-${suffix}`);
}

/** Список кодов текущего автора/партнёра. */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const codes = (await queryAll(
      `SELECT id, kind, code, discount_percent, max_uses, used_count, clicks,
              signups, sales_count, sales_amount, active, expires_at, created_at
       FROM discount_codes
       WHERE owner_id = $1
       ORDER BY created_at DESC`,
      [user.id]
    )) as CodeRow[];

    const partnerApp = await queryOne(
      `SELECT platform FROM partner_applications
       WHERE user_id = $1 AND status = 'approved'
       ORDER BY created_at DESC LIMIT 1`,
      [user.id]
    );
    const items = await queryOne(
      "SELECT COUNT(*)::int AS count FROM showcase_items WHERE user_id = $1 AND status = 'approved'",
      [user.id]
    );

    const isPartner =
      !!partnerApp || ["media", "tester", "admin"].includes(String(user.role));

    return NextResponse.json({
      ok: true,
      codes,
      is_partner: isPartner,
      partner_platform: partnerApp?.platform ? String(partnerApp.platform) : null,
      can_author: Number(items?.count || 0) > 0,
      approved_items: Number(items?.count || 0),
    });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

/** Создаёт авторский купон или партнёрский код стримера. */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      kind?: unknown;
      code?: unknown;
      discount_percent?: unknown;
      max_uses?: unknown;
      expires_at?: unknown;
    };

    const kind = body.kind === "partner" ? "partner" : "author";

    if (kind === "author") {
      const items = await queryOne(
        "SELECT COUNT(*)::int AS count FROM showcase_items WHERE user_id = $1 AND status = 'approved'",
        [user.id]
      );
      if (Number(items?.count || 0) === 0) {
        return NextResponse.json(
          { error: "Купоны доступны авторам с одобренными конфигами" },
          { status: 403 }
        );
      }
    } else {
      const app = await queryOne(
        `SELECT 1 AS found FROM partner_applications
         WHERE user_id = $1 AND status = 'approved' LIMIT 1`,
        [user.id]
      );
      const privileged = ["media", "tester", "admin"].includes(String(user.role));
      if (!app && !privileged) {
        return NextResponse.json(
          { error: "Партнёрские коды доступны после одобрения партнёрской заявки" },
          { status: 403 }
        );
      }
    }

    const count = await queryOne(
      "SELECT COUNT(*)::int AS count FROM discount_codes WHERE owner_id = $1",
      [user.id]
    );
    if (Number(count?.count || 0) >= MAX_CODES) {
      return NextResponse.json({ error: `Максимум ${MAX_CODES} кодов` }, { status: 400 });
    }

    const percent = Math.max(
      1,
      Math.min(MAX_PERCENT, Math.floor(Number(body.discount_percent) || 10))
    );
    const maxUses = Math.max(0, Math.min(100000, Math.floor(Number(body.max_uses) || 0)));

    let code = normalizeCode(body.code);
    if (code && code.length < 3) {
      return NextResponse.json({ error: "Код от 3 до 24 символов" }, { status: 400 });
    }
    if (!code) code = makeCode(user.username, kind);

    const expiresRaw = String(body.expires_at || "").trim();
    let expiresAt: string | null = null;
    if (expiresRaw) {
      const date = new Date(expiresRaw);
      if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) {
        return NextResponse.json({ error: "Дата окончания должна быть в будущем" }, { status: 400 });
      }
      expiresAt = date.toISOString();
    }

    try {
      const inserted = (await query(
        `INSERT INTO discount_codes
           (owner_id, kind, code, discount_percent, max_uses, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, kind, code, discount_percent, max_uses, used_count, clicks,
                   signups, sales_count, sales_amount, active, expires_at, created_at`,
        [user.id, kind, code, percent, maxUses, expiresAt]
      )).rows[0] as CodeRow;

      if (kind === "partner") {
        await query(
          "UPDATE users SET partner_code = $2, partner_code_at = NOW() WHERE id = $1",
          [user.id, code]
        );
      }

      return NextResponse.json({ ok: true, code: inserted });
    } catch (error: any) {
      if (String(error?.code) === "23505") {
        return NextResponse.json({ error: "Такой код уже занят" }, { status: 409 });
      }
      throw error;
    }
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

/** Включает/выключает код. */
export async function PATCH(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    const body = (await req.json().catch(() => ({}))) as {
      id?: unknown;
      active?: unknown;
    };
    const id = Number(body.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "Неверный код" }, { status: 400 });
    }
    const updated = await query(
      `UPDATE discount_codes SET active = $3
       WHERE id = $1 AND owner_id = $2
       RETURNING id, active`,
      [id, user.id, body.active ? 1 : 0]
    );
    if (!updated.rows.length) {
      return NextResponse.json({ error: "Код не найден" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, active: Number(updated.rows[0].active) === 1 });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    const body = (await req.json().catch(() => ({}))) as { id?: unknown };
    const id = Number(body.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "Неверный код" }, { status: 400 });
    }
    const deleted = await query(
      "DELETE FROM discount_codes WHERE id = $1 AND owner_id = $2 RETURNING code",
      [id, user.id]
    );
    if (!deleted.rows.length) {
      return NextResponse.json({ error: "Код не найден" }, { status: 404 });
    }
    if (deleted.rows[0].code === user.partner_code) {
      await query("UPDATE users SET partner_code = NULL WHERE id = $1", [user.id]);
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
