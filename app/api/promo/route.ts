import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { notifyUser } from "@/lib/notify";
import { escapeTelegramHtml, notifyAdmins } from "@/lib/telegram";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const code = String(body.code || "").trim().toUpperCase();

    if (!/^[A-Z0-9_-]{3,64}$/.test(code)) {
      return NextResponse.json({ error: "Введите корректный промокод" }, { status: 400 });
    }

    // Промокоды перебирают — ограничиваем и аккаунт, и IP.
    const limited = await enforceRateLimit(req, [
      { scope: "promo:account", identifier: user.id, limit: 10, windowMs: 10 * 60_000 },
      { scope: "promo:ip", identifier: getClientIp(req), limit: 30, windowMs: 10 * 60_000 },
    ]);
    if (limited) return limited;

    const result = await withTransaction(async (client) => {
      const found = await client.query("SELECT * FROM promo_codes WHERE code = $1 FOR UPDATE", [code]);
      const promo = found.rows[0];

      if (!promo) return { error: "Промокод не найден", status: 404 } as const;
      if (!promo.active) return { error: "Промокод больше не действует", status: 400 } as const;
      if (promo.expires_at && new Date(String(promo.expires_at).replace(" ", "T")) < new Date()) {
        return { error: "Срок действия промокода истёк", status: 400 } as const;
      }
      if (Number(promo.max_uses) > 0 && Number(promo.used_count) >= Number(promo.max_uses)) {
        return { error: "Лимит активаций промокода исчерпан", status: 400 } as const;
      }

      const used = await client.query(
        "SELECT 1 FROM promo_uses WHERE promo_id = $1 AND user_id = $2 LIMIT 1",
        [promo.id, user.id]
      );
      if (used.rows.length) {
        return { error: "Вы уже активировали этот промокод", status: 409 } as const;
      }

      const amount = Number(promo.amount);
      const updated = await client.query(
        "UPDATE users SET balance = COALESCE(balance, 0) + $1 WHERE id = $2 RETURNING balance",
        [amount, user.id]
      );

      await client.query(
        "INSERT INTO balance_history (user_id, amount, type, note) VALUES ($1, $2, 'promo', $3)",
        [user.id, amount, `Промокод ${code}`]
      );
      await client.query("UPDATE promo_codes SET used_count = used_count + 1 WHERE id = $1", [promo.id]);
      await client.query(
        "INSERT INTO promo_uses (promo_id, user_id, amount) VALUES ($1, $2, $3)",
        [promo.id, user.id, amount]
      );

      return { amount, balance: Number(updated.rows[0]?.balance ?? 0) } as const;
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    await notifyUser(
      user.id,
      {
        type: "promo",
        title: `+${result.amount} ₽ по промокоду`,
        body: `Промокод ${code} активирован, бонус зачислен на баланс.`,
        link: "/dashboard",
      },
      { email: true }
    ).catch(() => {});

    await notifyAdmins(
      [
        "🎟 <b>Активация промокода</b>",
        `Код: <code>${escapeTelegramHtml(code)}</code>`,
        `Сумма: ${result.amount} ₽`,
        `Пользователь: ${escapeTelegramHtml(user.username)} (#${user.id})`,
      ].join("\n")
    ).catch(() => {});

    return NextResponse.json({ ok: true, amount: result.amount, balance: result.balance });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
