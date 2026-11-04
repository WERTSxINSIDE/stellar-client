import { query, queryAll, queryOne } from "./db";

export type RiskFlagCode =
  | "shared_hwid"
  | "hwid_cluster"
  | "multi_account_ip"
  | "ip_cluster"
  | "ip_hopping"
  | "referral_fraud"
  | "fresh_account_shared_hwid";

export type RiskFlag = {
  code: RiskFlagCode;
  severity: number;
  label: string;
  details: string;
};

export type LinkedAccount = {
  id: number;
  username: string;
  reason: "hwid" | "ip";
  detail: string;
};

export type RiskSnapshot = {
  score: number;
  flags: RiskFlag[];
  linked: LinkedAccount[];
};

type RiskUserRow = {
  id: number;
  username: string;
  hwid: string | null;
  signup_ip: string | null;
  last_ip: string | null;
  referral_fraud: number | null;
  created_at: string | Date | null;
};

function normalize(value: string | null | undefined): string {
  return String(value || "").trim();
}

function parseFlags(raw: unknown): RiskFlag[] {
  if (!raw) return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? (parsed as RiskFlag[]) : [];
  } catch {
    return [];
  }
}

function daysSince(value: string | Date | null): number {
  if (!value) return 9999;
  const date = value instanceof Date ? value : new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return 9999;
  return (Date.now() - date.getTime()) / 86_400_000;
}

/** Считает риск по HWID, IP и реферальным флагам. */
export async function computeUserRisk(userId: number): Promise<RiskSnapshot> {
  const user = (await queryOne(
    `SELECT id, username, hwid, signup_ip, last_ip, referral_fraud, created_at
     FROM users WHERE id = $1`,
    [userId]
  )) as RiskUserRow | null;

  if (!user) return { score: 0, flags: [], linked: [] };

  const flags: RiskFlag[] = [];
  const linked = new Map<number, LinkedAccount>();
  const hwid = normalize(user.hwid);

  if (hwid) {
    const sameHwid = (await queryAll(
      `SELECT id, username FROM users
       WHERE id <> $1 AND hwid = $2
       ORDER BY id LIMIT 20`,
      [user.id, hwid]
    )) as { id: number; username: string }[];

    if (sameHwid.length) {
      const severity = Math.min(70, 40 + (sameHwid.length - 1) * 10);
      flags.push({
        code: sameHwid.length > 1 ? "hwid_cluster" : "shared_hwid",
        severity,
        label: sameHwid.length > 1 ? "Кластер HWID" : "Общий HWID",
        details: `HWID используется ещё ${sameHwid.length} акк.: ${sameHwid
          .map((u) => u.username)
          .join(", ")}`,
      });
      for (const other of sameHwid) {
        linked.set(other.id, {
          id: other.id,
          username: other.username,
          reason: "hwid",
          detail: hwid.slice(0, 24),
        });
      }

      if (daysSince(user.created_at) < 14) {
        flags.push({
          code: "fresh_account_shared_hwid",
          severity: 15,
          label: "Новый аккаунт на общем HWID",
          details: "Аккаунт создан меньше 14 дней назад и уже делит HWID",
        });
      }
    }
  }

  // Собираем IP пользователя: регистрация, последний вход и сессии за 30 дней.
  const sessionIps = (await queryAll(
    `SELECT DISTINCT ip FROM sessions
     WHERE user_id = $1 AND ip IS NOT NULL AND ip <> ''
       AND created_at > NOW() - INTERVAL '30 days'`,
    [user.id]
  )) as { ip: string }[];

  const ips = Array.from(
    new Set(
      [user.signup_ip, user.last_ip, ...sessionIps.map((r) => r.ip)]
        .map(normalize)
        .filter(Boolean)
    )
  );

  for (const ip of ips) {
    const bySignup = (await queryAll(
      `SELECT id, username FROM users
       WHERE id <> $1 AND (signup_ip = $2 OR last_ip = $2)
       LIMIT 20`,
      [user.id, ip]
    )) as { id: number; username: string }[];

    const bySession = (await queryAll(
      `SELECT DISTINCT u.id, u.username
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.user_id <> $1 AND s.ip = $2
       LIMIT 20`,
      [user.id, ip]
    )) as { id: number; username: string }[];

    const others = new Map<number, string>();
    for (const row of [...bySignup, ...bySession]) others.set(row.id, row.username);

    if (others.size >= 2) {
      flags.push({
        code: "ip_cluster",
        severity: Math.min(40, 20 + others.size * 5),
        label: "Кластер IP",
        details: `IP ${ip} используют ещё ${others.size} акк.: ${Array.from(others.values())
          .slice(0, 8)
          .join(", ")}`,
      });
    } else if (others.size === 1) {
      const only = Array.from(others.entries())[0];
      flags.push({
        code: "multi_account_ip",
        severity: 15,
        label: "Общий IP",
        details: `IP ${ip} совпадает с аккаунтом ${only[1]}`,
      });
    }

    for (const [id, username] of others) {
      if (!linked.has(id)) {
        linked.set(id, { id, username, reason: "ip", detail: ip });
      }
    }
  }

  // Много разных IP за неделю — похоже на передачу аккаунта или VPN.
  const recentIps = (await queryAll(
    `SELECT COUNT(DISTINCT ip)::int AS count
     FROM sessions
     WHERE user_id = $1 AND created_at > NOW() - INTERVAL '7 days'
       AND ip IS NOT NULL AND ip <> ''`,
    [user.id]
  )) as { count: number }[];
  const distinctIps = Number(recentIps[0]?.count ?? 0);
  if (distinctIps >= 5) {
    flags.push({
      code: "ip_hopping",
      severity: Math.min(30, 10 + distinctIps * 2),
      label: "Частая смена IP",
      details: `${distinctIps} разных IP за 7 дней`,
    });
  }

  if (Number(user.referral_fraud) === 1) {
    flags.push({
      code: "referral_fraud",
      severity: 40,
      label: "Реферальный фрод",
      details: "Приглашённый зарегистрировался с того же IP",
    });
  }

  const score = Math.min(
    100,
    flags.reduce((sum, flag) => sum + flag.severity, 0)
  );

  return {
    score,
    flags,
    linked: Array.from(linked.values()).sort((a, b) => a.username.localeCompare(b.username)),
  };
}

