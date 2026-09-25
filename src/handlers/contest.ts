import { getSessionUser, jsonRes } from '../utils/auth';
import type { Env } from '../env.d';

export function contestScheduleState(startAt?: string | null, endAt?: string | null): 'scheduled' | 'running' | 'ended' {
    const now = Date.now();
    const start = startAt ? new Date(startAt).getTime() : Number.NEGATIVE_INFINITY;
    const end = endAt ? new Date(endAt).getTime() : Number.POSITIVE_INFINITY;
    if (startAt && now < start) return 'scheduled';
    if (endAt && now > end) return 'ended';
    return 'running';
}

export async function getContestById(env: Env, contestId: number): Promise<any | null> {
    if (!Number.isFinite(contestId) || contestId <= 0) return null;
    return env.DB.prepare(`
        SELECT c.*, u.username AS organizer_name,
               (SELECT COUNT(*) FROM contest_enrollments ce WHERE ce.contest_id = c.id AND ce.status = 'enrolled') AS enrolled_count
        FROM contests c
        LEFT JOIN users u ON u.id = c.organizer_id
        WHERE c.id = ?
    `).bind(contestId).first<any>();
}

export async function getUserContestEnrollment(env: Env, contestId: number, userId: number): Promise<any | null> {
    if (!Number.isFinite(contestId) || !Number.isFinite(userId) || contestId <= 0 || userId <= 0) return null;
    return env.DB.prepare('SELECT * FROM contest_enrollments WHERE contest_id = ? AND user_id = ?').bind(contestId, userId).first<any>();
}

export async function getUserTeams(env: Env, userId: number): Promise<any[]> {
    if (!Number.isFinite(userId) || userId <= 0) return [];
    const rows = await env.DB.prepare(`
        SELECT tm.team_id, t.name, t.slug, tm.role, tm.status
        FROM team_members tm
        JOIN teams t ON t.id = tm.team_id
        WHERE tm.user_id = ? AND tm.status = 'approved' AND t.status = 'active'
        ORDER BY tm.role DESC, t.name ASC
    `).bind(userId).all<any>();
    return rows.results || [];
}

export async function ensureUserCanAccessContest(env: Env, request: Request, user: any, contestId: number): Promise<{ ok: boolean; contest?: any; state?: 'scheduled' | 'running' | 'ended'; error?: string; status?: number }> {
    const contest = await getContestById(env, contestId);
    if (!contest) {
        return { ok: false, error: '比赛不存在', status: 404 };
    }
    if (!user) {
        return { ok: false, error: contest.participation_mode === 'team' ? '团队赛仅允许团队成员参加。' : '请先登录后再参与比赛。', status: 403 };
    }

    const enrollment = await getUserContestEnrollment(env, contestId, user.id);
    if (!enrollment) {
        return { ok: false, error: '请先报名比赛后再查看题目。', status: 403 };
    }

    const state = contestScheduleState(contest.start_at, contest.end_at);
    if (contest.participation_mode === 'team' && enrollment.team_id) {
        const isMember = await env.DB.prepare(
            "SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ? AND status = 'approved'"
        ).bind(enrollment.team_id, user.id).first();
        if (!isMember) {
            return { ok: false, error: '当前团队报名记录已失效。', status: 403 };
        }
    }
    if (state === 'scheduled') {
        return { ok: false, error: '比赛尚未开始，暂不可访问。', status: 403 };
    }

    return { ok: true, contest, state };
}

