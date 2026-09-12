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
      color TEXT DEFAULT 'red',
      tag TEXT DEFAULT '',
      avatar_url TEXT DEFAULT '',
      bio TEXT DEFAULT '',
      checkin_date TEXT,
      last_fortune TEXT,
      points INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
        `CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hex_id TEXT UNIQUE,
      title TEXT,
      content TEXT,
      author_id INTEGER,
      article_type TEXT DEFAULT 'normal',
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
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(author_id) REFERENCES users(id) ON DELETE CASCADE
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
            `INSERT INTO users (id, username, password, admin, color, tag, points)
       VALUES (1, 'lin114514', ?, 1, 'purple', '管理员', 100)`
        ).bind(hashedPassword).run();
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

    // 为旧数据库补充字段（忽略错误）
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
        'ALTER TABLE tickets ADD COLUMN is_private INTEGER DEFAULT 0',
        'ALTER TABLE tickets ADD COLUMN permission TEXT DEFAULT ""',
        'ALTER TABLE tickets ADD COLUMN permission_action TEXT DEFAULT ""',
        'ALTER TABLE tickets ADD COLUMN permission_status TEXT DEFAULT ""',
        'ALTER TABLE tickets ADD COLUMN permission_admin_id INTEGER DEFAULT 0',
        'ALTER TABLE announcements ADD COLUMN announcement_type TEXT DEFAULT "notice"',
        'ALTER TABLE announcements ADD COLUMN display_scope TEXT DEFAULT "all"',
        'ALTER TABLE announcements ADD COLUMN scroll_speed INTEGER DEFAULT 24',
        'ALTER TABLE articles ADD COLUMN article_type TEXT DEFAULT "normal"',
        'ALTER TABLE articles ADD COLUMN problem_id TEXT DEFAULT ""',
        'ALTER TABLE articles ADD COLUMN is_pinned INTEGER DEFAULT 0',
        'ALTER TABLE articles ADD COLUMN is_locked INTEGER DEFAULT 0'
    ];
    for (const sql of alterColumns) {
        try { await db.prepare(sql).run(); } catch { }
    }

    await db.prepare("INSERT OR IGNORE INTO site_settings (setting_key, setting_value) VALUES ('site_status', 'normal')").run();
}