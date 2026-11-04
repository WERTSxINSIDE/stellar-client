import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query, queryAll, queryOne, withTransaction } from "@/lib/db";

export const dynamic = "force-dynamic";

type CosmeticRow = {
  key: string;
  type: string;
  title: string;
  description: string | null;
  price: number;
  value: string | null;
  rarity: string;
};

const SLOT_BY_TYPE: Record<string, string> = {
  nickname_color: "nickname_color",
  frame: "equipped_frame",
  badge: "equipped_badge",
  theme: "profile_theme",
  site_theme: "site_theme",
  game: "equipped_game",
};

const COLUMNS = [
  "nickname_color",
  "equipped_frame",
  "equipped_badge",
  "profile_theme",
  "site_theme",
  "equipped_game",
] as const;

function equippedKeys(items: CosmeticRow[], values: Record<string, string | null>) {
  const byValue = new Map<string, string>();
  for (const item of items) {
    if (item.value) byValue.set(`${item.type}:${item.value}`, item.key);
  }
  const result: Record<string, string | null> = {};
  for (const [type, column] of Object.entries(SLOT_BY_TYPE)) {
    // Для игровой косметики в колонке хранится ключ предмета, а не value (эмодзи).
    if (type === "game") {
      const key = values[column] ?? null;
      result[type] = key && items.some((item) => item.type === "game" && item.key === key) ? key : null;
      continue;
    }
    const value = values[column] ?? null;
    result[type] = value ? byValue.get(`${type}:${value}`) ?? null : null;
  }
  return result;
}

/** Каталог косметики, купленные предметы и баланс SC-монет. */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const [items, ownedRows, fresh, transactions] = await Promise.all([
      queryAll(
        `SELECT key, type, title, description, price, value, rarity
         FROM cosmetic_items WHERE active = 1
         ORDER BY type, price ASC`
      ) as Promise<CosmeticRow[]>,
      queryAll(
        `SELECT cosmetic_key FROM user_cosmetics WHERE user_id = $1`,
        [user.id]
      ) as Promise<{ cosmetic_key: string }[]>,
      queryOne(
        `SELECT nickname_color, equipped_frame, equipped_badge, profile_theme, site_theme
         FROM users WHERE id = $1`,
        [user.id]
      ) as Promise<Record<string, string | null> | null>,
      queryAll(
        `SELECT id, amount, type, note, created_at FROM coin_transactions
         WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
        [user.id]
      ),
    ]);

    const values: Record<string, string | null> = {};
    for (const column of COLUMNS) values[column] = fresh?.[column] ?? null;

    return NextResponse.json({
      ok: true,
      items,
      owned: ownedRows.map((row) => String(row.cosmetic_key)),
      equipped: equippedKeys(items, values),
      equipped_values: values,
      balance: Number(user.sc_coins || 0),
      transactions,
    });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

/** Покупает косметику за SC-монеты. */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    const body = (await req.json().catch(() => ({}))) as { key?: unknown };
    const key = String(body.key || "").trim();
    if (!key) {
      return NextResponse.json({ error: "Не выбран предмет" }, { status: 400 });
    }

    const result = await withTransaction(async (client) => {
      const itemResult = await client.query(
        `SELECT key, type, title, description, price, value, rarity
         FROM cosmetic_items WHERE key = $1 AND active = 1`,
        [key]
      );
      const item = itemResult.rows[0] as CosmeticRow | undefined;
      if (!item) return { error: "Предмет не найден", status: 404 } as const;

      const owned = await client.query(
        "SELECT 1 AS found FROM user_cosmetics WHERE user_id = $1 AND cosmetic_key = $2",
        [user.id, key]
      );
      if (owned.rows.length) return { error: "Предмет уже куплен", status: 409 } as const;

      const price = Math.max(0, Math.floor(Number(item.price) || 0));
      if (price <= 0) return { error: "Предмет недоступен", status: 400 } as const;

      const debit = await client.query(
        `UPDATE users
         SET sc_coins = COALESCE(sc_coins, 0) - $2
         WHERE id = $1 AND COALESCE(sc_coins, 0) >= $2
         RETURNING COALESCE(sc_coins, 0)::int AS coins`,
        [user.id, price]
      );
      if (!debit.rows.length) {
        return { error: "Недостаточно SC-монет", status: 400 } as const;
      }

      await client.query(
        "INSERT INTO coin_transactions (user_id, amount, type, note) VALUES ($1, $2, 'cosmetic', $3)",
        [user.id, -price, `Косметика: ${item.title}`]
      );
      await client.query(
        `INSERT INTO user_cosmetics (user_id, cosmetic_key) VALUES ($1, $2)
         ON CONFLICT (user_id, cosmetic_key) DO NOTHING`,
        [user.id, key]
      );

      return {
        coins: Number(debit.rows[0].coins) || 0,
        item,
      } as const;
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      ok: true,
      balance: result.coins,
      item: result.item,
    });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

/** Надевает/снимает купленную косметику. */
export async function PUT(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    const body = (await req.json().catch(() => ({}))) as {
      type?: unknown;
      key?: unknown;
    };
    const type = String(body.type || "");
    const column = SLOT_BY_TYPE[type];
    if (!column) {
      return NextResponse.json({ error: "Неизвестный слот" }, { status: 400 });
    }

    const key = body.key ? String(body.key) : "";

    if (!key) {
      await query(`UPDATE users SET ${column} = NULL WHERE id = $1`, [user.id]);
      return NextResponse.json({ ok: true, equipped: null });
    }

    const item = (await queryOne(
      `SELECT key, type, title, description, price, value, rarity
       FROM cosmetic_items WHERE key = $1 AND type = $2 AND active = 1`,
      [key, type]
    )) as CosmeticRow | null;
    if (!item) {
      return NextResponse.json({ error: "Предмет не найден" }, { status: 404 });
    }

    const owned = await queryOne(
      "SELECT 1 AS found FROM user_cosmetics WHERE user_id = $1 AND cosmetic_key = $2",
      [user.id, key]
    );
    if (!owned) {
      return NextResponse.json({ error: "Сначала купите предмет" }, { status: 403 });
    }

    await query(`UPDATE users SET ${column} = $2 WHERE id = $1`, [
      user.id,
      type === "game" ? item.key : item.value,
    ]);
    return NextResponse.json({ ok: true, equipped: item.key });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