/**
 * Пересчитывает риск и сохраняет его в users.
 * Новые флаги пишутся в risk_events, исчезнувшие — закрываются.
 */
export async function refreshUserRisk(userId: number, ip?: string | null): Promise<RiskSnapshot> {
  if (ip) {
    await query("UPDATE users SET last_ip = $1, last_seen_at = NOW() WHERE id = $2", [ip, userId]);
  }

  const snapshot = await computeUserRisk(userId);
  const previous = (await queryOne(
    "SELECT risk_score, risk_flags FROM users WHERE id = $1",
    [userId]
  )) as { risk_score: number | null; risk_flags: string | null } | null;
  const oldFlags = parseFlags(previous?.risk_flags);
  const oldCodes = new Set(oldFlags.map((flag) => flag.code));
  const newCodes = new Set(snapshot.flags.map((flag) => flag.code));

  await query(
    "UPDATE users SET risk_score = $1, risk_flags = $2 WHERE id = $3",
    [snapshot.score, JSON.stringify(snapshot.flags), userId]
  );

  for (const flag of snapshot.flags) {
    if (!oldCodes.has(flag.code)) {
      await query(
        `INSERT INTO risk_events (user_id, type, severity, details, status)
         VALUES ($1, $2, $3, $4, 'open')`,
        [userId, flag.code, flag.severity, flag.details]
      );
    }
  }

  for (const code of oldCodes) {
    if (!newCodes.has(code)) {
      await query(
        `UPDATE risk_events SET status = 'resolved', resolved_at = NOW()
         WHERE user_id = $1 AND type = $2 AND status = 'open'`,
        [userId, code]
      );
    }
  }

  return snapshot;
}

