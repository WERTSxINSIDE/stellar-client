import { queryAll, queryOne } from "./db";
import { ACHIEVEMENTS, computeAchievements, type AchievementStats } from "./achievements";

const DAY_MS = 24 * 60 * 60 * 1000;
const LIFETIME_THRESHOLD_MS = 10 * 365 * DAY_MS;

const STATS_SELECT = `
  u.subscription_end,
  u.created_at,
  COALESCE((SELECT SUM(-amount) FROM balance_history
            WHERE user_id = u.id AND amount < 0 AND type IN ('subscription', 'hwid')), 0)::int AS total_spent,
  COALESCE((SELECT COUNT(*) FROM balance_history
            WHERE user_id = u.id AND amount < 0 AND type IN ('subscription', 'hwid')), 0)::int AS purchases,
  COALESCE((SELECT COUNT(*) FROM balance_history
            WHERE user_id = u.id AND type = 'transfer' AND amount < 0), 0)::int AS transfers_sent,
  COALESCE((SELECT COUNT(*) FROM balance_history
            WHERE user_id = u.id AND type = 'wheel'), 0)::int AS wheel_wins,
  COALESCE((SELECT COUNT(*) FROM balance_history
            WHERE user_id = u.id AND type = 'reward'), 0)::int AS daily_claims,
  COALESCE((SELECT streak_day FROM daily_rewards WHERE user_id = u.id), 0)::int AS daily_streak,
  COALESCE((SELECT SUM(seconds) FROM play_sessions WHERE user_id = u.id), 0)::int AS play_seconds,
  COALESCE((SELECT COUNT(*) FROM reviews WHERE user_id = u.id), 0)::int AS reviews,
  COALESCE((SELECT COUNT(*) FROM media_submissions
            WHERE user_id = u.id AND status = 'approved'), 0)::int AS media_approved,
  COALESCE((SELECT COUNT(*) FROM partner_applications
            WHERE user_id = u.id AND status = 'approved'), 0)::int AS partner_approved,
  COALESCE((SELECT COUNT(*) FROM bug_reports WHERE user_id = u.id), 0)::int AS bugs,
  COALESCE((SELECT COUNT(*) FROM support_tickets WHERE user_id = u.id), 0)::int AS tickets,
  COALESCE((SELECT COUNT(*) FROM balance_history
            WHERE user_id = u.id AND type = 'hwid'), 0)::int AS hwid_resets
`;

export function toDate(value: unknown): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value).replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Собирает статистику пользователя для расчёта достижений.
 * Возвращает null, если пользователя нет.
 */
export async function getAchievementStats(userId: number): Promise<AchievementStats | null> {
  const row = (await queryOne(
    `SELECT ${STATS_SELECT}
     FROM users u
     WHERE u.id = $1`,
    [userId]
  )) as Record<string, unknown> | null;

  return row ? rowToStats(row) : null;
}

function rowToStats(row: Record<string, unknown>): AchievementStats {
  const now = Date.now();
  const subEnd = toDate(row.subscription_end);
  const createdAt = toDate(row.created_at);
  const subscriptionDaysLeft = subEnd
    ? Math.max(0, Math.ceil((subEnd.getTime() - now) / DAY_MS))
    : 0;

  return {
    totalSpent: Number(row.total_spent) || 0,
    purchases: Number(row.purchases) || 0,
    transfersSent: Number(row.transfers_sent) || 0,
    wheelWins: Number(row.wheel_wins) || 0,
    dailyClaims: Number(row.daily_claims) || 0,
    dailyStreak: Number(row.daily_streak) || 0,
    playSeconds: Number(row.play_seconds) || 0,
    reviews: Number(row.reviews) || 0,
    mediaApproved: Number(row.media_approved) || 0,
    partnerApproved: Number(row.partner_approved) || 0,
    bugs: Number(row.bugs) || 0,
    tickets: Number(row.tickets) || 0,
    hwidResets: Number(row.hwid_resets) || 0,
    subscriptionDaysLeft,
    hadSubscription: !!row.subscription_end,
    isLifetime: !!subEnd && subEnd.getTime() - now > LIFETIME_THRESHOLD_MS,
    accountAgeDays: createdAt ? Math.max(0, Math.floor((now - createdAt.getTime()) / DAY_MS)) : 0,
  };
}

/**
 * Рейтинг игроков по открытым достижениям (и времени в клиенте как тай-брейк).
 * Считается на лету по тем же правилам, что и страница достижений.
 */
export async function getAchievementLeaderboard(limit = 20) {
  const rows = (await queryAll(
    `SELECT u.id, u.username, ${STATS_SELECT}
     FROM users u
     WHERE COALESCE(u.banned, 0) = 0`
  )) as Record<string, unknown>[];

  return rows
    .map((row) => {
      const stats = rowToStats(row);
      const unlocked = computeAchievements(stats).filter((a) => a.unlocked).length;
      return {
        username: String(row.username),
        achievements: unlocked,
        total: ACHIEVEMENTS.length,
        seconds: stats.playSeconds,
      };
    })
    .sort(
      (a, b) =>
        b.achievements - a.achievements ||
        b.seconds - a.seconds ||
        a.username.localeCompare(b.username, "ru")
    )
    .slice(0, limit);
}

export function isSubscriptionActive(subscriptionEnd: unknown): boolean {
  const date = toDate(subscriptionEnd);
  return !!date && date.getTime() > Date.now();
}
