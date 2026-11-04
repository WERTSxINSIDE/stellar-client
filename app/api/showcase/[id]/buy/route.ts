import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addBalanceHistory, queryOne, withTransaction } from "@/lib/db";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";
import { notifyUser } from "@/lib/notify";
import { escapeTelegramHtml, notifyAdmins } from "@/lib/telegram";
import { logActivity } from "@/lib/activity";
import { sellerPayout, discountedPrice } from "@/lib/showcase";
import {
  applyCodeDiscount,
  discountCodeError,
  normalizeCode,
  recordCodeUse,
  type DiscountCodeRow,
} from "@/lib/discounts";
import { coinsForPurchase, grantCoins } from "@/lib/coins";

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
  user_id: number;
  type: string;
  title: string;
  price: number | null;
  status: string;
  discount_percent: number | null;
  discount_until: string | null;
  username?: string;
};

const CODE_SELECT = `SELECT id, owner_id, kind, code, discount_percent, max_uses, used_count,
                            clicks, signups, sales_count, sales_amount, active, expires_at
                     FROM discount_codes`;

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

    const body = (await req.json().catch(() => ({}))) as { code?: unknown };
    const code = normalizeCode(body.code);

    const item = (await queryOne(
      `SELECT s.id, s.user_id, s.type, s.title, s.price, s.status,
              s.discount_percent, s.discount_until, u.username
       FROM showcase_items s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = $1`,
      [itemId]
    )) as ItemRow | null;

    if (!item || item.status !== "approved") {
      return NextResponse.json({ error: "Материал не найден" }, { status: 404 });
    }
    if (item.type !== "config") {
      return NextResponse.json({ error: "Платить можно только за конфиги" }, { status: 400 });
    }

    const basePrice = discountedPrice(
      Number(item.price || 0),
      item.discount_percent,
      item.discount_until
    );
    if (!Number.isInteger(basePrice) || basePrice <= 0) {
      return NextResponse.json({ error: "Этот конфиг бесплатный" }, { status: 400 });
    }
    if (item.user_id === user.id) {
      return NextResponse.json({ error: "Нельзя купить собственный конфиг" }, { status: 400 });
    }

    let codeRow: DiscountCodeRow | null = null;
    if (code) {
      codeRow = (await queryOne(`${CODE_SELECT} WHERE code = $1`, [code])) as DiscountCodeRow | null;
      const error = discountCodeError(codeRow, user.id, item.user_id);
      if (error) {
        return NextResponse.json({ error }, { status: 400 });
      }
    }

    const price = codeRow
      ? applyCodeDiscount(basePrice, codeRow.discount_percent)
      : basePrice;
    const codeDiscount = basePrice - price;
    let newBalance = 0;
    let coins = 0;

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
        const fresh = locked.rows[0] as ItemRow | undefined;
        if (!fresh || fresh.status !== "approved") {
          throw new PurchaseError("Материал больше недоступен", 404);
        }
        if (fresh.type !== "config") {
          throw new PurchaseError("Платить можно только за конфиги");
        }
        const freshBase = discountedPrice(
          Number(fresh.price || 0),
          fresh.discount_percent,
          fresh.discount_until
        );
        if (freshBase !== basePrice) {
          throw new PurchaseError("Цена изменилась. Обновите страницу и попробуйте снова", 409);
        }

        let freshCode: DiscountCodeRow | null = null;
        if (code) {
          const codeLocked = await client.query(`${CODE_SELECT} WHERE code = $1 FOR UPDATE`, [code]);
          freshCode = (codeLocked.rows[0] as DiscountCodeRow) || null;
          const error = discountCodeError(freshCode, user.id, fresh.user_id);
          if (error) throw new PurchaseError(error);
        }
        const freshPrice = freshCode
          ? applyCodeDiscount(freshBase, freshCode.discount_percent)
          : freshBase;
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
          [itemId, user.id, fresh.user_id, price]
        );
        if (!purchase.rows.length) {
          throw new PurchaseError("Вы уже купили этот конфиг", 409);
        }

        // Партнёрский код оплачивает площадка: автор получает полную цену.
        const payoutBase =
          freshCode && freshCode.kind === "partner" ? freshBase : freshPrice;
        const payout = sellerPayout(payoutBase);
        if (payout > 0) {
          await client.query(
            "UPDATE users SET balance = COALESCE(balance, 0) + $2 WHERE id = $1",
            [fresh.user_id, payout]
          );
        }

        await addBalanceHistory(
          user.id,
          -price,
          "showcase_purchase",
          `Покупка конфига: ${fresh.title}${freshCode ? ` (код ${freshCode.code})` : ""}`,
          client
        );
        if (payout > 0) {
          await addBalanceHistory(
            fresh.user_id,
            payout,
            "showcase_sale",
            `Продажа конфига: ${fresh.title}`,
            client
          );
        }

        if (freshCode) {
          await recordCodeUse(
            client,
            freshCode.id,
            user.id,
            fresh.user_id,
            itemId,
            price,
            freshBase - freshPrice
          );
        }

        coins = coinsForPurchase(price);
        if (coins > 0) {
          await grantCoins(user.id, coins, "purchase", `Покупка конфига: ${fresh.title}`, client);
        }

        return Number(debit.rows[0].balance);
      });
    } catch (error) {
      if (error instanceof PurchaseError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      throw error;
    }

    const payoutPreview = sellerPayout(
      codeRow && codeRow.kind === "partner" ? basePrice : price
    );

    await notifyUser(
      item.user_id,
      {
        type: "showcase",
        title: "Ваш конфиг купили",
        body: `«${item.title}» купили за ${price} ₽. На баланс зачислено ${payoutPreview} ₽.`,
        link: `/community/config/${itemId}`,
      }
    ).catch(() => {});

    await notifyUser(
      user.id,
      {
        type: "showcase",
        title: "Покупка конфига",
        body: `«${item.title}» куплен за ${price} ₽${coins ? ` и +${coins} SC` : ""}. Скачать можно на странице конфига.`,
        link: `/community/config/${itemId}`,
      }
    ).catch(() => {});

    await logActivity(user.id, "purchase", "Покупка конфига", item.title);

    await notifyAdmins(
      [
        "💰 <b>Продажа конфига</b>",
        `«${escapeTelegramHtml(item.title)}» — ${price} ₽`,
        `Покупатель: ${escapeTelegramHtml(user.username)}`,
        `Автор: ${escapeTelegramHtml(String(item.username || ""))}`,
        ...(codeRow ? [`Код: ${escapeTelegramHtml(codeRow.code)} (−${codeRow.discount_percent}%)`] : []),
      ].join("\n")
    ).catch(() => {});

    return NextResponse.json({
      ok: true,
      balance: newBalance,
      price,
      discount: codeDiscount,
      code: codeRow?.code ?? null,
      coins,
      seller_amount: payoutPreview,
    });
  } catch (error: any) {
    console.error("showcase buy error:", error?.message || error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
