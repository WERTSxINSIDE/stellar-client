import { Pool, type PoolClient } from "pg";

const connectionString = process.env.DATABASE_URL || "";
const isPooler = connectionString.includes("pooler.supabase.com");

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: isPooler ? 1 : 5,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 10000,
  allowExitOnIdle: true,
});

// Меняем при изменении схемы ниже. Пока версия совпадает,
// инициализация пропускается — это сильно ускоряет холодный старт.
const SCHEMA_VERSION = "2026-11-05-5";

async function isSchemaUpToDate(): Promise<boolean> {
  try {
    const exists = await pool.query("SELECT to_regclass('public.app_meta') AS table_name");
    if (!exists.rows[0]?.table_name) return false;
    const row = await pool.query("SELECT value FROM app_meta WHERE key = 'schema_version'");
    return row.rows[0]?.value === SCHEMA_VERSION;
  } catch {
    return false;
  }
}

async function initDb() {
  try {
    if (await isSchemaUpToDate()) return;
  } catch {
    // если проверка не удалась — идём в полную инициализацию
  }

  let client: PoolClient | null = null;
  try {
    client = await pool.connect();
    // Сериализуем инициализацию схемы между процессами/инстансами,
    // иначе параллельные CREATE TABLE ... IF NOT EXISTS могут конфликтовать.
    await client.query("SELECT pg_advisory_lock(842137642)");
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_meta (
        key   TEXT PRIMARY KEY,
        value TEXT
      );

      CREATE TABLE IF NOT EXISTS telegram_links (
        user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        chat_id    TEXT NOT NULL,
        username   TEXT,
        linked_at  TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_telegram_links_chat ON telegram_links(chat_id);

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
        avatar_url TEXT,
        bio TEXT,
        banner_url TEXT,
        accent_color TEXT,
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

      CREATE TABLE IF NOT EXISTS email_codes (
        id         SERIAL PRIMARY KEY,
        email      TEXT NOT NULL,
        code       TEXT NOT NULL,
        attempts   INTEGER DEFAULT 0,
        used       BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_email_codes_email ON email_codes (email, created_at DESC);

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
        user_id       INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        streak_day    INTEGER DEFAULT 0,
        last_claim    DATE,
        claimed_total INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS support_tickets (
        id             SERIAL PRIMARY KEY,
        user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        subject        TEXT NOT NULL,
        category       TEXT DEFAULT 'other',
        status         TEXT DEFAULT 'open',
        user_unread    INTEGER DEFAULT 0,
        admin_unread   INTEGER DEFAULT 0,
        last_message_by TEXT,
        csat_rating    INTEGER,
        csat_comment   TEXT,
        csat_at        TIMESTAMP,
        created_at     TIMESTAMP DEFAULT NOW(),
        updated_at     TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS support_templates (
        id         SERIAL PRIMARY KEY,
        title      TEXT NOT NULL,
        body       TEXT NOT NULL,
        category   TEXT,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS app_settings (
        key        TEXT PRIMARY KEY,
        value      TEXT,
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
        id             SERIAL PRIMARY KEY,
        ticket_id      INTEGER NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
        user_id        INTEGER REFERENCES users(id) ON DELETE SET NULL,
        is_admin       INTEGER DEFAULT 0,
        body           TEXT NOT NULL,
        attachment_url TEXT,
        attachment_name TEXT,
        created_at     TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS reviews (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        rating     INTEGER NOT NULL,
        body       TEXT NOT NULL,
        status     TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS user_achievements (
        user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        achievement_key TEXT NOT NULL,
        unlocked_at     TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (user_id, achievement_key)
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type       TEXT NOT NULL DEFAULT 'info',
        title      TEXT NOT NULL,
        body       TEXT,
        link       TEXT,
        read_at    TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS promo_codes (
        id         SERIAL PRIMARY KEY,
        code       TEXT UNIQUE NOT NULL,
        amount     INTEGER NOT NULL,
        max_uses   INTEGER DEFAULT 0,
        used_count INTEGER DEFAULT 0,
        active     INTEGER DEFAULT 1,
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS promo_uses (
        id         SERIAL PRIMARY KEY,
        promo_id   INTEGER NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount     INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE (promo_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS notification_settings (
        user_id             INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        email_security      INTEGER DEFAULT 1,
        email_referral      INTEGER DEFAULT 1,
        email_support       INTEGER DEFAULT 1,
        email_achievements  INTEGER DEFAULT 1,
        email_other         INTEGER DEFAULT 1,
        unsubscribe_token   TEXT UNIQUE,
        updated_at          TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS admin_actions (
        id              SERIAL PRIMARY KEY,
        admin_id        INTEGER REFERENCES users(id) ON DELETE SET NULL,
        admin_username  TEXT,
        action          TEXT NOT NULL,
        target_user_id  INTEGER,
        target_username TEXT,
        details         TEXT,
        created_at      TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS rate_limits (
        key        TEXT PRIMARY KEY,
        count      INTEGER NOT NULL DEFAULT 0,
        expires_at TIMESTAMP NOT NULL
      );

      CREATE TABLE IF NOT EXISTS risk_events (
        id          SERIAL PRIMARY KEY,
        user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type        TEXT NOT NULL,
        severity    INTEGER NOT NULL DEFAULT 1,
        details     TEXT,
        status      TEXT NOT NULL DEFAULT 'open',
        created_at  TIMESTAMP DEFAULT NOW(),
        resolved_at TIMESTAMP,
        resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS showcase_items (
        id           SERIAL PRIMARY KEY,
        user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type         TEXT NOT NULL,
        title        TEXT NOT NULL,
        description  TEXT,
        url          TEXT,
        file_name    TEXT,
        file_data    TEXT,
        price        INTEGER DEFAULT 0,
        tags         TEXT[] DEFAULT '{}',
        status       TEXT NOT NULL DEFAULT 'pending',
        reward       INTEGER DEFAULT 0,
        admin_note   TEXT,
        views        INTEGER DEFAULT 0,
        created_at   TIMESTAMP DEFAULT NOW(),
        approved_at  TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS showcase_ratings (
        id           SERIAL PRIMARY KEY,
        item_id      INTEGER NOT NULL REFERENCES showcase_items(id) ON DELETE CASCADE,
        user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        rating       INTEGER NOT NULL,
        comment      TEXT,
        author_reply TEXT,
        reply_at     TIMESTAMP,
        created_at   TIMESTAMP DEFAULT NOW(),
        updated_at   TIMESTAMP DEFAULT NOW(),
        UNIQUE (item_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS showcase_purchases (
        id         SERIAL PRIMARY KEY,
        item_id    INTEGER NOT NULL REFERENCES showcase_items(id) ON DELETE CASCADE,
        buyer_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        seller_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        price      INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE (item_id, buyer_id)
      );

      CREATE TABLE IF NOT EXISTS showcase_favorites (
        item_id    INTEGER NOT NULL REFERENCES showcase_items(id) ON DELETE CASCADE,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (item_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS showcase_versions (
        id         SERIAL PRIMARY KEY,
        item_id    INTEGER NOT NULL REFERENCES showcase_items(id) ON DELETE CASCADE,
        version    TEXT NOT NULL,
        changelog  TEXT,
        file_name  TEXT,
        file_data  TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS showcase_follows (
        follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        author_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at  TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (follower_id, author_id),
        CHECK (follower_id <> author_id)
      );

      CREATE TABLE IF NOT EXISTS showcase_bundles (
        id               SERIAL PRIMARY KEY,
        user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title            TEXT NOT NULL,
        description      TEXT,
        discount_percent INTEGER NOT NULL DEFAULT 10,
        status           TEXT NOT NULL DEFAULT 'approved',
        created_at       TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS showcase_bundle_items (
        bundle_id INTEGER NOT NULL REFERENCES showcase_bundles(id) ON DELETE CASCADE,
        item_id   INTEGER NOT NULL REFERENCES showcase_items(id) ON DELETE CASCADE,
        PRIMARY KEY (bundle_id, item_id)
      );

      CREATE TABLE IF NOT EXISTS showcase_bundle_purchases (
        id         SERIAL PRIMARY KEY,
        bundle_id  INTEGER NOT NULL REFERENCES showcase_bundles(id) ON DELETE CASCADE,
        buyer_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        seller_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        price      INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE (bundle_id, buyer_id)
      );

      CREATE TABLE IF NOT EXISTS payout_requests (
        id           SERIAL PRIMARY KEY,
        user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount       INTEGER NOT NULL,
        method       TEXT NOT NULL,
        details      TEXT NOT NULL,
        status       TEXT NOT NULL DEFAULT 'pending',
        admin_note   TEXT,
        processed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at   TIMESTAMP DEFAULT NOW(),
        processed_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS status_incidents (
        id          SERIAL PRIMARY KEY,
        title       TEXT NOT NULL,
        body        TEXT,
        severity    TEXT NOT NULL DEFAULT 'minor',
        status      TEXT NOT NULL DEFAULT 'investigating',
        started_at  TIMESTAMP DEFAULT NOW(),
        resolved_at TIMESTAMP,
        created_at  TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS activity_events (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
        type       TEXT NOT NULL,
        title      TEXT NOT NULL,
        details    TEXT,
        is_public  INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS review_votes (
        review_id  INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (review_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS showcase_views (
        id         SERIAL PRIMARY KEY,
        item_id    INTEGER NOT NULL REFERENCES showcase_items(id) ON DELETE CASCADE,
        user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
        source     TEXT,
        referrer   TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS discount_codes (
        id                 SERIAL PRIMARY KEY,
        owner_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        kind               TEXT NOT NULL DEFAULT 'author',
        code               TEXT UNIQUE NOT NULL,
        discount_percent   INTEGER NOT NULL DEFAULT 0,
        max_uses           INTEGER DEFAULT 0,
        used_count         INTEGER DEFAULT 0,
        clicks             INTEGER DEFAULT 0,
        signups            INTEGER DEFAULT 0,
        sales_count        INTEGER DEFAULT 0,
        sales_amount       INTEGER DEFAULT 0,
        active             INTEGER DEFAULT 1,
        expires_at         TIMESTAMP,
        created_at         TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS discount_code_uses (
        id         SERIAL PRIMARY KEY,
        code_id    INTEGER NOT NULL REFERENCES discount_codes(id) ON DELETE CASCADE,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        seller_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
        item_id    INTEGER REFERENCES showcase_items(id) ON DELETE SET NULL,
        amount     INTEGER NOT NULL DEFAULT 0,
        discount   INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS showcase_refunds (
        id          SERIAL PRIMARY KEY,
        item_id     INTEGER NOT NULL REFERENCES showcase_items(id) ON DELETE CASCADE,
        buyer_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        seller_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount      INTEGER NOT NULL,
        reason      TEXT NOT NULL,
        status      TEXT NOT NULL DEFAULT 'pending',
        admin_note  TEXT,
        created_at  TIMESTAMP DEFAULT NOW(),
        resolved_at TIMESTAMP,
        resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE (item_id, buyer_id)
      );

      CREATE TABLE IF NOT EXISTS cosmetic_items (
        id          SERIAL PRIMARY KEY,
        key         TEXT UNIQUE NOT NULL,
        type        TEXT NOT NULL,
        title       TEXT NOT NULL,
        description TEXT,
        price       INTEGER NOT NULL DEFAULT 0,
        value       TEXT,
        rarity      TEXT NOT NULL DEFAULT 'common',
        active      INTEGER DEFAULT 1,
        created_at  TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS user_cosmetics (
        user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        cosmetic_key  TEXT NOT NULL REFERENCES cosmetic_items(key) ON DELETE CASCADE,
        acquired_at   TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (user_id, cosmetic_key)
      );

      CREATE TABLE IF NOT EXISTS coin_transactions (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount     INTEGER NOT NULL,
        type       TEXT NOT NULL,
        note       TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS clans (
        id          SERIAL PRIMARY KEY,
        name        TEXT UNIQUE NOT NULL,
        tag         TEXT UNIQUE NOT NULL,
        description TEXT,
        emblem      TEXT DEFAULT '🛡️',
        color       TEXT DEFAULT '#a78bfa',
        leader_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        xp          INTEGER NOT NULL DEFAULT 0,
        treasury    INTEGER NOT NULL DEFAULT 0,
        recruiting  INTEGER NOT NULL DEFAULT 1,
        created_at  TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS clan_members (
        user_id        INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        clan_id        INTEGER NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
        role           TEXT NOT NULL DEFAULT 'recruit',
        contribution   INTEGER NOT NULL DEFAULT 0,
        weekly_points  INTEGER NOT NULL DEFAULT 0,
        joined_at      TIMESTAMP DEFAULT NOW(),
        last_active_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS clan_applications (
        id          SERIAL PRIMARY KEY,
        clan_id     INTEGER NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
        user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        message     TEXT,
        status      TEXT NOT NULL DEFAULT 'pending',
        reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        reviewed_at TIMESTAMP,
        created_at  TIMESTAMP DEFAULT NOW(),
        UNIQUE (clan_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS clan_invites (
        id          SERIAL PRIMARY KEY,
        clan_id     INTEGER NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
        inviter_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
        invitee_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status      TEXT NOT NULL DEFAULT 'pending',
        created_at  TIMESTAMP DEFAULT NOW(),
        expires_at  TIMESTAMP,
        UNIQUE (clan_id, invitee_id)
      );

      CREATE TABLE IF NOT EXISTS clan_transactions (
        id         SERIAL PRIMARY KEY,
        clan_id    INTEGER NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
        user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
        amount     INTEGER NOT NULL,
        type       TEXT NOT NULL,
        note       TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS clan_activity (
        id         SERIAL PRIMARY KEY,
        clan_id    INTEGER NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
        user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
        type       TEXT NOT NULL,
        points     INTEGER NOT NULL DEFAULT 0,
        note       TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS clan_messages (
        id         SERIAL PRIMARY KEY,
        clan_id    INTEGER NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
        user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
        body       TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS daily_quest_claims (
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        quest_key  TEXT NOT NULL,
        quest_date DATE NOT NULL,
        reward     INTEGER NOT NULL DEFAULT 0,
        claimed_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (user_id, quest_key, quest_date)
      );

      CREATE TABLE IF NOT EXISTS clan_mission_claims (
        clan_id     INTEGER NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
        mission_key TEXT NOT NULL,
        week_start  DATE NOT NULL,
        reward      INTEGER NOT NULL DEFAULT 0,
        claimed_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
        claimed_at  TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (clan_id, mission_key, week_start)
      );

      CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, read_at);
      CREATE INDEX IF NOT EXISTS idx_admin_actions_created ON admin_actions(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_promo_uses_user ON promo_uses(user_id);
      CREATE INDEX IF NOT EXISTS idx_promo_uses_promo ON promo_uses(promo_id);
      CREATE INDEX IF NOT EXISTS idx_rate_limits_expires ON rate_limits(expires_at);
      CREATE INDEX IF NOT EXISTS idx_risk_events_user ON risk_events(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_risk_events_status ON risk_events(status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_showcase_status ON showcase_items(status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_showcase_type ON showcase_items(type, status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_showcase_user ON showcase_items(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_showcase_ratings_item ON showcase_ratings(item_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_showcase_purchases_item ON showcase_purchases(item_id);
      CREATE INDEX IF NOT EXISTS idx_showcase_purchases_buyer ON showcase_purchases(buyer_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_showcase_purchases_seller ON showcase_purchases(seller_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_showcase_favorites_user ON showcase_favorites(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_showcase_versions_item ON showcase_versions(item_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_showcase_follows_author ON showcase_follows(author_id);
      CREATE INDEX IF NOT EXISTS idx_showcase_bundles_user ON showcase_bundles(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_showcase_bundle_items_item ON showcase_bundle_items(item_id);
      CREATE INDEX IF NOT EXISTS idx_payout_requests_status ON payout_requests(status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_payout_requests_user ON payout_requests(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_status_incidents_started ON status_incidents(started_at DESC);
      CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_events(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_review_votes_review ON review_votes(review_id);
      CREATE INDEX IF NOT EXISTS idx_showcase_views_item ON showcase_views(item_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_showcase_views_created ON showcase_views(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_discount_codes_owner ON discount_codes(owner_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_discount_code_uses_code ON discount_code_uses(code_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_discount_code_uses_user ON discount_code_uses(user_id);
      CREATE INDEX IF NOT EXISTS idx_showcase_refunds_status ON showcase_refunds(status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_showcase_refunds_seller ON showcase_refunds(seller_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_coin_transactions_user ON coin_transactions(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_user_cosmetics_user ON user_cosmetics(user_id);
      CREATE INDEX IF NOT EXISTS idx_clan_members_clan ON clan_members(clan_id, role);
      CREATE INDEX IF NOT EXISTS idx_clan_applications_clan ON clan_applications(clan_id, status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_clan_applications_user ON clan_applications(user_id, status);
      CREATE INDEX IF NOT EXISTS idx_clan_invites_invitee ON clan_invites(invitee_id, status);
      CREATE INDEX IF NOT EXISTS idx_clan_transactions_clan ON clan_transactions(clan_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_clan_activity_clan ON clan_activity(clan_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_clan_messages_clan ON clan_messages(clan_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_clans_xp ON clans(xp DESC, created_at DESC);


      CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_keys_key ON keys(key);
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_balance_history_user ON balance_history(user_id);
      CREATE INDEX IF NOT EXISTS idx_play_sessions_user ON play_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON support_tickets(user_id);
      CREATE INDEX IF NOT EXISTS idx_support_messages_ticket ON support_messages(ticket_id);
      CREATE INDEX IF NOT EXISTS idx_support_templates_created ON support_templates(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_bug_reports_user ON bug_reports(user_id);
    `);

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE users ADD COLUMN balance INTEGER DEFAULT 0;
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE users ADD COLUMN partner_rank TEXT DEFAULT 'Младший партнёр';
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE users ADD COLUMN last_gift_at TIMESTAMP;
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE users ADD COLUMN sub_gifted INTEGER DEFAULT 0;
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE users ADD COLUMN sc_coins INTEGER DEFAULT 0;
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE users ADD COLUMN nickname_color TEXT;
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE users ADD COLUMN profile_theme TEXT;
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE users ADD COLUMN equipped_frame TEXT;
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE users ADD COLUMN equipped_badge TEXT;
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE users ADD COLUMN site_theme TEXT;
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE users ADD COLUMN partner_code TEXT;
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE users ADD COLUMN partner_code_at TIMESTAMP;
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE partner_applications ADD COLUMN admin_note TEXT;
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE users ADD COLUMN spin_count INTEGER DEFAULT 0;
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE users ADD COLUMN last_wheel_at TIMESTAMP;
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE users ADD COLUMN twofa_enabled INTEGER DEFAULT 0;
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE users ADD COLUMN referred_by INTEGER;
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE users ADD COLUMN signup_ip TEXT;
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE users ADD COLUMN referral_fraud INTEGER DEFAULT 0;
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE users ADD COLUMN avatar_url TEXT;
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE users ADD COLUMN bio TEXT;
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE users ADD COLUMN banner_url TEXT;
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE users ADD COLUMN accent_color TEXT;
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE support_tickets ADD COLUMN user_unread INTEGER DEFAULT 0;
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE support_tickets ADD COLUMN admin_unread INTEGER DEFAULT 0;
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE support_tickets ADD COLUMN last_message_by TEXT;
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE support_messages ADD COLUMN attachment_url TEXT;
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE support_messages ADD COLUMN attachment_name TEXT;
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE keys ADD COLUMN price INTEGER;
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE sessions ADD COLUMN user_agent TEXT;
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE sessions ADD COLUMN ip TEXT;
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE email_codes ADD COLUMN purpose TEXT DEFAULT 'register';
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE users ADD COLUMN last_ip TEXT;
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE users ADD COLUMN last_seen_at TIMESTAMP;
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE users ADD COLUMN risk_score INTEGER DEFAULT 0;
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE users ADD COLUMN risk_flags TEXT;
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE showcase_items ADD COLUMN price INTEGER DEFAULT 0;
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE showcase_items ADD COLUMN tags TEXT[] DEFAULT '{}';
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE showcase_items ADD COLUMN game TEXT;
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE showcase_items ADD COLUMN version TEXT DEFAULT '1.0';
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE showcase_items ADD COLUMN discount_percent INTEGER DEFAULT 0;
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE showcase_items ADD COLUMN discount_until TIMESTAMP;
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE showcase_ratings ADD COLUMN comment TEXT;
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE showcase_ratings ADD COLUMN author_reply TEXT;
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE showcase_ratings ADD COLUMN reply_at TIMESTAMP;
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE showcase_ratings ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE support_tickets ADD COLUMN category TEXT DEFAULT 'other';
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE support_tickets ADD COLUMN csat_rating INTEGER;
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE support_tickets ADD COLUMN csat_comment TEXT;
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE support_tickets ADD COLUMN csat_at TIMESTAMP;
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE daily_rewards ADD COLUMN claimed_total INTEGER DEFAULT 0;
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);

    await client.query(`
      UPDATE daily_rewards
      SET claimed_total = LEAST(GREATEST(COALESCE(streak_day, 0), 0), 7)
      WHERE COALESCE(claimed_total, 0) = 0 AND COALESCE(streak_day, 0) > 0;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_showcase_tags ON showcase_items USING GIN(tags);
      CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status, category, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_support_templates_created ON support_templates(created_at DESC);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by);
      CREATE INDEX IF NOT EXISTS idx_email_codes_purpose ON email_codes(email, purpose, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_users_hwid ON users(hwid);
      CREATE INDEX IF NOT EXISTS idx_sessions_ip ON sessions(ip);
      CREATE INDEX IF NOT EXISTS idx_daily_quest_claims_user ON daily_quest_claims(user_id, quest_date);
      CREATE INDEX IF NOT EXISTS idx_clan_mission_claims_clan ON clan_mission_claims(clan_id, week_start);
    `);

    await client.query(`
      INSERT INTO cosmetic_items (key, type, title, description, price, value, rarity) VALUES
        ('color_violet', 'nickname_color', 'Фиолетовый неон', 'Цвет ника в профиле и комментариях.', 300, '#a78bfa', 'common'),
        ('color_ice', 'nickname_color', 'Ледяной', 'Холодный бирюзовый оттенок.', 450, '#67e8f9', 'common'),
        ('color_gold', 'nickname_color', 'Золотой', 'Для тех, кто любит заметно.', 700, '#facc15', 'rare'),
        ('color_rose', 'nickname_color', 'Розовый кварц', 'Мягкий розовый цвет ника.', 700, '#f472b6', 'rare'),
        ('frame_violet', 'frame', 'Аметистовая рамка', 'Градиентная рамка вокруг аватара.', 800, 'linear-gradient(135deg,#7c3aed,#a855f7,#ec4899)', 'rare'),
        ('frame_fire', 'frame', 'Пламя', 'Огненная рамка для горячих профилей.', 1200, 'linear-gradient(135deg,#f97316,#ef4444,#facc15)', 'epic'),
        ('frame_aurora', 'frame', 'Северное сияние', 'Переливающаяся рамка.', 1800, 'linear-gradient(135deg,#22d3ee,#a78bfa,#34d399)', 'epic'),
        ('frame_gold', 'frame', 'Золотая легенда', 'Самая заметная рамка в клубе.', 2500, 'linear-gradient(135deg,#facc15,#f59e0b,#fef3c7)', 'legendary'),
        ('badge_star', 'badge', 'Звезда', 'Бейдж ⭐ рядом с ником.', 500, '⭐', 'common'),
        ('badge_flame', 'badge', 'В огне', 'Бейдж 🔥 рядом с ником.', 800, '🔥', 'rare'),
        ('badge_rocket', 'badge', 'На орбите', 'Бейдж 🚀 рядом с ником.', 1000, '🚀', 'rare'),
        ('badge_crown', 'badge', 'Корона', 'Бейдж 👑 рядом с ником.', 1500, '👑', 'epic'),
        ('badge_diamond', 'badge', 'Алмаз', 'Бейдж 💎 рядом с ником.', 1800, '💎', 'epic'),
        ('theme_midnight', 'theme', 'Полночь', 'Тёмный фиолетовый фон профиля.', 1200, 'linear-gradient(135deg,#0f172a,#312e81,#7c3aed)', 'rare'),
        ('theme_aurora', 'theme', 'Аврора', 'Бирюзово-фиолетовое свечение.', 1600, 'linear-gradient(135deg,#042f2e,#0e7490,#7c3aed)', 'epic'),
        ('theme_sakura', 'theme', 'Сакура', 'Тёплый розовый фон профиля.', 2000, 'linear-gradient(135deg,#4c0519,#9d174d,#f472b6)', 'epic'),
        ('color_mint', 'nickname_color', 'Мята', 'Свежий мятный цвет для спокойного профиля.', 200, '#6ee7b7', 'common'),
        ('color_lime', 'nickname_color', 'Кислотный лайм', 'Яркий лаймовый ник для заметного профиля.', 350, '#a3e635', 'common'),
        ('color_matrix', 'nickname_color', 'Матрица', 'Зелёный цвет цифрового дождя.', 500, '#22c55e', 'rare'),
        ('color_blood', 'nickname_color', 'Кровавая луна', 'Глубокий красный с холодным отливом.', 650, '#ef4444', 'rare'),
        ('color_sunset', 'nickname_color', 'Закат', 'Тёплый розово-оранжевый оттенок.', 650, '#fb7185', 'rare'),
        ('color_cosmic', 'nickname_color', 'Космический RGB', 'Живой радужный градиент, который переливается прямо в нике.', 5000, 'rgb', 'cosmic'),
        ('frame_smoke', 'frame', 'Дым', 'Сдержанная серая рамка на каждый день.', 500, 'linear-gradient(135deg,#3f3f46,#a1a1aa,#e4e4e7)', 'common'),
        ('frame_toxic', 'frame', 'Токсичный импульс', 'Кислотная рамка с неоновым свечением.', 900, 'linear-gradient(135deg,#65a30d,#22d3ee,#a3e635)', 'rare'),
        ('frame_void', 'frame', 'Пустота', 'Тёмная рамка с фиолетовым горизонтом событий.', 1500, 'linear-gradient(135deg,#020617,#1e1b4b,#7c3aed)', 'epic'),
        ('frame_plasma', 'frame', 'Плазма', 'Раскалённая рамка для самых заметных профилей.', 2200, 'linear-gradient(135deg,#f0abfc,#22d3ee,#facc15)', 'legendary'),
        ('frame_cosmic', 'frame', 'Космический RGB', 'Анимированная радужная рамка вокруг аватара.', 7500, 'rgb', 'cosmic'),
        ('badge_leaf', 'badge', 'Лист', 'Бейдж 🌿 рядом с ником.', 300, '🌿', 'common'),
        ('badge_moon', 'badge', 'Луна', 'Бейдж 🌙 рядом с ником.', 400, '🌙', 'common'),
        ('badge_comet', 'badge', 'Комета', 'Бейдж ☄️ рядом с ником.', 900, '☄️', 'rare'),
        ('badge_planet', 'badge', 'Планета', 'Бейдж 🪐 рядом с ником.', 1100, '🪐', 'rare'),
        ('badge_alien', 'badge', 'Контакты', 'Бейдж 👽 рядом с ником.', 1300, '👽', 'epic'),
        ('badge_satellite', 'badge', 'Спутник', 'Бейдж 🛰️ рядом с ником.', 1400, '🛰️', 'epic'),
        ('badge_galaxy', 'badge', 'Галактика', 'Бейдж 🌌 рядом с ником.', 2000, '🌌', 'legendary'),
        ('badge_shooting', 'badge', 'Падающая звезда', 'Бейдж 🌠 рядом с ником.', 2200, '🌠', 'legendary'),
        ('badge_cosmic', 'badge', 'Космический RGB', 'Радужный бейдж с пульсирующим космическим свечением.', 6000, '🌈', 'cosmic'),
        ('theme_graphite', 'theme', 'Графит', 'Минималистичная тёмная тема профиля.', 700, 'linear-gradient(135deg,#09090b,#27272a,#52525b)', 'common'),
        ('theme_nebula', 'theme', 'Туманность', 'Фиолетово-розовая туманность в шапке профиля.', 2600, 'linear-gradient(135deg,#020617,#4c1d95,#db2777)', 'epic'),
        ('theme_redgiant', 'theme', 'Красный гигант', 'Глубокий космический красный градиент.', 3200, 'linear-gradient(135deg,#450a0a,#b91c1c,#fb923c)', 'legendary'),
        ('theme_deepspace', 'theme', 'Глубокий космос', 'Синяя бездна с ярким горизонтом.', 3600, 'linear-gradient(135deg,#020617,#0f172a,#1d4ed8)', 'legendary'),
        ('theme_cosmic', 'theme', 'Космический RGB', 'Живая радужная тема профиля с космическим свечением.', 6500, 'rgb', 'cosmic'),
        ('site_ocean', 'site_theme', 'Океан', 'Глубокий синий фон с бирюзовыми волнами по всему сайту.', 1500, 'ocean', 'common'),
        ('site_forest', 'site_theme', 'Лес', 'Тёмно-зелёное оформление с мягким изумрудным свечением.', 1600, 'forest', 'common'),
        ('site_aurora', 'site_theme', 'Северное сияние', 'Бирюзово-фиолетовые переливы на каждой странице.', 2400, 'aurora', 'epic'),
        ('site_nebula', 'site_theme', 'Туманность', 'Розово-фиолетовая космическая дымка по всему сайту.', 2600, 'nebula', 'epic'),
        ('site_sunset', 'site_theme', 'Закат', 'Тёплый оранжево-розовый градиент для всего интерфейса.', 2800, 'sunset', 'epic'),
        ('site_matrix', 'site_theme', 'Матрица', 'Зелёная цифровая сетка и неоновое свечение.', 3200, 'matrix', 'legendary'),
        ('site_royal', 'site_theme', 'Королевский', 'Фиолетовый фон с золотыми акцентами.', 3400, 'royal', 'legendary'),
        ('site_deep_space', 'site_theme', 'Глубокий космос', 'Тёмное звёздное небо с синими и фиолетовыми туманностями.', 4000, 'deep_space', 'legendary'),
        ('site_cosmic', 'site_theme', 'Космический RGB', 'Анимированный радужный фон на всех страницах сайта.', 9000, 'cosmic', 'cosmic')
      ON CONFLICT (key) DO NOTHING
    `);

    await client.query(
      `INSERT INTO app_meta (key, value) VALUES ('schema_version', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [SCHEMA_VERSION]
    );

    console.log("DB tables initialized");
  } catch (e: any) {
    console.error("DB init error:", e.message);
  } finally {
    if (client) {
      try {
        await client.query("SELECT pg_advisory_unlock(842137642)");
      } catch {
        // соединение могло закрыться — не критично
      }
      client.release();
    }
  }
}

const initPromise = initDb();

export async function query(text: string, params?: any[]) {
  await initPromise;
  const result = await pool.query(text, params);
  return result;
}

export async function queryOne(text: string, params?: any[]) {
  await initPromise;
  const result = await pool.query(text, params);
  return result.rows[0] ?? null;
}

export async function queryAll(text: string, params?: any[]) {
  await initPromise;
  const result = await pool.query(text, params);
  return result.rows;
}

/**
 * Выполняет набор запросов в одной транзакции.
 * При ошибке (или раннем throw) изменения откатываются, соединение возвращается в пул.
 */
export type DbExecutor = Pick<PoolClient, "query">;

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  await initPromise;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("DB rollback error:", rollbackError);
    }
    throw error;
  } finally {
    client.release();
  }
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

export async function recomputePartnerRank(userId: number, db: DbExecutor = pool) {
  await initPromise;
  const paResult = await db.query(
    `SELECT platform FROM partner_applications
     WHERE user_id = $1 AND status = 'approved'
     ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );
  const pa = paResult.rows[0] ?? null;
  const platform = (pa?.platform as string) ?? null;
  const { videos: videoThreshold, views: viewsThreshold } = partnerThresholds(platform);

  const statResult = await db.query(
    `SELECT COUNT(*)::int AS approved,
            COALESCE(SUM(reward), 0)::int AS earned,
            COALESCE(SUM(views), 0)::int AS total_views
     FROM media_submissions WHERE user_id = $1 AND status = 'approved'`,
    [userId]
  );
  const stat = statResult.rows[0] ?? null;
  const approved = (stat?.approved as number) ?? 0;
  const earned = (stat?.earned as number) ?? 0;
  const totalViews = (stat?.total_views as number) ?? 0;

  const rank =
    approved >= videoThreshold && totalViews >= viewsThreshold
      ? "Партнёр"
      : "Младший партнёр";

  await db.query("UPDATE users SET partner_rank = $1 WHERE id = $2", [rank, userId]);
  return { rank, approved, earned, totalViews, videoThreshold, viewsThreshold, platform };
}

export async function addBalanceHistory(
  userId: number,
  amount: number,
  type: string,
  note?: string,
  db: DbExecutor = pool
) {
  await initPromise;
  await db.query(
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
  sc_coins?: number;
  nickname_color?: string | null;
  profile_theme?: string | null;
  equipped_frame?: string | null;
  equipped_badge?: string | null;
  site_theme?: string | null;
  partner_code?: string | null;
  partner_code_at?: string | null;
  sub_gifted?: number;
  twofa_enabled?: number;
  signup_ip?: string | null;
  referral_fraud?: number;
  avatar_url?: string | null;
  bio?: string | null;
  banner_url?: string | null;
  accent_color?: string | null;
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
