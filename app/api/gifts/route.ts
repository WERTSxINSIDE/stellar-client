import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { queryAll, queryOne, withTransaction } from "@/lib/db";
import { grantCoins } from "@/lib/coins";
import { notifyUser } from "@/lib/notify";
import { enforceRateLimit } from "@/lib/rate-limit";
import { touchPresence } from "@/lib/presence";

export const dynamic = "force-dynamic";

const MAX_MESSAGE = 200;
const MIN_COINS = 1;

type GiftRow = {
  id: number;
  kind: "coins" | "cosmetic";
  amount: number;
  item_key: string | null;
  message: string | null;
  created_at: string;
  sender_id: number | null;
  sender_username: string | null;
  recipient_id: number;
  recipient_username: string | null;
  item_title: string | null;
};

function publicGift(row: GiftRow, viewerId: number) {
  return {
    id: row.id,
    kind: row.kind,
    amount: row.amount,
    item_key: row.item_key,
    item_title: row.item_title,
    message: row.message,
    created_at: row.created_at,
    direction: row.sender_id === viewerId ? "sent" : "received",
    sender: row.sender_username,
    recipient: row.recipient_username,
  };
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    await touchPresence(user.id);

    const rows = (await queryAll(
      `SELECT g.id, g.kind, g.amount, g.item_key, g.message, g.created_at,
              g.sender_id, g.recipient_id,
              s.username AS sender_username, r.username AS recipient_username,
              ci.title AS item_title
       FROM gifts g
       LEFT JOIN users s ON s.id = g.sender_id
       LEFT JOIN users r ON r.id = g.recipient_id
       LEFT JOIN cosmetic_items ci ON ci.key = g.item_key
       WHERE g.sender_id = $1 OR g.recipient_id = $1
       ORDER BY g.id DESC
       LIMIT 100`,
      [user.id]
    )) as GiftRow[];

    const gifts = rows.map((row) => publicGift(row, user.id));

    return NextResponse.json({
      ok: true,
      sent: gifts.filter((gift) => gift.direction === "sent"),
      received: gifts.filter((gift) => gift.direction === "received"),
    });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    await touchPresence(user.id);

    const limited = await enforceRateLimit(req, [
      { scope: "gifts:account", identifier: user.id, limit: 20, windowMs: 10 * 60_000 },
    ]);
    if (limited) return limited;

    const body = (await req.json().catch(() => ({}))) as {
      kind?: unknown;
      username?: unknown;
      amount?: unknown;
      item_key?: unknown;
      message?: unknown;
    };

    const kind = String(body.kind || "");
    const username = String(body.username || "").trim();
    const message = String(body.message || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_MESSAGE);

    if (!["coins", "cosmetic"].includes(kind)) {
      return NextResponse.json({ error: "Неизвестный тип подарка" }, { status: 400 });
    }
    if (!username) {
      return NextResponse.json({ error: "Укажите получателя" }, { status: 400 });
    }

    const target = (await queryOne(
      "SELECT id, username FROM users WHERE LOWER(username) = LOWER($1)",
      [username]
    )) as { id: number; username: string } | null;
    if (!target) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }
    if (target.id === user.id) {
      return NextResponse.json({ error: "Нельзя дарить подарки себе" }, { status: 400 });
    }

    if (kind === "coins") {
      const amount = Math.floor(Number(body.amount));
      if (!Number.isInteger(amount) || amount < MIN_COINS) {
        return NextResponse.json({ error: "Минимум 1 SC" }, { status: 400 });
      }

      const result = await withTransaction(async (client) => {
        const updated = await client.query(
          `UPDATE users
           SET sc_coins = COALESCE(sc_coins, 0) - $2
           WHERE id = $1 AND COALESCE(sc_coins, 0) >= $2
           RETURNING COALESCE(sc_coins, 0)::int AS coins`,
          [user.id, amount]
        );
        if (!updated.rows.length) return null;

        await client.query(
          "INSERT INTO coin_transactions (user_id, amount, type, note) VALUES ($1, $2, $3, $4)",
          [user.id, -amount, "gift_sent", `Подарок для ${target.username}`]
        );

        await grantCoins(
          target.id,
          amount,
          "gift_received",
          `Подарок от ${user.username}`,
          client
        );

        const inserted = await client.query(
          `INSERT INTO gifts (sender_id, recipient_id, kind, amount, message)
           VALUES ($1, $2, 'coins', $3, $4)
           RETURNING id`,
          [user.id, target.id, amount, message || null]
        );

        return { id: inserted.rows[0]?.id, coins: Number(updated.rows[0].coins) };
      });

      if (!result) {
        return NextResponse.json({ error: "Недостаточно SC" }, { status: 400 });
      }

      await notifyUser(target.id, {
        type: "gift",
        title: "Вам подарили SC",
        body: `${user.username} отправил(а) вам ${amount} SC${message ? `: ${message}` : ""}.`,
        link: "/dashboard/gifts",
      }).catch(() => {});

      return NextResponse.json({ ok: true, id: result.id, coins: result.coins });
    }

    // Косметика: передаём предмет из инвентаря отправителя получателю.
    const itemKey = String(body.item_key || "").trim();
    if (!itemKey) {
      return NextResponse.json({ error: "Выберите косметику" }, { status: 400 });
    }

    const item = (await queryOne(
      `SELECT ci.key, ci.type, ci.title, ci.value
       FROM user_cosmetics uc
       JOIN cosmetic_items ci ON ci.key = uc.cosmetic_key
       WHERE uc.user_id = $1 AND uc.cosmetic_key = $2`,
      [user.id, itemKey]
    )) as { key: string; type: string; title: string; value: string | null } | null;

    if (!item) {
      return NextResponse.json({ error: "У вас нет этой косметики" }, { status: 404 });
    }

    const owner = (await queryOne(
      `SELECT nickname_color, equipped_frame, equipped_badge, profile_theme, site_theme
       FROM users WHERE id = $1`,
      [user.id]
    )) as Record<string, string | null> | null;

    const slotByType: Record<string, string> = {
      nickname_color: "nickname_color",
      frame: "equipped_frame",
      badge: "equipped_badge",
      theme: "profile_theme",
      site_theme: "site_theme",
    };
    const slot = slotByType[item.type];
    if (slot && owner?.[slot] && owner[slot] === item.value) {
      return NextResponse.json(
        { error: "Сначала снимите косметику, если хотите её подарить" },
        { status: 400 }
      );
    }

    const result = await withTransaction(async (client) => {
      const already = await client.query(
        "SELECT 1 FROM user_cosmetics WHERE user_id = $1 AND cosmetic_key = $2",
        [target.id, item.key]
      );
      if (already.rows.length) return { error: "already_owned" as const };

      const removed = await client.query(
        "DELETE FROM user_cosmetics WHERE user_id = $1 AND cosmetic_key = $2 RETURNING cosmetic_key",
        [user.id, item.key]
      );
      if (!removed.rows.length) return { error: "no_item" as const };

      await client.query(
        "INSERT INTO user_cosmetics (user_id, cosmetic_key) VALUES ($1, $2)",
        [target.id, item.key]
      );

      const inserted = await client.query(
        `INSERT INTO gifts (sender_id, recipient_id, kind, item_key, message)
         VALUES ($1, $2, 'cosmetic', $3, $4)
         RETURNING id`,
        [user.id, target.id, item.key, message || null]
      );

      return { id: inserted.rows[0]?.id };
    });

    if ("error" in result) {
      if (result.error === "no_item") {
        return NextResponse.json({ error: "У вас нет этой косметики" }, { status: 404 });
      }
      return NextResponse.json(
        { error: "У получателя уже есть этот предмет" },
        { status: 409 }
      );
    }

    await notifyUser(target.id, {
      type: "gift",
      title: "Вам подарили косметику",
      body: `${user.username} подарил(а) вам «${item.title}»${message ? `: ${message}` : ""}.`,
      link: "/dashboard/gifts",
    }).catch(() => {});

    return NextResponse.json({ ok: true, id: result.id });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
