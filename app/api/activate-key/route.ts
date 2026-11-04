import { NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { keyPrice, referralKeyBonus, referralKeySc } from "@/lib/keys";
import { notifyUser } from "@/lib/notify";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";
import { safeRefreshUserRisk } from "@/lib/risk";
import { logActivity } from "@/lib/activity";

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDate(d: Date): string {
  return d.toISOString().replace("T", " ").slice(0, 19);
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const { key } = await req.json();
    if (!key || !key.trim()) {
      return NextResponse.json({ error: "Введите ключ" }, { status: 400 });
    }

    const limited = await enforceRateLimit(req, [
      { scope: "activate-key:account", identifier: user.id, limit: 10, windowMs: 10 * 60_000 },
      { scope: "activate-key:ip", identifier: getClientIp(req), limit: 30, windowMs: 10 * 60_000 },
    ]);
    if (limited) return limited;

    const result = await withTransaction(async (client) => {
      // FOR UPDATE не даёт двум запросам активировать один и тот же ключ.
      const keyResult = await client.query(
        "SELECT * FROM keys WHERE key = $1 FOR UPDATE",
        [key.trim().toUpperCase()]
      );
      const licenseKey = keyResult.rows[0];

      if (!licenseKey) {
        return { error: "Ключ не найден", status: 404 } as const;
      }
      if (licenseKey.activated_by) {
        return { error: "Ключ уже был использован", status: 409 } as const;
      }

      const now = new Date();
      const userResult = await client.query(
        "SELECT subscription_end, referred_by FROM users WHERE id = $1 FOR UPDATE",
        [user.id]
      );
      if (!userResult.rows.length) {
        return { error: "Пользователь не найден", status: 404 } as const;
      }

      const currentEnd = userResult.rows[0].subscription_end
        ? new Date(String(userResult.rows[0].subscription_end).replace(" ", "T"))
        : null;

      let subEnd: Date;
      if (currentEnd && currentEnd > now) {
        subEnd = addDays(currentEnd, licenseKey.duration_days);
      } else {
        subEnd = addDays(now, licenseKey.duration_days);
      }

      const subEndStr = formatDate(subEnd);

      await client.query(
        "UPDATE users SET subscription_end = $1, sub_gifted = 0 WHERE id = $2",
        [subEndStr, user.id]
      );
      await client.query(
        "UPDATE keys SET activated_by = $1, activated_at = $2 WHERE id = $3",
        [user.id, formatDate(now), licenseKey.id]
      );

      // Реферальные 15% от стоимости ключа — пригласившему, плюс SC-бонус.
      let referral: { userId: number; bonus: number; sc: number } | null = null;
      const referrerId = userResult.rows[0].referred_by
        ? Number(userResult.rows[0].referred_by)
        : null;

      if (referrerId && referrerId !== user.id) {
        const price = keyPrice(Number(licenseKey.duration_days), licenseKey.price);
        const bonus = referralKeyBonus(price);
        const sc = referralKeySc(price);

        if (bonus > 0) {
          await client.query(
            "UPDATE users SET balance = COALESCE(balance, 0) + $1 WHERE id = $2",
            [bonus, referrerId]
          );
          await client.query(
            "INSERT INTO balance_history (user_id, amount, type, note) VALUES ($1, $2, 'referral_key', $3)",
            [referrerId, bonus, `15% от ключа, активированного ${user.username}`]
          );
        }

        if (sc > 0) {
          await client.query(
            "UPDATE users SET sc_coins = COALESCE(sc_coins, 0) + $1 WHERE id = $2",
            [sc, referrerId]
          );
          await client.query(
            "INSERT INTO coin_transactions (user_id, amount, type, note) VALUES ($1, $2, 'referral_key', $3)",
            [referrerId, sc, `SC за ключ, активированный ${user.username}`]
          );
        }

        if (bonus > 0 || sc > 0) {
          referral = { userId: referrerId, bonus, sc };
        }
      }

      return {
        subscription_end: subEndStr,
        duration_days: licenseKey.duration_days,
        referral,
      } as const;
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    await safeRefreshUserRisk(user.id, getClientIp(req));
    await logActivity(
      user.id,
      "key",
      "Активация ключа",
      String(result.duration_days)
    );

    if (result.referral) {
      await notifyUser(
        result.referral.userId,
        {
          type: "referral",
          title: `+${result.referral.bonus} ₽ и +${result.referral.sc} SC реферальных`,
          body: `${user.username} активировал ключ, вам начислено 15% от его стоимости и SC-бонус.`,
          link: "/dashboard",
        },
        { email: true }
      ).catch(() => {});
    }

    return NextResponse.json({
      ok: true,
      subscription_end: result.subscription_end,
      duration_days: result.duration_days,
    });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
