import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addBalanceHistory, queryOne, withTransaction } from "@/lib/db";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";
import { notifyUser } from "@/lib/notify";
import { logActivity } from "@/lib/activity";
import { discountedPrice, sellerPayout } from "@/lib/showcase";

export const dynamic = "force-dynamic";

class PurchaseError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

type ItemRow = {
  id: number;
  title: string;
  price: number | null;
  discount_percent: number | null;
  discount_until: string | null;
};

/** Покупка набора конфигов со скидкой. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Войдите, чтобы купить набор" }, { status: 401 });
    }

    const limited = await enforceRateLimit(
      req,
      [
        { scope: "showcase-bundle-buy:account", identifier: user.id, limit: 30, windowMs: 60 * 60_000 },
        { scope: "showcase-bundle-buy:ip", identifier: getClientIp(req), limit: 60, windowMs: 60 * 60_000 },
      ],
      "Слишком много покупок. Попробуйте позже."
    );
    if (limited) return limited;

    const { id } = await params;
    const bundleId = Number(id);
    if (!Number.isInteger(bundleId) || bundleId <= 0) {
      return NextResponse.json({ error: "Неверный набор" }, { status: 400 });
    }

    let result: {
      balance: number;
      price: number;
      savings: number;
      items: number;
    };

    try {
      result = await withTransaction(async (client) => {
        const locked = await client.query(
          `SELECT id, user_id, title, status, discount_percent
           FROM showcase_bundles
           WHERE id = $1
           FOR UPDATE`,
          [bundleId]
        );
        const bundle = locked.rows[0] as
          | {
              id: number;
              user_id: number;
              title: string;
              status: string;
              discount_percent: number | null;
            }
          | undefined;

        if (!bundle || bundle.status !== "approved") {
          throw new PurchaseError("Набор больше недоступен", 404);
        }
        if (bundle.user_id === user.id) {
          throw new PurchaseError("Нельзя купить собственный набор");
        }

        const itemsResult = await client.query(
          `SELECT s.id, s.title, s.price, s.discount_percent, s.discount_until
           FROM showcase_bundle_items bi
           JOIN showcase_items s ON s.id = bi.item_id
           WHERE bi.bundle_id = $1 AND s.status = 'approved'
           ORDER BY s.id ASC`,
          [bundleId]
        );
        const items = itemsResult.rows as ItemRow[];
        if (items.length < 2) {
          throw new PurchaseError("Набор пуст или недоступен", 404);
        }

        const itemIds = items.map((item) => item.id);
        const ownedResult = await client.query(
          `SELECT item_id FROM showcase_purchases
           WHERE buyer_id = $1 AND item_id = ANY($2::int[])`,
          [user.id, itemIds]
        );
        const owned = new Set<number>(
          (ownedResult.rows as { item_id: number }[]).map((row) => row.item_id)
        );

        const entries = items
          .filter((item) => !owned.has(item.id))
          .map((item) => ({
            item,
            finalPrice: discountedPrice(
              Number(item.price || 0),
              item.discount_percent,
              item.discount_until
            ),
          }));

        if (entries.length === 0) {
          throw new PurchaseError("Все конфиги из набора уже куплены", 409);
        }

        const basePrice = entries.reduce((sum, entry) => sum + entry.finalPrice, 0);
        if (basePrice <= 0) {
          throw new PurchaseError("В наборе нет платных конфигов");
        }

        const percent = Math.max(
          0,
          Math.min(90, Math.floor(Number(bundle.discount_percent || 0)))
        );
        const price = Math.max(1, Math.round((basePrice * (100 - percent)) / 100));
        const payout = sellerPayout(price);

        const existing = await client.query(
          "SELECT id FROM showcase_bundle_purchases WHERE bundle_id = $1 AND buyer_id = $2",
          [bundleId, user.id]
        );
        if (existing.rows.length) {
          throw new PurchaseError("Вы уже купили этот набор", 409);
        }

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
          `INSERT INTO showcase_bundle_purchases (bundle_id, buyer_id, seller_id, price)
           VALUES ($1, $2, $3, $4)
           RETURNING id`,
          [bundleId, user.id, bundle.user_id, price]
        );
        if (!purchase.rows.length) {
          throw new PurchaseError("Вы уже купили этот набор", 409);
        }

        // Распределяем сумму набора между конфигами, чтобы статистика автора была честной.
        let remaining = price;
        const allocations = entries.map((entry, index) => {
          if (index === entries.length - 1) return remaining;
          const share = Math.max(
            0,
            Math.min(remaining, Math.round((price * entry.finalPrice) / basePrice))
          );
          remaining -= share;
          return share;
        });

        for (let i = 0; i < entries.length; i += 1) {
          await client.query(
            `INSERT INTO showcase_purchases (item_id, buyer_id, seller_id, price)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (item_id, buyer_id) DO NOTHING`,
            [entries[i].item.id, user.id, bundle.user_id, allocations[i]]
          );
        }

        if (payout > 0) {
          await client.query(
            "UPDATE users SET balance = COALESCE(balance, 0) + $2 WHERE id = $1",
            [bundle.user_id, payout]
          );
        }

        await addBalanceHistory(
          user.id,
          -price,
          "showcase_bundle_purchase",
          `Покупка набора: ${bundle.title}`,
          client
        );
        if (payout > 0) {
          await addBalanceHistory(
            bundle.user_id,
            payout,
            "showcase_bundle_sale",
            `Продажа набора: ${bundle.title}`,
            client
          );
        }

        return {
          balance: Number(debit.rows[0].balance),
          price,
          savings: basePrice - price,
          items: entries.length,
        };
      });
    } catch (error) {
      if (error instanceof PurchaseError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      throw error;
    }

    const bundle = (await queryOne(
      "SELECT user_id, title FROM showcase_bundles WHERE id = $1",
      [bundleId]
    )) as { user_id: number; title: string } | null;

    if (bundle) {
      await notifyUser(bundle.user_id, {
        type: "showcase",
        title: "Ваш набор купили",
        body: `Набор «${bundle.title}» купили за ${result.price} ₽.`,
        link: `/community`,
      }).catch(() => {});
    }

    await notifyUser(user.id, {
      type: "showcase",
      title: "Покупка набора",
      body: `Набор куплен за ${result.price} ₽. Конфиги уже доступны для скачивания.`,
      link: `/community`,
    }).catch(() => {});

    await logActivity(
      user.id,
      "purchase",
      "Покупка набора",
      bundle?.title || `Набор #${bundleId}`
    ).catch(() => {});

    return NextResponse.json({
      ok: true,
      balance: result.balance,
      price: result.price,
      savings: result.savings,
      items: result.items,
    });
  } catch (error) {
    console.error("showcase bundle buy error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
