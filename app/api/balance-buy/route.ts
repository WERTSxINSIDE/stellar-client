import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addBalanceHistory, withTransaction } from "@/lib/db";

export const dynamic = "force-dynamic";

const PRICES: Record<number, number> = {
  1: 10,
  3: 20,
  7: 55,
  30: 130,
  90: 250,
  180: 400,
  999999: 300,
};

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const { days, hwid } = await req.json();

    if (hwid) {
      const price = 150;

      const result = await withTransaction(async (client) => {
        const row = await client.query(
          "SELECT COALESCE(balance, 0) AS balance FROM users WHERE id = $1 FOR UPDATE",
          [user.id]
        );
        if (!row.rows.length) {
          return { error: "Пользователь не найден", status: 404 } as const;
        }

        const balance = Number(row.rows[0].balance) || 0;
        if (balance < price) {
          return {
            error: `Недостаточно баланса. Нужно ${price}₽, у вас ${balance}₽`,
            status: 400,
          } as const;
        }

        const updated = await client.query(
          `UPDATE users SET balance = balance - $1, hwid = NULL
           WHERE id = $2 AND COALESCE(balance, 0) >= $1
           RETURNING balance`,
          [price, user.id]
        );
        if (!updated.rows.length) {
          return { error: "Недостаточно баланса", status: 400 } as const;
        }

        await addBalanceHistory(user.id, -price, "hwid", "Сброс HWID", client);

        return { balance: Number(updated.rows[0].balance) || 0 } as const;
      });

      if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      return NextResponse.json({ ok: true, balance: result.balance });
    }

    if (!days) {
      return NextResponse.json({ error: "Укажите тариф" }, { status: 400 });
    }

    const price = PRICES[days];
    if (!price) {
      return NextResponse.json({ error: "Неизвестный тариф" }, { status: 400 });
    }

    const result = await withTransaction(async (client) => {
      const row = await client.query(
        "SELECT COALESCE(balance, 0) AS balance, subscription_end FROM users WHERE id = $1 FOR UPDATE",
        [user.id]
      );
      if (!row.rows.length) {
        return { error: "Пользователь не найден", status: 404 } as const;
      }

      const balance = Number(row.rows[0].balance) || 0;
      if (balance < price) {
        return {
          error: `Недостаточно баланса. Нужно ${price}₽, у вас ${balance}₽`,
          status: 400,
        } as const;
      }

      let base: Date;
      if (row.rows[0].subscription_end) {
        const current = new Date(String(row.rows[0].subscription_end).replace(" ", "T"));
        base = current > new Date() ? current : new Date();
      } else {
        base = new Date();
      }
      base.setDate(base.getDate() + Number(days));
      const newEnd = base.toISOString().slice(0, 19).replace("T", " ");

      const updated = await client.query(
        `UPDATE users SET balance = balance - $1, subscription_end = $2, sub_gifted = 0
         WHERE id = $3 AND COALESCE(balance, 0) >= $1
         RETURNING balance`,
        [price, newEnd, user.id]
      );
      if (!updated.rows.length) {
        return { error: "Недостаточно баланса", status: 400 } as const;
      }

      await addBalanceHistory(
        user.id,
        -price,
        "subscription",
        `Покупка подписки на ${days} дн.`,
        client
      );

      return {
        balance: Number(updated.rows[0].balance) || 0,
        subscription_end: newEnd,
      } as const;
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      ok: true,
      balance: result.balance,
      subscription_end: result.subscription_end,
    });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
