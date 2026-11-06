import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { query, queryOne, withTransaction } from "@/lib/db";
import { createSession, getRequestMeta } from "@/lib/auth";
import { emailVerificationEnabled } from "@/lib/email";
import {
  REFERRAL_MILESTONE_BONUS,
  REFERRAL_MILESTONE_SC,
  REFERRAL_MILESTONE_STEP,
  REFERRAL_SIGNUP_BONUS,
  REFERRAL_SIGNUP_SC,
} from "@/lib/keys";
import { notifyUser } from "@/lib/notify";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";
import { safeRefreshUserRisk } from "@/lib/risk";
import {
  DISPOSABLE_EMAIL_ERROR,
  isDisposableEmail,
} from "@/lib/disposable-emails";
import { verifyTurnstile } from "@/lib/turnstile";
import { minecraftNameError, normalizeMinecraftName } from "@/lib/minecraft-name";

export async function POST(req: Request) {
  try {
    const { username: rawUsername, email, password, code, ref, turnstile_token } = await req.json();
    const username = normalizeMinecraftName(rawUsername);

    if (!username || !email || !password) {
      return NextResponse.json({ error: "Заполните все поля" }, { status: 400 });
    }

    // Ник сайта = ник в Minecraft. Без этой проверки игрока с кириллицей
    // или ником длиннее 16 символов сервер встречает `Invalid session`.
    const nameError = minecraftNameError(username);
    if (nameError) {
      return NextResponse.json({ error: nameError }, { status: 400 });
    }
    if (String(password).length < 6) {
      return NextResponse.json({ error: "Пароль должен быть не меньше 6 символов" }, { status: 400 });
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: "Некорректный email" }, { status: 400 });
    }
    if (isDisposableEmail(email)) {
      return NextResponse.json({ error: DISPOSABLE_EMAIL_ERROR }, { status: 400 });
    }

    // Не даём массово создавать аккаунты с одного IP и на один email.
    const limited = await enforceRateLimit(req, [
      { scope: "register:ip", identifier: getClientIp(req), limit: 8, windowMs: 60 * 60_000 },
      {
        scope: "register:email",
        identifier: String(email).toLowerCase(),
        limit: 3,
        windowMs: 60 * 60_000,
      },
    ]);
    if (limited) return limited;

    // Капча проверяется только если заданы ключи Turnstile.
    const captcha = await verifyTurnstile(turnstile_token, getClientIp(req));
    if (!captcha.ok) {
      return NextResponse.json({ error: captcha.error }, { status: 400 });
    }

    const exists = await queryOne("SELECT id FROM users WHERE LOWER(username) = LOWER($1) OR email = $2", [username, email]);
    if (exists) {
      return NextResponse.json({ error: "Пользователь с таким именем или email уже существует" }, { status: 409 });
    }

    const lower = String(email).toLowerCase();

    if (emailVerificationEnabled()) {
      if (!code) {
        return NextResponse.json({ error: "Введите код с почты" }, { status: 400 });
      }

      const row = await queryOne(
        `SELECT id, code, attempts, EXTRACT(EPOCH FROM (NOW() - created_at))::int AS age
         FROM email_codes WHERE email = $1 AND purpose = 'register' ORDER BY created_at DESC LIMIT 1`,
        [lower]
      ) as any;

      if (!row) {
        return NextResponse.json({ error: "Код не запрашивался. Нажмите «Получить код»." }, { status: 400 });
      }
      if (row.age > 600) {
        return NextResponse.json({ error: "Код истёк. Запросите новый." }, { status: 400 });
      }
      if (row.attempts >= 5) {
        return NextResponse.json({ error: "Слишком много неверных попыток. Запросите новый код." }, { status: 429 });
      }
      if (String(code).trim() !== row.code) {
        await query("UPDATE email_codes SET attempts = attempts + 1 WHERE id = $1", [row.id]);
        const left = 5 - (row.attempts + 1);
        return NextResponse.json(
          { error: left > 0 ? `Неверный код. Осталось попыток: ${left}` : "Слишком много неверных попыток. Запросите новый код." },
          { status: 400 }
        );
      }

      await query("DELETE FROM email_codes WHERE email = $1 AND purpose = 'register'", [lower]);
    }

    const referralName = typeof ref === "string" ? ref.trim() : "";
    const { ip: signupIp } = await getRequestMeta();
    const hash = await bcrypt.hash(password, 10);

    const outcome = await withTransaction(async (client) => {
      let referrer: { id: number; username: string; signup_ip: string | null } | null = null;
      let partnerCodeId: number | null = null;

      if (referralName) {
        const found = await client.query(
          "SELECT id, username, signup_ip FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1 FOR UPDATE",
          [referralName]
        );
        referrer = found.rows[0] ?? null;

        // Партнёрские/авторские коды: ссылка ?ref=CODE привязывает к владельцу кода.
        if (!referrer) {
          const codeRow = await client.query(
            `SELECT dc.id, dc.owner_id, u.username, u.signup_ip
             FROM discount_codes dc
             JOIN users u ON u.id = dc.owner_id
             WHERE dc.code = $1 AND dc.active = 1
             LIMIT 1`,
            [referralName.toUpperCase()]
          );
          if (codeRow.rows[0]) {
            referrer = {
              id: Number(codeRow.rows[0].owner_id),
              username: String(codeRow.rows[0].username),
              signup_ip: codeRow.rows[0].signup_ip ?? null,
            };
            partnerCodeId = Number(codeRow.rows[0].id);
          }
        }
      }

      // Антифрод: регистрация с того же IP, что у пригласившего, бонусов не даёт.
      let referralFraud = false;
      if (referrer && signupIp) {
        if (referrer.signup_ip && referrer.signup_ip === signupIp) {
          referralFraud = true;
        } else {
          const sameIp = await client.query(
            "SELECT 1 FROM sessions WHERE user_id = $1 AND ip = $2 LIMIT 1",
            [referrer.id, signupIp]
          );
          if (sameIp.rows.length) referralFraud = true;
        }
      }

      const result = await client.query(
        `INSERT INTO users (username, email, password, referred_by, signup_ip, referral_fraud)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [username, email, hash, referrer?.id ?? null, signupIp, referralFraud ? 1 : 0]
      );
      const newUserId = Number(result.rows[0].id);

      let milestoneBonus = 0;
      let milestoneSc = 0;

      if (referrer && referrer.id !== newUserId && !referralFraud) {
        if (partnerCodeId) {
          await client.query(
            "UPDATE discount_codes SET signups = COALESCE(signups, 0) + 1 WHERE id = $1",
            [partnerCodeId]
          );
        }
        await client.query(
          "UPDATE users SET balance = COALESCE(balance, 0) + $1 WHERE id = $2",
          [REFERRAL_SIGNUP_BONUS, referrer.id]
        );
        await client.query(
          "INSERT INTO balance_history (user_id, amount, type, note) VALUES ($1, $2, 'referral', $3)",
          [referrer.id, REFERRAL_SIGNUP_BONUS, `Регистрация по реферальной ссылке: ${username}`]
        );

        // Параллельная SC-награда за приглашение.
        await client.query(
          "UPDATE users SET sc_coins = COALESCE(sc_coins, 0) + $1 WHERE id = $2",
          [REFERRAL_SIGNUP_SC, referrer.id]
        );
        await client.query(
          "INSERT INTO coin_transactions (user_id, amount, type, note) VALUES ($1, $2, 'referral_signup', $3)",
          [referrer.id, REFERRAL_SIGNUP_SC, `Реферал: ${username}`]
        );

        // Бонус за каждые N успешных приглашений. Учитываем только не фрод.
        const counted = await client.query(
          `SELECT COUNT(*)::int AS invited
           FROM users WHERE referred_by = $1 AND COALESCE(referral_fraud, 0) = 0`,
          [referrer.id]
        );
        const invited = Number(counted.rows[0]?.invited ?? 0);

        const awardedRow = await client.query(
          `SELECT COUNT(*)::int AS awarded
           FROM balance_history WHERE user_id = $1 AND type = 'referral_milestone'`,
          [referrer.id]
        );
        const awarded = Number(awardedRow.rows[0]?.awarded ?? 0);
        const target = Math.floor(invited / REFERRAL_MILESTONE_STEP);

        if (target > awarded) {
          milestoneBonus = (target - awarded) * REFERRAL_MILESTONE_BONUS;
          milestoneSc = (target - awarded) * REFERRAL_MILESTONE_SC;
          await client.query(
            "UPDATE users SET balance = COALESCE(balance, 0) + $1 WHERE id = $2",
            [milestoneBonus, referrer.id]
          );
          await client.query(
            "UPDATE users SET sc_coins = COALESCE(sc_coins, 0) + $1 WHERE id = $2",
            [milestoneSc, referrer.id]
          );
          for (let step = awarded + 1; step <= target; step++) {
            await client.query(
              "INSERT INTO balance_history (user_id, amount, type, note) VALUES ($1, $2, 'referral_milestone', $3)",
              [
                referrer.id,
                REFERRAL_MILESTONE_BONUS,
                `${step * REFERRAL_MILESTONE_STEP} приглашённых`,
              ]
            );
            await client.query(
              "INSERT INTO coin_transactions (user_id, amount, type, note) VALUES ($1, $2, 'referral_milestone', $3)",
              [
                referrer.id,
                REFERRAL_MILESTONE_SC,
                `${step * REFERRAL_MILESTONE_STEP} приглашённых (SC)`,
              ]
            );
          }
        }
      }

      return { newUserId, referrer, referralFraud, milestoneBonus, milestoneSc };
    });

    await createSession(outcome.newUserId);
    await safeRefreshUserRisk(outcome.newUserId, signupIp);

    if (outcome.referrer && outcome.referrer.id !== outcome.newUserId && !outcome.referralFraud) {
      await notifyUser(
        outcome.referrer.id,
        {
          type: "referral",
          title: `+${REFERRAL_SIGNUP_BONUS} ₽ и +${REFERRAL_SIGNUP_SC} SC за приглашённого`,
          body: `${username} зарегистрировался по вашей реферальной ссылке.`,
          link: "/dashboard",
        },
        { email: true }
      ).catch(() => {});

      if (outcome.milestoneBonus > 0) {
        await notifyUser(
          outcome.referrer.id,
          {
            type: "referral",
            title: `+${outcome.milestoneBonus} ₽ и +${outcome.milestoneSc} SC за приглашения`,
            body: `Вы пригласили ещё ${REFERRAL_MILESTONE_STEP} человек — бонус за ступень начислен.`,
            link: "/dashboard",
          },
          { email: true }
        ).catch(() => {});
      }
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
