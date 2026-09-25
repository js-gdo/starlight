import type { Env } from '../env.d';

export async function initDB(env: Env) {
    const db = env.DB;

    const tables = [
        `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      use INTEGER DEFAULT 1,
      speak INTEGER DEFAULT 1,
      admin INTEGER DEFAULT 0,
      admin_roles TEXT DEFAULT '["unassigned"]',
      color TEXT DEFAULT 'red',
      tag TEXT DEFAULT '',
      avatar_url TEXT DEFAULT '',
      bio TEXT DEFAULT '',
      checkin_date TEXT,
      last_fortune TEXT,
      points INTEGER DEFAULT 0,
      server_coin REAL DEFAULT 0,
      server_hardware_score INTEGER DEFAULT 0,
      server_assets TEXT DEFAULT '[]',
      server_cpu TEXT DEFAULT 'E5-2686 v4',
      server_motherboard TEXT DEFAULT 'X99 主板',
      server_ram TEXT DEFAULT '16GB DDR4',
      server_storage TEXT DEFAULT '1TB HDD',
      server_last_collected_at TEXT DEFAULT '',
      server_last_event_date TEXT DEFAULT '',
      egg_endings TEXT DEFAULT '[]',
      egg_locked INTEGER DEFAULT 0,
      sidebar_mode TEXT DEFAULT 'classic',
      ui_mode TEXT DEFAULT 'classic',
      created_at TEXT DEFAULT (datetime('now'))
    )`,
        `CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hex_id TEXT UNIQUE,
      title TEXT,
      content TEXT,
      author_id INTEGER,
      article_type TEXT DEFAULT 'normal',
      category TEXT DEFAULT 'other',
      problem_id TEXT DEFAULT '',
      is_pinned INTEGER DEFAULT 0,
      is_locked INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(author_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
        `CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id INTEGER,
      author_id INTEGER,
      content TEXT,
      parent_id INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(article_id) REFERENCES articles(id) ON DELETE CASCADE,
      FOREIGN KEY(author_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
        `CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      content TEXT,
      author_id INTEGER,
      assignee_id INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      is_private INTEGER DEFAULT 0,
      permission TEXT DEFAULT '',
      permission_action TEXT DEFAULT '',
      permission_status TEXT DEFAULT '',
      permission_admin_id INTEGER DEFAULT 0,
      upvotes INTEGER DEFAULT 0,
      downvotes INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(author_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
        `CREATE TABLE IF NOT EXISTS article_likes (
      article_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY(article_id, user_id),
      FOREIGN KEY(article_id) REFERENCES articles(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
        `CREATE TABLE IF NOT EXISTS ticket_votes (
      ticket_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      vote INTEGER NOT NULL CHECK (vote IN (-1, 1)),
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY(ticket_id, user_id),
      FOREIGN KEY(ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
        `CREATE TABLE IF NOT EXISTS ticket_replies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER,
      author_id INTEGER,
      content TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
      FOREIGN KEY(author_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
        `CREATE TABLE IF NOT EXISTS judgements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_id INTEGER,
      reason TEXT,
      author_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(target_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(author_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
        `CREATE TABLE IF NOT EXISTS follows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      follower_id INTEGER,
      followee_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(follower_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(followee_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
        `CREATE TABLE IF NOT EXISTS permission_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_id INTEGER,
      admin_id INTEGER,
      action TEXT,
      permission TEXT,
      reason TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(target_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(admin_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
        `CREATE TABLE IF NOT EXISTS benben (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT,
      author_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(author_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
        `CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_user_id INTEGER,
      to_user_id INTEGER,
      content TEXT,
      is_read INTEGER DEFAULT 0,
      type TEXT DEFAULT 'private',
      related_id INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(from_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(to_user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
        `CREATE TABLE IF NOT EXISTS banners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      image_url TEXT NOT NULL,
      link_url TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
        `CREATE TABLE IF NOT EXISTS online_hourly_stats (
      hour_start TEXT PRIMARY KEY,
      peak_count INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
        `CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      enabled INTEGER DEFAULT 1,
      announcement_type TEXT DEFAULT 'notice',
      display_scope TEXT DEFAULT 'all',
      scroll_speed INTEGER DEFAULT 24,
      starts_at TEXT DEFAULT '',
      ends_at TEXT DEFAULT '',
      is_pinned INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
        `CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reporter_id INTEGER NOT NULL,
      target_type TEXT NOT NULL,
      target_id INTEGER NOT NULL,
      reason TEXT NOT NULL,
      evidence TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',
      handled_by INTEGER DEFAULT 0,
      resolution TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      handled_at TEXT DEFAULT '',
      FOREIGN KEY(reporter_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
        `CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT DEFAULT '',
      target_id INTEGER DEFAULT 0,
      details TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(admin_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
        `CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      description TEXT DEFAULT '',
      level TEXT NOT NULL DEFAULT '普通' CHECK (level IN ('普通','高级')),
      owner_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      competition_quota INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
        `CREATE TABLE IF NOT EXISTS team_members (
      team_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY(team_id, user_id),
      FOREIGN KEY(team_id) REFERENCES teams(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
        `CREATE TABLE IF NOT EXISTS team_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER NOT NULL,
      author_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      is_announcement INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(team_id) REFERENCES teams(id) ON DELETE CASCADE,
      FOREIGN KEY(author_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
        `CREATE TABLE IF NOT EXISTS team_creation_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      requester_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      level TEXT NOT NULL DEFAULT '普通',
      status TEXT NOT NULL DEFAULT 'pending',
      reviewed_by INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(requester_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
        `CREATE TABLE IF NOT EXISTS team_competition_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER NOT NULL,
      requester_id INTEGER NOT NULL,
      competition_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      is_public INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(team_id) REFERENCES teams(id) ON DELETE CASCADE,
      FOREIGN KEY(requester_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
        `CREATE TABLE IF NOT EXISTS team_upgrade_codes (
      code TEXT PRIMARY KEY,
      max_uses INTEGER NOT NULL DEFAULT 1,
      used_count INTEGER NOT NULL DEFAULT 0,
      enabled INTEGER NOT NULL DEFAULT 1,
      expires_at TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    )`,
        `CREATE TABLE IF NOT EXISTS permission_ticket_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL,
      admin_id INTEGER NOT NULL,
      decision TEXT NOT NULL,
      permission TEXT NOT NULL,
      permission_action TEXT NOT NULL,
      reason TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
      FOREIGN KEY(admin_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
        `CREATE TABLE IF NOT EXISTS site_settings (
      setting_key TEXT PRIMARY KEY,
      setting_value TEXT NOT NULL DEFAULT ''
    )`,
        `CREATE TABLE IF NOT EXISTS user_achievements (
      user_id INTEGER NOT NULL,
      achievement_id TEXT NOT NULL,
      unlocked_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, achievement_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
        `CREATE TABLE IF NOT EXISTS oj_proposals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      proposer_id INTEGER NOT NULL,
      problem_name TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      pickup_code TEXT NOT NULL,
      proposal_category TEXT NOT NULL DEFAULT 'public',
      problem_id TEXT NOT NULL DEFAULT '',
      team_id INTEGER DEFAULT NULL,
      visibility TEXT NOT NULL DEFAULT 'public',
      status TEXT NOT NULL DEFAULT 'pending',
      reviewer_id INTEGER DEFAULT NULL,
      review_note TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      reviewed_at TEXT DEFAULT '',
      FOREIGN KEY(proposer_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(reviewer_id) REFERENCES users(id) ON DELETE SET NULL
    )`,
        `CREATE TABLE IF NOT EXISTS contests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT DEFAULT '',
      organizer_id INTEGER DEFAULT 1,
      participation_mode TEXT NOT NULL DEFAULT 'public' CHECK (participation_mode IN ('public', 'team')),
      is_ioi INTEGER NOT NULL DEFAULT 1,
      start_at TEXT DEFAULT '',
      end_at TEXT DEFAULT '',
      schedule_state TEXT DEFAULT 'scheduled',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(organizer_id) REFERENCES users(id) ON DELETE SET DEFAULT
    )`,
        `CREATE TABLE IF NOT EXISTS contest_problems (
      contest_id INTEGER NOT NULL,
      problem_id TEXT NOT NULL,
      problem_order INTEGER NOT NULL DEFAULT 0,
      visibility TEXT NOT NULL DEFAULT 'public',
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (contest_id, problem_id),
      FOREIGN KEY(contest_id) REFERENCES contests(id) ON DELETE CASCADE
    )`,
        `CREATE TABLE IF NOT EXISTS contest_enrollments (
      contest_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      team_id INTEGER DEFAULT NULL,
      status TEXT NOT NULL DEFAULT 'enrolled',
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (contest_id, user_id),
      FOREIGN KEY(contest_id) REFERENCES contests(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(team_id) REFERENCES teams(id) ON DELETE SET NULL
    )`,
        `CREATE TABLE IF NOT EXISTS redeem_codes (
      code TEXT PRIMARY KEY,
      points INTEGER NOT NULL DEFAULT 0,
      server_coin REAL NOT NULL DEFAULT 0,
      max_uses INTEGER NOT NULL DEFAULT 1,
      used_count INTEGER NOT NULL DEFAULT 0,
      enabled INTEGER NOT NULL DEFAULT 1,
      expires_at TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    )`,
        `CREATE TABLE IF NOT EXISTS redeem_code_uses (
      code TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      redeemed_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (code, user_id),
      FOREIGN KEY(code) REFERENCES redeem_codes(code) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
        `CREATE TABLE IF NOT EXISTS garden_pets (
      user_id INTEGER PRIMARY KEY,
      name TEXT NOT NULL DEFAULT 'Star',
      level INTEGER NOT NULL DEFAULT 1,
      experience INTEGER NOT NULL DEFAULT 0,
      energy INTEGER NOT NULL DEFAULT 100,
      last_fed_at TEXT DEFAULT '',
      last_trained_at TEXT DEFAULT '',
      last_explored_at TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
    ];

    for (const sql of tables) {
        try {
            await db.prepare(sql).run();
        } catch (e: any) {
            if (!e.message.includes('already exists')) {
                console.error('Table creation error:', e);
            }
        }
    }

    // 创建初始管理员
    const admin = await db.prepare('SELECT * FROM users WHERE id = 1').first();
    if (!admin) {
        const hashedPassword = 'f1d0b7f4df42bf1b97865e03fac74872d109c6c3ee5d2789d2cbe03e5cd55bd5';
        await db.prepare(
            `INSERT INTO users (id, username, password, admin, color, tag, points, server_coin, server_hardware_score, server_assets, server_cpu, server_motherboard, server_ram, server_storage)
       VALUES (1, 'lin114514', ?, 1, 'purple', '管理员', 100, 25, 28216, ?, 'E5-2686 v4', 'X99 主板', '16GB DDR4', '1TB HDD')`
        ).bind(hashedPassword, JSON.stringify(['E5-2686 v4','X99 主板','16GB DDR4','1TB HDD'])).run();
    }

    // 初始化默认轮播图
    const bannerCount = await db.prepare('SELECT COUNT(*) as cnt FROM banners').first();
    if (!bannerCount || bannerCount.cnt === 0) {
        const defaultBanners = [
            { image_url: 'https://static.lin114514.top/img/starlight/starlight.png', link_url: 'https://sl.lj1.cc.cd', sort_order: 1 },
            { image_url: 'https://picsum.photos/seed/starlight1/1280/720', link_url: '', sort_order: 2 },
            { image_url: 'https://picsum.photos/seed/starlight2/1280/720', link_url: '', sort_order: 3 }
        ];
        for (const b of defaultBanners) {
            await db.prepare('INSERT INTO banners (image_url, link_url, sort_order) VALUES (?, ?, ?)')
                .bind(b.image_url, b.link_url, b.sort_order).run();
        }
    }

    // 为旧数据库补充字段（忽略已存在字段错误）
    const alterColumns = [
        'ALTER TABLE users ADD COLUMN last_ip TEXT DEFAULT ""',
        'ALTER TABLE users ADD COLUMN last_region TEXT DEFAULT ""',
        'ALTER TABLE users ADD COLUMN last_city TEXT DEFAULT ""',
        'ALTER TABLE users ADD COLUMN last_login_at TEXT DEFAULT ""',
        'ALTER TABLE users ADD COLUMN last_active_at TEXT DEFAULT ""',
        'ALTER TABLE users ADD COLUMN avatar_url TEXT DEFAULT ""',
        'ALTER TABLE users ADD COLUMN real_name TEXT DEFAULT ""',
        'ALTER TABLE users ADD COLUMN location TEXT DEFAULT ""',
        'ALTER TABLE users ADD COLUMN profile_link TEXT DEFAULT ""',
        'ALTER TABLE users ADD COLUMN server_coin REAL DEFAULT 0',
        'ALTER TABLE users ADD COLUMN server_hardware_score INTEGER DEFAULT 0',
        'ALTER TABLE users ADD COLUMN server_assets TEXT DEFAULT "[]"',
        'ALTER TABLE users ADD COLUMN server_cpu TEXT DEFAULT "E5-2686 v4"',
        'ALTER TABLE users ADD COLUMN server_motherboard TEXT DEFAULT "X99 主板"',
        'ALTER TABLE users ADD COLUMN server_ram TEXT DEFAULT "16GB DDR4"',
        'ALTER TABLE users ADD COLUMN server_storage TEXT DEFAULT "1TB HDD"',
        'ALTER TABLE users ADD COLUMN server_last_collected_at TEXT DEFAULT ""',
        'ALTER TABLE users ADD COLUMN server_last_event_date TEXT DEFAULT ""',
        'ALTER TABLE users ADD COLUMN egg_endings TEXT DEFAULT "[]"',
        'ALTER TABLE users ADD COLUMN egg_locked INTEGER DEFAULT 0',
        'ALTER TABLE users ADD COLUMN admin_roles TEXT DEFAULT "[]"',
        'ALTER TABLE users ADD COLUMN sidebar_mode TEXT DEFAULT "classic"',
        'ALTER TABLE users ADD COLUMN ui_mode TEXT DEFAULT "classic"',
        'ALTER TABLE tickets ADD COLUMN is_private INTEGER DEFAULT 0',
        'ALTER TABLE tickets ADD COLUMN permission TEXT DEFAULT ""',
        'ALTER TABLE tickets ADD COLUMN permission_action TEXT DEFAULT ""',
        'ALTER TABLE tickets ADD COLUMN permission_status TEXT DEFAULT ""',
        'ALTER TABLE tickets ADD COLUMN permission_admin_id INTEGER DEFAULT 0',
        'ALTER TABLE announcements ADD COLUMN announcement_type TEXT DEFAULT "notice"',
        'ALTER TABLE announcements ADD COLUMN display_scope TEXT DEFAULT "all"',
        'ALTER TABLE announcements ADD COLUMN scroll_speed INTEGER DEFAULT 24',
        'ALTER TABLE announcements ADD COLUMN starts_at TEXT DEFAULT ""',
        'ALTER TABLE announcements ADD COLUMN ends_at TEXT DEFAULT ""',
        'ALTER TABLE announcements ADD COLUMN is_pinned INTEGER DEFAULT 0',
        'ALTER TABLE articles ADD COLUMN article_type TEXT DEFAULT "normal"',
        'ALTER TABLE articles ADD COLUMN category TEXT DEFAULT "other"',
        'ALTER TABLE articles ADD COLUMN problem_id TEXT DEFAULT ""',
        'ALTER TABLE articles ADD COLUMN is_pinned INTEGER DEFAULT 0',
        'ALTER TABLE articles ADD COLUMN is_locked INTEGER DEFAULT 0'
        , 'ALTER TABLE team_competition_requests ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0'
        , "ALTER TABLE teams ADD COLUMN join_mode TEXT NOT NULL DEFAULT 'application'"
        , "ALTER TABLE team_creation_requests ADD COLUMN join_mode TEXT NOT NULL DEFAULT 'application'"
        , "ALTER TABLE team_members ADD COLUMN reason TEXT DEFAULT ''"
    ];
    for (const sql of alterColumns) {
        try { await db.prepare(sql).run(); } catch { }
    }

    await db.prepare("UPDATE users SET admin_roles = '[\"unassigned\"]' WHERE admin = 1 AND (admin_roles IS NULL OR admin_roles = '' OR admin_roles = '[]')").run();

    // Keep proposal records created by older deployments usable while adding
    // category-specific metadata. D1 supports ADD COLUMN but not ALTER COLUMN,
    // so the nullable reviewer_id is handled by explicitly binding NULL below.
    const proposalColumns = [
        "ALTER TABLE oj_proposals ADD COLUMN proposal_category TEXT NOT NULL DEFAULT 'public'",
        "ALTER TABLE oj_proposals ADD COLUMN problem_id TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE oj_proposals ADD COLUMN team_id INTEGER DEFAULT NULL",
        "ALTER TABLE oj_proposals ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public'",
    ];
    for (const sql of proposalColumns) {
        try { await db.prepare(sql).run(); } catch { }
    }

    const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_articles_pinned_created ON articles (is_pinned, created_at)',
        'CREATE INDEX IF NOT EXISTS idx_articles_author ON articles (author_id)',
        'CREATE INDEX IF NOT EXISTS idx_articles_category ON articles (category, created_at)',
        'CREATE INDEX IF NOT EXISTS idx_comments_article ON comments (article_id)',
        'CREATE INDEX IF NOT EXISTS idx_comments_author ON comments (author_id)',
        'CREATE INDEX IF NOT EXISTS idx_benben_created ON benben (created_at)',
        'CREATE INDEX IF NOT EXISTS idx_users_last_active ON users (last_active_at)',
        'CREATE INDEX IF NOT EXISTS idx_tickets_author ON tickets (author_id)',
        'CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets (status, created_at)',
        'CREATE INDEX IF NOT EXISTS idx_ticket_replies_ticket ON ticket_replies (ticket_id)',
        'CREATE INDEX IF NOT EXISTS idx_messages_to_read ON messages (to_user_id, is_read, type)',
        'CREATE INDEX IF NOT EXISTS idx_messages_pair ON messages (from_user_id, to_user_id, id)',
        'CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows (follower_id)',
        'CREATE INDEX IF NOT EXISTS idx_follows_followee ON follows (followee_id)',
        'CREATE INDEX IF NOT EXISTS idx_reports_reporter ON reports (reporter_id, status)',
        'CREATE INDEX IF NOT EXISTS idx_reports_status ON reports (status, created_at)',
        'CREATE INDEX IF NOT EXISTS idx_article_likes_user ON article_likes (user_id)',
        'CREATE INDEX IF NOT EXISTS idx_users_server_rank ON users (server_hardware_score DESC, server_coin DESC)',
        'CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members (user_id, status)',
        'CREATE INDEX IF NOT EXISTS idx_team_posts_team ON team_posts (team_id, created_at)',
        'CREATE INDEX IF NOT EXISTS idx_team_creation_requests_status ON team_creation_requests (status, created_at)'
        , 'CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements (user_id)'
    ];
    for (const sql of indexes) {
        try { await db.prepare(sql).run(); } catch { }
    }

    await db.prepare("INSERT OR IGNORE INTO site_settings (setting_key, setting_value) VALUES ('site_status', 'normal')").run();
}

const CURRENT_SCHEMA_VERSION = '14';
let schemaReady = false;

export async function ensureDB(env: Env) {
    if (schemaReady) return;
    try {
        const marker = await env.DB.prepare(
            "SELECT setting_value FROM site_settings WHERE setting_key = 'schema_version'"
        ).first();
        if (marker?.setting_value === CURRENT_SCHEMA_VERSION) {
            schemaReady = true;
            return;
        }
    } catch { }
    await initDB(env);
    await env.DB.prepare(
        "INSERT INTO site_settings (setting_key, setting_value) VALUES ('schema_version', ?) ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value"
      ).bind(CURRENT_SCHEMA_VERSION).run();
    schemaReady = true;
}
