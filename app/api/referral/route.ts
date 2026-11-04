import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { queryAll, queryOne } from "@/lib/db";
import {
  REFERRAL_KEY_PERCENT,
  REFERRAL_MILESTONE_BONUS,
  REFERRAL_MILESTONE_STEP,
  REFERRAL_SIGNUP_BONUS,
} from "@/lib/keys";
import { SITE_URL } from "@/lib/notify";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

    const invited = await queryAll(
      `SELECT username, created_at, COALESCE(referral_fraud, 0)::int AS referral_fraud
       FROM users
       WHERE referred_by = $1
       ORDER BY created_at DESC`,
      [user.id]
    );

    const totals = (await queryOne(
      `SELECT
         COALESCE(SUM(CASE WHEN type = 'referral' THEN amount ELSE 0 END), 0)::int AS signup_total,
         COALESCE(SUM(CASE WHEN type = 'referral_key' THEN amount ELSE 0 END), 0)::int AS key_total,
         COALESCE(SUM(CASE WHEN type = 'referral_milestone' THEN amount ELSE 0 END), 0)::int AS milestone_total
       FROM balance_history
       WHERE user_id = $1 AND type IN ('referral', 'referral_key', 'referral_milestone')`,
      [user.id]
    )) as { signup_total: number; key_total: number; milestone_total: number } | null;

    const signupTotal = totals?.signup_total ?? 0;
    const keyTotal = totals?.key_total ?? 0;
    const milestoneTotal = totals?.milestone_total ?? 0;
    const validInvited = invited.filter((i) => !i.referral_fraud).length;
    const toNextMilestone =
      REFERRAL_MILESTONE_STEP - (validInvited % REFERRAL_MILESTONE_STEP);

    return NextResponse.json({
      ok: true,
      link: `${SITE_URL}/register?ref=${encodeURIComponent(user.username)}`,
      rules: {
        signup_bonus: REFERRAL_SIGNUP_BONUS,
        key_percent: Math.round(REFERRAL_KEY_PERCENT * 100),
        milestone_step: REFERRAL_MILESTONE_STEP,
        milestone_bonus: REFERRAL_MILESTONE_BONUS,
      },
      stats: {
        invited: invited.length,
        valid_invited: validInvited,
        fraud_invited: invited.length - validInvited,
        signup_total: signupTotal,
        key_total: keyTotal,
        milestone_total: milestoneTotal,
        total: signupTotal + keyTotal + milestoneTotal,
        next_milestone_in: toNextMilestone === REFERRAL_MILESTONE_STEP ? 0 : toNextMilestone,
      },
      invited,
    });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
