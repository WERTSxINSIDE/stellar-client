import { queryAll, queryOne, withTransaction } from "./db";
import { grantCoins } from "./coins";
import { roleWeight } from "./clans";
import { logClanActivity } from "./clan-service";

/**
 * Еженедельные клановые миссии.
 * Прогресс общий для клана, награду в SC получает каждый участник.
 * Забрать награду может офицер и выше, один раз за неделю.
 */

export type ClanMissionMetric = "messages" | "xp" | "rewards" | "members";

export type ClanMissionTemplate = {
  key: string;
  titleRu: string;
  titleEn: string;
  descRu: string;
  descEn: string;
  icon: string;
  reward: number;
  target: number;
  metric: ClanMissionMetric;
};

export const CLAN_MISSIONS: ClanMissionTemplate[] = [
  {
    key: "weekly_chat",
    titleRu: "Живой чат",
    titleEn: "Live chat",
    descRu: "50 сообщений в клановом чате за неделю.",
    descEn: "50 messages in the clan chat this week.",
    icon: "💬",
    reward: 40,
    target: 50,
    metric: "messages",
  },
  {
    key: "weekly_xp",
    titleRu: "Общий прогресс",
    titleEn: "Shared progress",
    descRu: "Заработать 120 XP клана за неделю.",
    descEn: "Earn 120 clan XP this week.",
    icon: "⚡",
    reward: 60,
    target: 120,
    metric: "xp",
  },
  {
    key: "weekly_rewards",
    titleRu: "Дисциплина",
    titleEn: "Discipline",
    descRu: "Забрать 5 ежедневных наград участниками клана.",
    descEn: "Claim 5 daily rewards by clan members.",
    icon: "🎁",
    reward: 40,
    target: 5,
    metric: "rewards",
  },
  {
    key: "weekly_members",
    titleRu: "Сильный состав",
    titleEn: "Strong roster",
    descRu: "Собрать в клане минимум 5 участников.",
    descEn: "Have at least 5 members in the clan.",
    icon: "🛡️",
    reward: 30,
    target: 5,
    metric: "members",
  },
];

export const CLAN_MISSION_MIN_MEMBERS = 3;
/** Награду за миссию может забрать офицер и выше. */
export const CLAN_MISSION_CLAIM_WEIGHT = 60;

export const CLAN_MISSION_WEEK_REWARD = CLAN_MISSIONS.reduce(
  (sum, mission) => sum + mission.reward,
  0
);

type ProgressRow = {
  messages: number;
  xp: number;
  rewards: number;
  members: number;
  week_start: string;
};

type ClanMissionState = {
  missions: {
    key: string;
    title_ru: string;
    title_en: string;
    desc_ru: string;
    desc_en: string;
    icon: string;
    reward: number;
    target: number;
    progress: number;
    claimed: boolean;
    claimable: boolean;
  }[];
  member_count: number;
  week_start: string;
  resets_at: string;
  week_reward: number;
  claimed_reward: number;
  claimable_reward: number;
  min_members: number;
  viewer_can_claim: boolean;
};

async function getProgress(clanId: number): Promise<ProgressRow> {
  const row = (await queryOne(
    `SELECT
       (SELECT COUNT(*)::int FROM clan_messages
         WHERE clan_id = $1 AND created_at >= date_trunc('week', CURRENT_DATE)) AS messages,
       (SELECT COALESCE(SUM(points), 0)::int FROM clan_activity
         WHERE clan_id = $1 AND created_at >= date_trunc('week', CURRENT_DATE)) AS xp,
       (SELECT COUNT(*)::int FROM daily_rewards dr
         JOIN clan_members cm ON cm.user_id = dr.user_id
         WHERE cm.clan_id = $1 AND dr.last_claim >= date_trunc('week', CURRENT_DATE)::date) AS rewards,
       (SELECT COUNT(*)::int FROM clan_members WHERE clan_id = $1) AS members,
       date_trunc('week', CURRENT_DATE)::date::text AS week_start`,
    [clanId]
  )) as ProgressRow | null;

  return (
    row ?? { messages: 0, xp: 0, rewards: 0, members: 0, week_start: "" }
  );
}

function metricValue(metric: ClanMissionMetric, progress: ProgressRow): number {
  switch (metric) {
    case "messages":
      return Number(progress.messages) || 0;
    case "xp":
      return Number(progress.xp) || 0;
    case "rewards":
      return Number(progress.rewards) || 0;
    case "members":
      return Number(progress.members) || 0;
    default:
      return 0;
  }
}

