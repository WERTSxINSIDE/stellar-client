import { randomInt } from "crypto";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { logAdminAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function block(length: number) {
  let value = "";
  for (let i = 0; i < length; i += 1) value += ALPHABET[randomInt(ALPHABET.length)];
  return value;
}

/** Массовая генерация промокодов: до 1000 штук за один запрос. */
export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const amount = Math.round(Number(body.amount));
    const count = Math.round(Number(body.count));
    const maxUses = Math.round(Number(body.max_uses ?? 1));
    const prefix = String(body.prefix || "").trim().toUpperCase();

    if (!Number.isFinite(amount) || amount < 1 || amount > 100000) {
      return NextResponse.json({ error: "Сумма должна быть от 1 до 100 000 ₽" }, { status: 400 });
    }
    if (!Number.isFinite(count) || count < 1 || count > 1000) {
      return NextResponse.json({ error: "Количество должно быть от 1 до 1000" }, { status: 400 });
    }
    if (!Number.isFinite(maxUses) || maxUses < 0 || maxUses > 100000) {
      return NextResponse.json({ error: "Некорректный лимит активаций" }, { status: 400 });
    }
    if (!/^[A-Z0-9]{0,8}$/.test(prefix)) {
      return NextResponse.json(
        { error: "Префикс: до 8 символов, только латиница и цифры" },
        { status: 400 }
      );
    }

    const base = `${prefix || "SC"}${amount}`;
    const inserted = await withTransaction(async (client) => {
      const rows: { code: string; amount: number; max_uses: number }[] = [];
      let guard = 0;

      while (rows.length < count) {
        guard += 1;
        if (guard > 30) throw new Error("Не удалось сгенерировать уникальные коды");

        const need = count - rows.length;
        const candidates = new Set<string>();
        while (candidates.size < need) {
          candidates.add(`${base}-${block(5)}-${block(5)}`);
        }

        const codes = [...candidates];
        const values: string[] = [];
        const params: unknown[] = [];
        codes.forEach((code, index) => {
          const offset = index * 3;
          values.push(`($${offset + 1}, $${offset + 2}, $${offset + 3})`);
          params.push(code, amount, maxUses);
        });

        const result = await client.query(
          `INSERT INTO promo_codes (code, amount, max_uses)
           VALUES ${values.join(", ")}
           ON CONFLICT (code) DO NOTHING
           RETURNING code, amount, max_uses`,
          params
        );
        rows.push(...result.rows);
      }

      return rows;
    });

    await logAdminAction(
      admin,
      "promo_bulk_create",
      null,
      `${amount} ₽ × ${inserted.length}, лимит ${maxUses || "∞"}, префикс ${prefix || "SC"}`
    );

    return NextResponse.json({ ok: true, codes: inserted });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
