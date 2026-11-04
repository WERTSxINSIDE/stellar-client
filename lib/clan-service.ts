import { query, queryOne, type DbExecutor } from "./db";
import {
  clanBonusPercent,
  clanLevel,
  clanMaxMembers,
} from "./clans";

export type ClanRow = {
  id: number;
  name: string;
  tag: string;
  description: string | null;
  emblem: string;
  color: string;
  leader_id: number;
  xp: number;
  treasury: number;
  recruiting: number;
  created_at: string;
  leader_name?: string;
  leader_avatar?: string | null;
  member_count?: number;
  role_count?: number;
  pending_count?: number;
};

export type ClanView = ClanRow & {
  level: number;
  max_members: number;
  bonus_percent: number;
};

export function enrichClan(row: ClanRow): ClanView {
  const level = clanLevel(row.xp);
  const memberCount = Number(row.member_count || 0);
  const roleCount = Number(row.role_count || 0);
  return {
    ...row,
    xp: Number(row.xp) || 0,
    treasury: Number(row.treasury) || 0,
    member_count: memberCount,
    role_count: roleCount,
    level,
    max_members: clanMaxMembers(level),
    bonus_percent: clanBonusPercent(memberCount, roleCount),
  };
}

const CLAN_SELECT = `
  SELECT c.*, u.username AS leader_name, u.avatar_url AS leader_avatar,
         (SELECT COUNT(*)::int FROM clan_members cm WHERE cm.clan_id = c.id) AS member_count,
         (SELECT COUNT(DISTINCT cm.role)::int FROM clan_members cm WHERE cm.clan_id = c.id) AS role_count,
         (SELECT COUNT(*)::int FROM clan_applications ca
           WHERE ca.clan_id = c.id AND ca.status = 'pending') AS pending_count
  FROM clans c
  JOIN users u ON u.id = c.leader_id
`;

export async function getClanById(id: number): Promise<ClanView | null> {
  const row = (await queryOne(`${CLAN_SELECT} WHERE c.id = $1`, [id])) as ClanRow | null;
  return row ? enrichClan(row) : null;
}

export type MembershipRow = {
  user_id: number;
  clan_id: number;
  role: string;
  contribution: number;
  weekly_points: number;
  joined_at: string;
};

export async function getMembership(userId: number): Promise<MembershipRow | null> {
  return (await queryOne(
    `SELECT user_id, clan_id, role, contribution, weekly_points, joined_at
     FROM clan_members WHERE user_id = $1`,
    [userId]
  )) as MembershipRow | null;
}

export type ClanBonusInfo = {
  clan_id: number;
  name: string;
  tag: string;
  percent: number;
  level: number;
};

/** Бонус к SC за состав клана для конкретного пользователя. */
export async function getClanBonus(userId: number): Promise<ClanBonusInfo | null> {
  const row = (await queryOne(
    `SELECT c.id AS clan_id, c.name, c.tag, c.xp,
            (SELECT COUNT(*)::int FROM clan_members cm2 WHERE cm2.clan_id = c.id) AS member_count,
            (SELECT COUNT(DISTINCT cm2.role)::int FROM clan_members cm2 WHERE cm2.clan_id = c.id) AS role_count
     FROM clan_members cm
     JOIN clans c ON c.id = cm.clan_id
     WHERE cm.user_id = $1`,
    [userId]
  )) as
    | { clan_id: number; name: string; tag: string; xp: number; member_count: number; role_count: number }
    | null;

  if (!row) return null;

  return {
    clan_id: row.clan_id,
    name: row.name,
    tag: row.tag,
    percent: clanBonusPercent(Number(row.member_count) || 0, Number(row.role_count) || 0),
    level: clanLevel(Number(row.xp) || 0),
  };
}

/**
 * Пишет событие клана, начисляет XP и обновляет активность участника.
 * Можно передать транзакционный клиент, чтобы всё попало в общую транзакцию.
 */
export async function logClanActivity(
  clanId: number,
  userId: number | null,
  type: string,
  points: number,
  note?: string,
  db?: DbExecutor
): Promise<void> {
  const value = Math.max(0, Math.floor(Number(points) || 0));
  const executor = db || ({ query } as DbExecutor);

  await executor.query(
    "INSERT INTO clan_activity (clan_id, user_id, type, points, note) VALUES ($1, $2, $3, $4, $5)",
    [clanId, userId, type, value, note || null]
  );

  if (value > 0) {
    await executor.query("UPDATE clans SET xp = COALESCE(xp, 0) + $2 WHERE id = $1", [clanId, value]);
    if (userId) {
      await executor.query(
        `UPDATE clan_members
         SET weekly_points = weekly_points + $2, last_active_at = NOW()
         WHERE user_id = $1 AND clan_id = $3`,
        [userId, value, clanId]
      );
    }
  } else if (userId) {
    await executor.query(
      "UPDATE clan_members SET last_active_at = NOW() WHERE user_id = $1 AND clan_id = $2",
      [userId, clanId]
    );
  }
}
