import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function initDb() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id         SERIAL PRIMARY KEY,
        username   TEXT UNIQUE NOT NULL,
        email      TEXT UNIQUE NOT NULL,
        password   TEXT NOT NULL,
        subscription_end TEXT,
        hwid       TEXT,
        is_admin   INTEGER DEFAULT 0,
        role       TEXT DEFAULT 'user',
        banned     INTEGER DEFAULT 0,
        ban_reason TEXT,
        beta_access INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS sessions (
        token      TEXT PRIMARY KEY,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS keys (
        id            SERIAL PRIMARY KEY,
        key           TEXT UNIQUE NOT NULL,
        duration_days INTEGER NOT NULL,
        activated_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
        activated_at  TEXT,
        created_at    TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS news (
        id         SERIAL PRIMARY KEY,
        title      TEXT NOT NULL,
        content    TEXT NOT NULL,
        tag        TEXT DEFAULT 'Новость',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS media_submissions (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        video_url  TEXT NOT NULL,
        status     TEXT DEFAULT 'pending',
        reward     INTEGER DEFAULT 0,
        admin_note TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS partner_applications (
        id           SERIAL PRIMARY KEY,
        user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        platform     TEXT NOT NULL,
        channel_link TEXT NOT NULL,
        telegram     TEXT NOT NULL,
        views        TEXT NOT NULL,
        experience   TEXT,
        reason       TEXT NOT NULL,
        status       TEXT DEFAULT 'pending',
        created_at   TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS balance_history (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount     INTEGER NOT NULL,
        type       TEXT NOT NULL,
        note       TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS play_sessions (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        started_at TIMESTAMP DEFAULT NOW(),
        ended_at   TIMESTAMP,
        seconds    INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS daily_rewards (
        user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        streak_day INTEGER DEFAULT 0,
        last_claim DATE
      );

      CREATE TABLE IF NOT EXISTS support_tickets (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        subject    TEXT NOT NULL,
        status     TEXT DEFAULT 'open',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS bug_reports (
        id           SERIAL PRIMARY KEY,
        user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        server_ip    TEXT NOT NULL,
        function_name TEXT NOT NULL,
        frequency    TEXT NOT NULL,
        description  TEXT NOT NULL,
        status       TEXT DEFAULT 'new',
        created_at   TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS support_messages (
        id         SERIAL PRIMARY KEY,
        ticket_id  INTEGER NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
        user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
        is_admin   INTEGER DEFAULT 0,
        body       TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_keys_key ON keys(key);
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_balance_history_user ON balance_history(user_id);
      CREATE INDEX IF NOT EXISTS idx_play_sessions_user ON play_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON support_tickets(user_id);
      CREATE INDEX IF NOT EXISTS idx_support_messages_ticket ON support_messages(ticket_id);
      CREATE INDEX IF NOT EXISTS idx_bug_reports_user ON bug_reports(user_id);
    `);

    await pool.query(`
      DO $$ BEGIN
        ALTER TABLE users ADD COLUMN balance INTEGER DEFAULT 0;
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);

    await pool.query(`
      DO $$ BEGIN
        ALTER TABLE users ADD COLUMN partner_rank TEXT DEFAULT 'Младший партнёр';
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);

    await pool.query(`
      DO $$ BEGIN
        ALTER TABLE users ADD COLUMN last_gift_at TIMESTAMP;
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);

    await pool.query(`
      DO $$ BEGIN
        ALTER TABLE media_submissions ADD COLUMN views INTEGER DEFAULT 0;
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);
    console.log("DB tables initialized");
  } catch (e: any) {
    console.error("DB init error:", e.message);
  }
}

initDb();

export async function query(text: string, params?: any[]) {
  const result = await pool.query(text, params);
  return result;
}

export async function queryOne(text: string, params?: any[]) {
  const result = await pool.query(text, params);
  return result.rows[0] ?? null;
}

export async function queryAll(text: string, params?: any[]) {
  const result = await pool.query(text, params);
  return result.rows;
}

export const PARTNER_VIDEOS_YOUTUBE = 7;
export const PARTNER_VIDEOS_TIKTOK = 10;
export const PARTNER_VIEWS_YOUTUBE = 5000;
export const PARTNER_VIEWS_TIKTOK = 15000;

export function partnerThresholds(platform?: string | null) {
  const tiktok = platform === "tiktok";
  return {
    videos: tiktok ? PARTNER_VIDEOS_TIKTOK : PARTNER_VIDEOS_YOUTUBE,
    views: tiktok ? PARTNER_VIEWS_TIKTOK : PARTNER_VIEWS_YOUTUBE,
  };
}

export async function recomputePartnerRank(userId: number) {
  const pa = await queryOne(
    `SELECT platform FROM partner_applications
     WHERE user_id = $1 AND status = 'approved'
     ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );
  const platform = (pa?.platform as string) ?? null;
  const { videos: videoThreshold, views: viewsThreshold } = partnerThresholds(platform);

  const stat = await queryOne(
    `SELECT COUNT(*)::int AS approved,
            COALESCE(SUM(reward), 0)::int AS earned,
            COALESCE(SUM(views), 0)::int AS total_views
     FROM media_submissions WHERE user_id = $1 AND status = 'approved'`,
    [userId]
  );
  const approved = (stat?.approved as number) ?? 0;
  const earned = (stat?.earned as number) ?? 0;
  const totalViews = (stat?.total_views as number) ?? 0;

  const rank =
    approved >= videoThreshold && totalViews >= viewsThreshold
      ? "Партнёр"
      : "Младший партнёр";

  await query("UPDATE users SET partner_rank = $1 WHERE id = $2", [rank, userId]);
  return { rank, approved, earned, totalViews, videoThreshold, viewsThreshold, platform };
}

export async function addBalanceHistory(userId: number, amount: number, type: string, note?: string) {
  await pool.query(
    "INSERT INTO balance_history (user_id, amount, type, note) VALUES ($1, $2, $3, $4)",
    [userId, amount, type, note || null]
  );
}

export default pool;

export type User = {
  id: number;
  username: string;
  email: string;
  password: string;
  subscription_end: string | null;
  hwid: string | null;
  is_admin: number;
  role: string;
  banned: number;
  ban_reason: string | null;
  beta_access: number;
  balance: number;
  partner_rank: string;
  created_at: string;
};

export type LicenseKey = {
  id: number;
  key: string;
  duration_days: number;
  activated_by: number | null;
  activated_at: string | null;
  created_at: string;
};