/** Полное состояние миссий клана для конкретной роли зрителя. */
export async function buildClanMissions(
  clanId: number,
  role: string | null | undefined
): Promise<ClanMissionState> {
  const progress = await getProgress(clanId);
  const claimedRows = await queryAll(
    `SELECT mission_key FROM clan_mission_claims
     WHERE clan_id = $1 AND week_start = date_trunc('week', CURRENT_DATE)::date`,
    [clanId]
  );
  const claimed = new Set(claimedRows.map((row) => String(row.mission_key)));
  const viewerCanClaim = roleWeight(role) >= CLAN_MISSION_CLAIM_WEIGHT;

  const missions = CLAN_MISSIONS.map((mission) => {
    const value = metricValue(mission.metric, progress);
    const isClaimed = claimed.has(mission.key);
    const done = value >= mission.target;
    return {
      key: mission.key,
      title_ru: mission.titleRu,
      title_en: mission.titleEn,
      desc_ru: mission.descRu,
      desc_en: mission.descEn,
      icon: mission.icon,
      reward: mission.reward,
      target: mission.target,
      progress: isClaimed ? mission.target : Math.min(value, mission.target),
      claimed: isClaimed,
      claimable:
        !isClaimed &&
        done &&
        progress.members >= CLAN_MISSION_MIN_MEMBERS &&
        viewerCanClaim,
    };
  });

  const claimedReward = missions
    .filter((mission) => mission.claimed)
    .reduce((sum, mission) => sum + mission.reward, 0);
  const claimableReward = missions
    .filter((mission) => mission.claimable)
    .reduce((sum, mission) => sum + mission.reward, 0);

  const weekStart = progress.week_start
    ? new Date(`${progress.week_start}T00:00:00.000Z`)
    : new Date();
  const resets = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

  return {
    missions,
    member_count: Number(progress.members) || 0,
    week_start: progress.week_start,
    resets_at: resets.toISOString(),
    week_reward: CLAN_MISSION_WEEK_REWARD,
    claimed_reward: claimedReward,
    claimable_reward: claimableReward,
    min_members: CLAN_MISSION_MIN_MEMBERS,
    viewer_can_claim: viewerCanClaim,
  };
}

export type ClaimMissionResult =
  | { kind: "ok"; reward: number; distributed: number; balance: number }
  | { kind: "already" }
  | { kind: "not_ready" }
  | { kind: "too_few_members" }
  | { kind: "no_permission" };

/** Забирает награду миссии и раздаёт SC всем участникам клана. */
export async function claimClanMission(
  clanId: number,
  userId: number,
  role: string | null | undefined,
  missionKey: string
): Promise<ClaimMissionResult> {
  const mission = CLAN_MISSIONS.find((item) => item.key === missionKey);
  if (!mission) return { kind: "not_ready" };
  if (roleWeight(role) < CLAN_MISSION_CLAIM_WEIGHT) {
    return { kind: "no_permission" };
  }

  const progress = await getProgress(clanId);
  if (progress.members < CLAN_MISSION_MIN_MEMBERS) {
    return { kind: "too_few_members" };
  }
  if (metricValue(mission.metric, progress) < mission.target) {
    return { kind: "not_ready" };
  }

  return withTransaction(async (client) => {
    const inserted = await client.query(
      `INSERT INTO clan_mission_claims (clan_id, mission_key, week_start, reward, claimed_by)
       VALUES ($1, $2, date_trunc('week', CURRENT_DATE)::date, $3, $4)
       ON CONFLICT (clan_id, mission_key, week_start) DO NOTHING
       RETURNING mission_key`,
      [clanId, mission.key, mission.reward, userId]
    );
    if (!inserted.rows.length) return { kind: "already" } as const;

    const members = await client.query(
      "SELECT user_id FROM clan_members WHERE clan_id = $1",
      [clanId]
    );

    let balance = 0;
    for (const row of members.rows) {
      const memberId = Number(row.user_id);
      if (!Number.isInteger(memberId) || memberId <= 0) continue;
      balance = await grantCoins(
        memberId,
        mission.reward,
        "clan_mission",
        `Клановая миссия: ${mission.titleRu}`,
        client
      );
    }

    await logClanActivity(
      clanId,
      userId,
      "clan_mission",
      0,
      `Миссия выполнена: ${mission.titleRu} (+${mission.reward} SC каждому)`,
      client
    );

    return {
      kind: "ok",
      reward: mission.reward,
      distributed: members.rows.length,
      balance,
    } as const;
  });
}