export async function handleContests(request: Request, env: Env, path: string): Promise<Response> {
    const user = await getSessionUser(env, request);
    const url = new URL(request.url);

    if ((path === '/api/contests' || path === '/api/contest') && request.method === 'GET') {
        const contestId = Number(url.searchParams.get('cid') || url.searchParams.get('contest_id') || '0');
        if (contestId > 0) {
            const contest = await getContestById(env, contestId);
            if (!contest) return jsonRes({ error: '比赛不存在' }, 404);
            return jsonRes({
                ...contest,
                state: contestScheduleState(contest.start_at, contest.end_at),
                is_ioi: Boolean(contest.is_ioi),
                enrollment_mode: contest.participation_mode || 'public',
            });
        }

        const rows = await env.DB.prepare(`
            SELECT c.*, u.username AS organizer_name,
                   (SELECT COUNT(*) FROM contest_enrollments ce WHERE ce.contest_id = c.id AND ce.status = 'enrolled') AS enrolled_count
            FROM contests c
            LEFT JOIN users u ON u.id = c.organizer_id
            ORDER BY c.start_at DESC, c.id DESC
        `).all<any>();
        return jsonRes((rows.results || []).map((contest: any) => ({
            ...contest,
            state: contestScheduleState(contest.start_at, contest.end_at),
            is_ioi: Boolean(contest.is_ioi),
            enrollment_mode: contest.participation_mode || 'public',
        })));
    }

    const enrollMatch = path.match(/^\/api\/contests\/(\d+)\/enroll$/) || path.match(/^\/api\/contest\/(\d+)\/enroll$/);
    if (enrollMatch && request.method === 'POST') {
        const contestId = Number(enrollMatch[1]);
        if (!user) return jsonRes({ error: '请先登录后再报名比赛。' }, 403);

        const contest = await getContestById(env, contestId);
        if (!contest) return jsonRes({ error: '比赛不存在' }, 404);

        const state = contestScheduleState(contest.start_at, contest.end_at);
        if (state === 'ended') return jsonRes({ error: '比赛已结束，无法报名。' }, 403);

        const form = await request.formData().catch(() => null);
        const teamId = form ? Number(String(form.get('team_id') || '0')) : 0;

        if (contest.participation_mode === 'team') {
            if (!teamId) return jsonRes({ error: '团队赛必须指定 team_id。' }, 400);
            const membership = await env.DB.prepare(
                "SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ? AND status = 'approved'"
            ).bind(teamId, user.id).first();
            if (!membership) return jsonRes({ error: '你不是该团队成员，无法报名团队赛。' }, 403);
        }

        const existing = await getUserContestEnrollment(env, contestId, user.id);
        if (existing) {
            await env.DB.prepare(
                'UPDATE contest_enrollments SET team_id = ?, status = ? WHERE contest_id = ? AND user_id = ?'
            ).bind(teamId || null, 'enrolled', contestId, user.id).run();
            return jsonRes({ ok: true, enrolled: true, contest_id: contestId, team_id: teamId || null, state });
        }

        await env.DB.prepare(
            'INSERT INTO contest_enrollments (contest_id, user_id, team_id, status) VALUES (?, ?, ?, ?)' 
        ).bind(contestId, user.id, teamId || null, 'enrolled').run();
        return jsonRes({ ok: true, enrolled: true, contest_id: contestId, team_id: teamId || null, state });
    }

    if (path === '/api/contests' && request.method === 'POST') {
        if (!user || user.id !== 1) return jsonRes({ error: '仅 superuser 可以创建比赛。' }, 403);
        const form = await request.formData();
        const title = String(form.get('title') || '').trim().slice(0, 120);
        const description = String(form.get('description') || '').trim().slice(0, 5000);
        const mode = form.get('participation_mode') === 'team' ? 'team' : 'public';
        const startAt = String(form.get('start_at') || '').trim();
        const endAt = String(form.get('end_at') || '').trim();
        if (!title || !startAt || !endAt || new Date(endAt).getTime() <= new Date(startAt).getTime()) {
            return jsonRes({ error: '请填写有效的标题、开始时间和结束时间。' }, 400);
        }
        const slug = `${title.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-').replace(/^-|-$/g, '')}-${Date.now()}`;
        const result = await env.DB.prepare('INSERT INTO contests (title,slug,description,organizer_id,participation_mode,is_ioi,start_at,end_at,schedule_state) VALUES (?,?,?,?,?,?,?,?,?)')
            .bind(title, slug, description, user.id, mode, 1, startAt, endAt, 'scheduled').run();
        return jsonRes({ ok: true, contest_id: Number(result.meta?.last_row_id) });
    }

    const problemMatch = path.match(/^\/api\/contests\/(\d+)\/problems$/);
    if (problemMatch && request.method === 'POST') {
        if (!user || user.id !== 1) return jsonRes({ error: '仅 superuser 可以编排比赛题目。' }, 403);
        const form = await request.formData();
        const problemId = String(form.get('problem_id') || '').trim();
        const order = Number(form.get('problem_order') || 0);
        if (!/^6\d+$/.test(problemId)) return jsonRes({ error: '比赛题目 ID 必须以 6 开头。' }, 400);
        const proposal = await env.DB.prepare("SELECT id FROM oj_proposals WHERE problem_id=? AND proposal_category='contest' AND status='approved'").bind(problemId).first();
        if (!proposal) return jsonRes({ error: '比赛题目不存在或尚未审核通过。' }, 404);
        await env.DB.prepare('INSERT OR REPLACE INTO contest_problems (contest_id,problem_id,problem_order,visibility) VALUES (?,?,?,?)').bind(Number(problemMatch[1]), problemId, order, 'contest').run();
        return jsonRes({ ok: true });
    }

    return jsonRes({ error: 'Contest API not found' }, 404);
}
