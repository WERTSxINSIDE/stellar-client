import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addBalanceHistory, queryOne, withTransaction } from "@/lib/db";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";
import { notifyUser } from "@/lib/notify";
import { logActivity } from "@/lib/activity";
import { sellerPayout, discountedPrice } from "@/lib/showcase";

export const dynamic = "force-dynamic";

class PurchaseError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/** Покупка платного конфига: деньги списываются с покупателя и зачисляются автору. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Войдите, чтобы купить конфиг" }, { status: 401 });
    }

    const limited = await enforceRateLimit(
      req,
      [
        { scope: "showcase-buy:account", identifier: user.id, limit: 30, windowMs: 60 * 60_000 },
        { scope: "showcase-buy:ip", identifier: getClientIp(req), limit: 60, windowMs: 60 * 60_000 },
      ],
      "Слишком много покупок. Попробуйте позже."
    );
    if (limited) return limited;

    const { id } = await params;
    const itemId = Number(id);
    if (!Number.isInteger(itemId) || itemId <= 0) {
      return NextResponse.json({ error: "Неверный материал" }, { status: 400 });
    }

    const item = (await queryOne(
      `SELECT s.id, s.user_id, s.type, s.title, s.price, s.status,
              s.discount_percent, s.discount_until, u.username
       FROM showcase_items s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = $1`,
      [itemId]
    )) as
      | {
          id: number;
          user_id: number;
          type: string;
          title: string;
          price: number | null;
          status: string;
          discount_percent: number | null;
          discount_until: string | null;
          username: string;
        }
      | null;

    if (!item || item.status !== "approved") {
      return NextResponse.json({ error: "Материал не найден" }, { status: 404 });
    }
    if (item.type !== "config") {
      return NextResponse.json({ error: "Платить можно только за конфиги" }, { status: 400 });
    }

    const price = discountedPrice(
      Number(item.price || 0),
      item.discount_percent,
      item.discount_until
    );
    if (!Number.isInteger(price) || price <= 0) {
      return NextResponse.json({ error: "Этот конфиг бесплатный" }, { status: 400 });
    }
    if (item.user_id === user.id) {
      return NextResponse.json({ error: "Нельзя купить собственный конфиг" }, { status: 400 });
    }

    const payout = sellerPayout(price);
    let newBalance = 0;

    try {
      newBalance = await withTransaction(async (client) => {
        // Блокируем материал, чтобы цена и статус не изменились во время оплаты.
        const locked = await client.query(
          `SELECT id, user_id, type, title, status, price,
                  discount_percent, discount_until
           FROM showcase_items
           WHERE id = $1
           FOR UPDATE`,
          [itemId]
        );
        const fresh = locked.rows[0];
        if (!fresh || fresh.status !== "approved") {
          throw new PurchaseError("Материал больше недоступен", 404);
        }
        if (fresh.type !== "config") {
          throw new PurchaseError("Платить можно только за конфиги");
        }
        const freshPrice = discountedPrice(
          Number(fresh.price || 0),
          fresh.discount_percent,
          fresh.discount_until
        );
        if (freshPrice !== price) {
          throw new PurchaseError("Цена изменилась. Обновите страницу и попробуйте снова", 409);
        }

        const existing = await client.query(
          "SELECT id FROM showcase_purchases WHERE item_id = $1 AND buyer_id = $2",
          [itemId, user.id]
        );
        if (existing.rows.length) {
          throw new PurchaseError("Вы уже купили этот конфиг", 409);
        }

        // Атомарное списание: не уйдём в минус при двух одновременных покупках.
        const debit = await client.query(
          `UPDATE users
           SET balance = COALESCE(balance, 0) - $2
           WHERE id = $1 AND COALESCE(balance, 0) >= $2
           RETURNING balance`,
          [user.id, price]
        );
        if (!debit.rows.length) {
          throw new PurchaseError("Недостаточно средств на балансе");
        }

        const purchase = await client.query(
          `INSERT INTO showcase_purchases (item_id, buyer_id, seller_id, price)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (item_id, buyer_id) DO NOTHING
           RETURNING id`,
          [itemId, user.id, item.user_id, price]
        );
        if (!purchase.rows.length) {
          throw new PurchaseError("Вы уже купили этот конфиг", 409);
        }

        if (payout > 0) {
          await client.query(
            "UPDATE users SET balance = COALESCE(balance, 0) + $2 WHERE id = $1",
            [item.user_id, payout]
          );
        }

        await addBalanceHistory(
          user.id,
          -price,
          "showcase_purchase",
          `Покупка конфига: ${item.title}`,
          client
        );
        if (payout > 0) {
          await addBalanceHistory(
            item.user_id,
            payout,
            "showcase_sale",
            `Продажа конфига: ${item.title}`,
            client
          );
        }

        return Number(debit.rows[0].balance);
      });
    } catch (error) {
      if (error instanceof PurchaseError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      throw error;
    }

    await notifyUser(
      item.user_id,
      {
        type: "showcase",
        title: "Ваш конфиг купили",
        body: `«${item.title}» купили за ${price} ₽. На баланс зачислено ${payout} ₽.`,
        link: `/community/config/${itemId}`,
      }
    ).catch(() => {});

    await notifyUser(
      user.id,
      {
        type: "showcase",
        title: "Покупка конфига",
        body: `«${item.title}» куплен за ${price} ₽. Скачать можно на странице конфига.`,
        link: `/community/config/${itemId}`,
      }
    ).catch(() => {});

    await logActivity(user.id, "purchase", "Покупка конфига", item.title);

    return NextResponse.json({ ok: true, balance: newBalance, price, seller_amount: payout });
  } catch (error: any) {
    console.error("showcase buy error:", error?.message || error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
