import type { Env } from '../env.d';
import { createInviteCode } from '../utils/invite';

async function runColumnMigration(db: Env['DB'], sql: string): Promise<void> {
    try {
        await db.prepare(sql).run();
    } catch (error) {
        if (!/duplicate column name/i.test(String(error))) throw error;
    }
}

async function addLegacyColumns(db: Env['DB']): Promise<void> {
    const columns = [
        'ALTER TABLE users ADD COLUMN invite_code TEXT NOT NULL DEFAULT ""',
        'ALTER TABLE users ADD COLUMN luogu_uid INTEGER',
        'ALTER TABLE users ADD COLUMN luogu_username TEXT NOT NULL DEFAULT ""',
        'ALTER TABLE users ADD COLUMN registered_ip TEXT NOT NULL DEFAULT ""',
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
        'ALTER TABLE users ADD COLUMN admin_permissions TEXT NOT NULL DEFAULT "[]"',
        'ALTER TABLE users ADD COLUMN sidebar_mode TEXT DEFAULT "classic"',
        'ALTER TABLE users ADD COLUMN ui_mode TEXT DEFAULT "classic"',
        'ALTER TABLE users ADD COLUMN layout_mode TEXT NOT NULL DEFAULT "classic"',
        'ALTER TABLE users ADD COLUMN background_url TEXT NOT NULL DEFAULT ""',
        'ALTER TABLE users ADD COLUMN background_mode TEXT NOT NULL DEFAULT "cover"',
        'ALTER TABLE users ADD COLUMN redirect_delay_seconds INTEGER DEFAULT 5',
        'ALTER TABLE users ADD COLUMN session_version INTEGER NOT NULL DEFAULT 0',
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
        'ALTER TABLE articles ADD COLUMN is_locked INTEGER DEFAULT 0',
        'ALTER TABLE team_competition_requests ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0',
        "ALTER TABLE teams ADD COLUMN join_mode TEXT NOT NULL DEFAULT 'application'",
        "ALTER TABLE team_creation_requests ADD COLUMN join_mode TEXT NOT NULL DEFAULT 'application'",
        "ALTER TABLE team_members ADD COLUMN reason TEXT DEFAULT ''",
        'ALTER TABLE contests ADD COLUMN team_id INTEGER DEFAULT NULL',
        "ALTER TABLE contest_problems ADD COLUMN problem_name TEXT NOT NULL DEFAULT ''",
    ];

    for (const sql of columns) {
        await runColumnMigration(db, sql);
    }
}

async function backfillLegacyData(db: Env['DB']): Promise<void> {
    const usersWithoutInviteCodes = await db.prepare(
        "SELECT id, username FROM users WHERE invite_code = '' OR invite_code IS NULL"
    ).all<{ id: number; username: string }>();

    for (let offset = 0; offset < (usersWithoutInviteCodes.results || []).length; offset += 100) {
        const batch = await Promise.all((usersWithoutInviteCodes.results || []).slice(offset, offset + 100).map(async user =>
            db.prepare("UPDATE users SET invite_code = ? WHERE id = ? AND (invite_code = '' OR invite_code IS NULL)")
                .bind(await createInviteCode(String(user.username || '')), user.id)
        ));
        if (batch.length) await db.batch(batch);
    }

    await db.prepare(
        "UPDATE users SET admin_roles = '[\"unassigned\"]' WHERE admin = 1 AND (admin_roles IS NULL OR admin_roles = '' OR admin_roles = '[]')"
    ).run();
}

async function addProposalColumns(db: Env['DB']): Promise<void> {
    const columns = [
        "ALTER TABLE oj_proposals ADD COLUMN proposal_category TEXT NOT NULL DEFAULT 'public'",
        "ALTER TABLE oj_proposals ADD COLUMN problem_id TEXT NOT NULL DEFAULT ''",
        'ALTER TABLE oj_proposals ADD COLUMN team_id INTEGER DEFAULT NULL',
        "ALTER TABLE oj_proposals ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public'",
    ];
    for (const sql of columns) {
        await runColumnMigration(db, sql);
    }
}

async function createIndexes(db: Env['DB']): Promise<void> {
    const statements = [
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
        'CREATE INDEX IF NOT EXISTS idx_login_history_user_created ON login_history (user_id, id DESC)',
        'CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members (user_id, status)',
        'CREATE INDEX IF NOT EXISTS idx_team_posts_team ON team_posts (team_id, created_at)',
        'CREATE INDEX IF NOT EXISTS idx_team_post_comments_post ON team_post_comments (post_id, created_at)',
        'CREATE INDEX IF NOT EXISTS idx_team_post_likes_user ON team_post_likes (user_id, post_id)',
        'CREATE INDEX IF NOT EXISTS idx_weekly_challenge_claims_period ON weekly_challenge_claims (week_start, challenge_key, team_id)',
        'CREATE INDEX IF NOT EXISTS idx_ruins_runs_user_status ON ruins_runs (user_id, status, id DESC)',
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_ruins_runs_one_active ON ruins_runs (user_id) WHERE status = 'active'",
        'CREATE INDEX IF NOT EXISTS idx_team_creation_requests_status ON team_creation_requests (status, created_at)',
        'CREATE INDEX IF NOT EXISTS idx_contests_team_schedule ON contests (team_id, start_at)',
        'CREATE INDEX IF NOT EXISTS idx_contest_problems_order ON contest_problems (contest_id, problem_order)',
        'CREATE INDEX IF NOT EXISTS idx_contest_public_requests_status ON contest_public_requests (status, created_at)',
        'CREATE INDEX IF NOT EXISTS idx_contest_submissions_score ON contest_submissions (contest_id, user_id, problem_id, score DESC)',
        "CREATE INDEX IF NOT EXISTS idx_space_game_expeditions_user_status ON space_game_expeditions (user_id, status, ends_at)",
        "CREATE INDEX IF NOT EXISTS idx_space_game_expeditions_leaderboard ON space_game_expeditions (user_id, status)",
        'CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements (user_id)',
        'CREATE INDEX IF NOT EXISTS idx_users_invite_code ON users (invite_code)',
        'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_luogu_uid ON users (luogu_uid) WHERE luogu_uid IS NOT NULL',
        'CREATE INDEX IF NOT EXISTS idx_referrals_inviter ON referrals (inviter_id)',
        `CREATE TRIGGER IF NOT EXISTS referral_registration_reward
           AFTER INSERT ON referrals
           BEGIN
             UPDATE users SET points = points + 50 WHERE id = NEW.inviter_id;
           END`,
        `CREATE TRIGGER IF NOT EXISTS referral_checkin_reward
           AFTER INSERT ON referral_checkins
           BEGIN
             UPDATE users SET points = points + 1
             WHERE id = (SELECT inviter_id FROM referrals WHERE invitee_id = NEW.invitee_id);
           END`,
        `CREATE TRIGGER IF NOT EXISTS weekly_challenge_reward
           AFTER INSERT ON weekly_challenge_claims
           BEGIN
             UPDATE users SET points = points + NEW.reward_points WHERE id = NEW.user_id;
           END`,
    ];
    for (const sql of statements) {
        await db.prepare(sql).run();
    }
}

export async function migrateLegacySchema(db: Env['DB']): Promise<void> {
    await addLegacyColumns(db);
    await backfillLegacyData(db);
    await addProposalColumns(db);
    await createIndexes(db);
}