export async function touchUserNetwork(userId: number, ip: string | null): Promise<void> {
  if (!ip) return;
  await query("UPDATE users SET last_ip = $1, last_seen_at = NOW() WHERE id = $2", [ip, userId]);
}

/** Пересчёт риска не должен ломать вход, если БД или схема временно недоступны. */
export async function safeRefreshUserRisk(userId: number, ip?: string | null): Promise<void> {
  try {
    await refreshUserRisk(userId, ip);
  } catch (e: any) {
    console.error("risk refresh error:", e?.message || e);
  }
}

/** Пересчитывает риск для последних активных пользователей. */
export async function scanAllRisk(limit = 500): Promise<{ scanned: number; flagged: number }> {
  const users = (await queryAll(
    `SELECT id FROM users
     ORDER BY last_seen_at DESC NULLS LAST, created_at DESC
     LIMIT $1`,
    [Math.max(1, Math.min(2000, Math.floor(limit)))]
  )) as { id: number }[];

  let flagged = 0;
  let cursor = 0;
  const workers = Array.from({ length: Math.min(5, users.length) }, async () => {
    while (cursor < users.length) {
      const user = users[cursor++];
      try {
        const snapshot = await refreshUserRisk(user.id);
        if (snapshot.score > 0) flagged++;
      } catch (e: any) {
        console.error("risk scan error:", e?.message || e);
      }
    }
  });
  await Promise.all(workers);

  return { scanned: users.length, flagged };
}

export type RiskOverviewUser = {
  id: number;
  username: string;
  email: string;
  risk_score: number;
  flags: RiskFlag[];
  linked: LinkedAccount[];
  hwid: string | null;
  last_ip: string | null;
  last_seen_at: string | null;
  created_at: string | null;
  banned: number | null;
  subscription_end: string | null;
};

export async function getRiskOverview(): Promise<RiskOverviewUser[]> {
  const rows = (await queryAll(
    `SELECT id, username, email, risk_score, risk_flags, hwid, last_ip,
            last_seen_at, created_at, banned, subscription_end
     FROM users
     WHERE COALESCE(risk_score, 0) > 0
     ORDER BY risk_score DESC, last_seen_at DESC NULLS LAST
     LIMIT 100`
  )) as any[];

  const result: RiskOverviewUser[] = [];
  for (const row of rows) {
    const snapshot = await computeUserRisk(Number(row.id));
    result.push({
      id: Number(row.id),
      username: row.username,
      email: row.email,
      risk_score: Number(row.risk_score) || snapshot.score,
      flags: parseFlags(row.risk_flags).length ? parseFlags(row.risk_flags) : snapshot.flags,
      linked: snapshot.linked,
      hwid: row.hwid,
      last_ip: row.last_ip,
      last_seen_at: row.last_seen_at ? String(row.last_seen_at) : null,
      created_at: row.created_at ? String(row.created_at) : null,
      banned: row.banned ?? 0,
      subscription_end: row.subscription_end ?? null,
    });
  }
  return result;
}

export async function getRiskStats() {
  const row = (await queryOne(
    `SELECT
       (SELECT COUNT(*)::int FROM users) AS total_users,
       (SELECT COUNT(*)::int FROM users WHERE COALESCE(risk_score, 0) > 0) AS flagged_users,
       (SELECT COUNT(*)::int FROM users WHERE COALESCE(risk_score, 0) >= 60) AS high_risk,
       (SELECT COUNT(*)::int FROM risk_events WHERE status = 'open') AS open_events`
  )) as any;
  return {
    totalUsers: Number(row?.total_users ?? 0),
    flaggedUsers: Number(row?.flagged_users ?? 0),
    highRisk: Number(row?.high_risk ?? 0),
    openEvents: Number(row?.open_events ?? 0),
  };
}
