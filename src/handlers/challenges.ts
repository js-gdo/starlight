import { getSessionUser, jsonRes } from '../utils/auth';
import type { Env } from '../env.d';

const PERSONAL_CHALLENGES = {
    public_contest: { title: '报名参加一场公开赛', target: 1, reward: 10 },
    team_discussion: { title: '参与团队讨论', target: 2, reward: 10 },
} as const;

const TEAM_CHALLENGE = { title: '团队协作目标', commentsTarget: 6, contributorsTarget: 2, reward: 8 };

export function getChinaWeekRange(now = new Date()): { start: string; end: string } {
    const chinaNow = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const mondayOffset = (chinaNow.getUTCDay() + 6) % 7;
    const startDate = new Date(Date.UTC(
        chinaNow.getUTCFullYear(),
        chinaNow.getUTCMonth(),
        chinaNow.getUTCDate() - mondayOffset
    ));
    const endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    const toDateString = (date: Date) =>
        `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
    return { start: toDateString(startDate), end: toDateString(endDate) };
}

function weekPredicate(column: string): string {
    return `date(${column}, '+8 hours') >= date(?) AND date(${column}, '+8 hours') < date(?)`;
}

async function countPersonalProgress(env: Env, userId: number, week: { start: string; end: string }) {
    const contests = await env.DB.prepare(
        `SELECT COUNT(*) AS count
         FROM contest_enrollments ce
         JOIN contests c ON c.id = ce.contest_id
         WHERE ce.user_id = ? AND ce.status = 'enrolled'
           AND c.participation_mode = 'public'
           AND ${weekPredicate('ce.created_at')}`
    ).bind(userId, week.start, week.end).first<any>();
    const comments = await env.DB.prepare(
        `SELECT COUNT(*) AS count
         FROM team_post_comments c
         JOIN team_posts p ON p.id = c.post_id AND p.is_announcement = 0
         JOIN teams t ON t.id = p.team_id AND t.status = 'active'
         JOIN team_members current_membership
           ON current_membership.team_id = p.team_id
          AND current_membership.user_id = c.author_id
          AND current_membership.status = 'approved'
         WHERE c.author_id = ? AND ${weekPredicate('c.created_at')}`
    ).bind(userId, week.start, week.end).first<any>();
    return {
        public_contest: Number(contests?.count || 0),
        team_discussion: Number(comments?.count || 0),
    };
}

async function getTeamProgress(env: Env, userId: number, week: { start: string; end: string }) {
    const rows = await env.DB.prepare(
        `SELECT t.id AS team_id, t.name,
                COALESCE(progress.comment_count, 0) AS comment_count,
                COALESCE(progress.contributor_count, 0) AS contributor_count,
                COALESCE(progress.user_comment_count, 0) AS user_comment_count,
                EXISTS(
                    SELECT 1 FROM weekly_challenge_claims wc
                    WHERE wc.user_id = ? AND wc.week_start = ?
                      AND wc.challenge_key = 'team_collaboration' AND wc.team_id = t.id
                ) AS claimed
         FROM team_members tm
         JOIN teams t ON t.id = tm.team_id AND t.status = 'active'
         LEFT JOIN (
             SELECT p.team_id, COUNT(c.id) AS comment_count,
                    COUNT(DISTINCT c.author_id) AS contributor_count,
                    SUM(CASE WHEN c.author_id = ? THEN 1 ELSE 0 END) AS user_comment_count
             FROM team_posts p
             JOIN team_post_comments c ON c.post_id = p.id
             JOIN team_members commenter
               ON commenter.team_id = p.team_id
              AND commenter.user_id = c.author_id
              AND commenter.status = 'approved'
             WHERE p.is_announcement = 0 AND ${weekPredicate('c.created_at')}
             GROUP BY p.team_id
         ) progress ON progress.team_id = t.id
         WHERE tm.user_id = ? AND tm.status = 'approved'
         ORDER BY t.name COLLATE NOCASE`
    ).bind(userId, week.start, userId, week.start, week.end, userId).all<any>();
    return rows.results || [];
}

export async function getWeeklyChallengeData(env: Env, userId: number, now = new Date()) {
    const week = getChinaWeekRange(now);
    const [progress, claims, teams] = await Promise.all([
        countPersonalProgress(env, userId, week),
        env.DB.prepare(
            `SELECT challenge_key FROM weekly_challenge_claims
             WHERE user_id = ? AND week_start = ? AND team_id = 0`
        ).bind(userId, week.start).all<any>(),
        getTeamProgress(env, userId, week),
    ]);
    const claimedKeys = new Set((claims.results || []).map((row: any) => String(row.challenge_key)));
    return {
        week,
        personal: Object.entries(PERSONAL_CHALLENGES).map(([key, task]) => ({
            key,
            title: task.title,
            target: task.target,
            reward: task.reward,
            progress: Math.min(progress[key as keyof typeof progress], task.target),
            claimed: claimedKeys.has(key),
        })),
        teamChallenge: TEAM_CHALLENGE,
        teams: teams.map((team: any) => ({
            id: Number(team.team_id),
            name: String(team.name),
            comments: Number(team.comment_count),
            contributors: Number(team.contributor_count),
            userComments: Number(team.user_comment_count),
            claimed: Number(team.claimed) === 1,
        })),
    };
}

async function claimChallenge(request: Request, env: Env, userId: number): Promise<Response> {
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return jsonRes({ error: '请求内容无效' }, 400);
    }
    if (!body || typeof body !== 'object') return jsonRes({ error: '请求内容无效' }, 400);
    const payload = body as { key?: unknown; team_id?: unknown };
    const key = typeof payload.key === 'string' ? payload.key : '';
    const teamId = payload.team_id === undefined ? 0 : Number(payload.team_id);
    if (!Number.isSafeInteger(teamId) || teamId < 0) return jsonRes({ error: '任务参数无效' }, 400);

    const state = await getWeeklyChallengeData(env, userId);
    let reward: number;
    if (key === 'public_contest' || key === 'team_discussion') {
        if (teamId !== 0) return jsonRes({ error: '任务参数无效' }, 400);
        const task = state.personal.find((item) => item.key === key);
        if (!task || task.progress < task.target) return jsonRes({ error: '尚未完成本周任务' }, 400);
        reward = task.reward;
    } else if (key === 'team_collaboration' && teamId > 0) {
        const team = state.teams.find((item) => item.id === teamId);
        if (!team || team.comments < TEAM_CHALLENGE.commentsTarget ||
            team.contributors < TEAM_CHALLENGE.contributorsTarget ||
            team.userComments < 1) {
            return jsonRes({ error: '团队目标尚未完成，或你尚未参与本周协作' }, 400);
        }
        reward = TEAM_CHALLENGE.reward;
    } else {
        return jsonRes({ error: '任务参数无效' }, 400);
    }

    const result = await env.DB.prepare(
        `INSERT OR IGNORE INTO weekly_challenge_claims
         (user_id, week_start, challenge_key, team_id, reward_points)
         VALUES (?, ?, ?, ?, ?)`
    ).bind(userId, state.week.start, key, teamId, reward).run();
    if (Number(result.meta.changes || 0) === 0) return jsonRes({ error: '本周奖励已领取' }, 409);
    return jsonRes({ success: true, reward });
}

export async function handleChallenges(request: Request, env: Env, path: string): Promise<Response> {
    const user = await getSessionUser(env, request);
    if (!user) return jsonRes({ error: '请先登录' }, 401);
    if (path === '/api/challenges') {
        if (request.method !== 'GET') return jsonRes({ error: 'Method not allowed' }, 405);
        return jsonRes(await getWeeklyChallengeData(env, Number(user.id)));
    }
    if (path === '/api/challenges/claim') {
        if (request.method !== 'POST') return jsonRes({ error: 'Method not allowed' }, 405);
        return claimChallenge(request, env, Number(user.id));
    }
    return jsonRes({ error: 'API not found' }, 404);
}
