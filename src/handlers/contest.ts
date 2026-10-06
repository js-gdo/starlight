import { getSessionUser, jsonRes } from '../utils/auth';
import type { TypedD1PreparedStatement } from '../env.d';
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
               t.name AS team_name,
               (SELECT COUNT(*) FROM contest_enrollments ce WHERE ce.contest_id = c.id AND ce.status = 'enrolled') AS enrolled_count
        FROM contests c
        LEFT JOIN users u ON u.id = c.organizer_id
        LEFT JOIN teams t ON t.id = c.team_id
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
    if (contest.participation_mode === 'team') {
        if (!contest.team_id || Number(enrollment.team_id) !== Number(contest.team_id)) {
            return { ok: false, error: '报名团队与比赛所属团队不一致。', status: 403 };
        }
        const isMember = await env.DB.prepare(
            "SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ? AND status = 'approved'"
        ).bind(contest.team_id, user.id).first();
        if (!isMember) {
            return { ok: false, error: '当前团队报名记录已失效。', status: 403 };
        }
    }
    if (state === 'scheduled') {
        return { ok: false, error: '比赛尚未开始，暂不可访问。', status: 403 };
    }

    return { ok: true, contest, state };
}

async function isTeamManager(env: Env, teamId: number, userId: number): Promise<boolean> {
    const member = await env.DB.prepare(
        "SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ? AND status = 'approved' AND role IN ('owner', 'admin')"
    ).bind(teamId, userId).first();
    return !!member;
}

function parseContestDateTime(value: string): string | null {
    const input = value.trim();
    if (!input) return null;
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input)) return null;
    const timestamp = Date.parse(`${input}:00+08:00`);
    if (!Number.isFinite(timestamp)) return null;
    const roundTrip = new Date(timestamp + 8 * 60 * 60 * 1000).toISOString().slice(0, 16);
    return roundTrip === input ? new Date(timestamp).toISOString() : null;
}

async function loadAvailableContestProblems(): Promise<Array<{ id: string; title: string; category: 'public' | 'contest' }>> {
    const response = await fetch('https://oj.lin114514.top/api/get/problem/list', {
        headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`OJ problem list returned HTTP ${response.status}`);
    const data = await response.json() as { problems?: Array<{ id?: string | number; title?: string; name?: string }> };
    if (!Array.isArray(data.problems)) throw new Error('OJ problem list response is invalid');
    const publicProblems = data.problems
        .filter((problem) => /^1\d+$/.test(String(problem.id || '')))
        .map((problem) => ({
            id: String(problem.id),
            title: String(problem.title || problem.name || `题目 ${problem.id}`),
            category: 'public' as const,
        }));
    return publicProblems;
}

export async function handleContests(request: Request, env: Env, path: string): Promise<Response> {
    const user = await getSessionUser(env, request);
    const url = new URL(request.url);

    if ((path === '/api/contests' || path === '/api/contest') && request.method === 'GET') {
        const contestId = Number(url.searchParams.get('cid') || url.searchParams.get('contest_id') || '0');
        if (contestId > 0) {
            const contest = await getContestById(env, contestId);
            if (!contest) return jsonRes({ error: '比赛不存在' }, 404);
            if (contest.participation_mode === 'team') {
                if (!user || !contest.team_id || !(await env.DB.prepare(
                    "SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ? AND status = 'approved'"
                ).bind(contest.team_id, user.id).first())) {
                    return jsonRes({ error: '该团队赛仅对所属团队成员开放。' }, 403);
                }
            }
            return jsonRes({
                ...contest,
                state: contestScheduleState(contest.start_at, contest.end_at),
                is_ioi: Boolean(contest.is_ioi),
                enrollment_mode: contest.participation_mode || 'public',
            });
        }

        const rows = await env.DB.prepare(`
            SELECT c.*, u.username AS organizer_name,
                   t.name AS team_name,
                   (SELECT COUNT(*) FROM contest_enrollments ce WHERE ce.contest_id = c.id AND ce.status = 'enrolled') AS enrolled_count
            FROM contests c
            LEFT JOIN users u ON u.id = c.organizer_id
            LEFT JOIN teams t ON t.id = c.team_id
            WHERE c.participation_mode = 'public'
               OR EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id = c.team_id AND tm.user_id = ? AND tm.status = 'approved')
            ORDER BY c.start_at DESC, c.id DESC
        `).bind(user?.id || 0).all<any>();
        return jsonRes((rows.results || []).map((contest: any) => ({
            ...contest,
            state: contestScheduleState(contest.start_at, contest.end_at),
            is_ioi: Boolean(contest.is_ioi),
            enrollment_mode: contest.participation_mode || 'public',
        })));
    }

    const availableProblemsMatch = path.match(/^\/api\/contests\/available-problems$/);
    if (availableProblemsMatch && request.method === 'GET') {
        const teamId = Number(url.searchParams.get('tid') || 0);
        if (!user || !Number.isSafeInteger(teamId) || teamId <= 0 || !(await isTeamManager(env, teamId, user.id))) {
            return jsonRes({ error: '仅团队创建者或管理员可以编排该团队比赛。' }, 403);
        }
        const publicProblems = await loadAvailableContestProblems();
        const contestRows = await env.DB.prepare(
            "SELECT problem_id, problem_name FROM oj_proposals WHERE proposal_category = 'contest' AND status = 'approved' ORDER BY problem_id"
        ).all<{ problem_id: string; problem_name: string }>();
        return jsonRes({
            problems: [
                ...publicProblems,
                ...(contestRows.results || []).map((problem) => ({
                    id: String(problem.problem_id),
                    title: String(problem.problem_name || `比赛题 ${problem.problem_id}`),
                    category: 'contest' as const,
                })),
            ],
        });
    }

    const publicRequestsMatch = path === '/api/contests/public-requests';
    if (publicRequestsMatch && request.method === 'GET') {
        if (!user || user.id !== 1) return jsonRes({ error: '仅 superuser 可以审核公开赛申请。' }, 403);
        const rows = await env.DB.prepare(`
            SELECT r.*, c.title AS contest_title, c.team_id, t.name AS team_name, u.username AS requester_name
            FROM contest_public_requests r
            JOIN contests c ON c.id = r.contest_id
            JOIN teams t ON t.id = c.team_id
            JOIN users u ON u.id = r.requested_by
            WHERE r.status = 'pending'
            ORDER BY r.created_at, r.id
        `).all<any>();
        return jsonRes({ requests: rows.results || [] });
    }

    const publicRequestReviewMatch = path.match(/^\/api\/contests\/public-requests\/(\d+)\/review$/);
    if (publicRequestReviewMatch && request.method === 'POST') {
        if (!user || user.id !== 1) return jsonRes({ error: '仅 superuser 可以审核公开赛申请。' }, 403);
        const body = await request.formData();
        const decision = String(body.get('decision') || '');
        const note = String(body.get('note') || '').trim().slice(0, 500);
        if (!['approve', 'reject'].includes(decision)) return jsonRes({ error: '审核状态无效。' }, 400);
        const requestId = Number(publicRequestReviewMatch[1]);
        const application = await env.DB.prepare(
            "SELECT id, contest_id FROM contest_public_requests WHERE id = ? AND status = 'pending'"
        ).bind(requestId).first<{ id: number; contest_id: number }>();
        if (!application) return jsonRes({ error: '申请不存在或已审核。' }, 404);
        const statements: TypedD1PreparedStatement[] = [
            env.DB.prepare(
                "UPDATE contest_public_requests SET status = ?, review_note = ?, reviewed_by = ?, reviewed_at = datetime('now') WHERE id = ? AND status = 'pending'"
            ).bind(decision === 'approve' ? 'approved' : 'rejected', note, user.id, requestId),
        ];
        if (decision === 'approve') {
            statements.push(env.DB.prepare(
                `UPDATE contests SET participation_mode = 'public'
                 WHERE id = ? AND participation_mode = 'team'
                   AND EXISTS (SELECT 1 FROM contest_public_requests WHERE id = ? AND status = 'approved')`
            ).bind(application.contest_id, requestId));
        }
        await env.DB.batch(statements);
        return jsonRes({ ok: true, status: decision === 'approve' ? 'approved' : 'rejected' });
    }

    const publicRequestMatch = path.match(/^\/api\/contests\/(\d+)\/public-request$/);
    if (publicRequestMatch && request.method === 'POST') {
        const contestId = Number(publicRequestMatch[1]);
        const contest = await getContestById(env, contestId);
        if (!contest || contest.participation_mode !== 'team' || !contest.team_id) {
            return jsonRes({ error: '只有团队赛可以申请转为公开赛。' }, 400);
        }
        if (!user || !(await isTeamManager(env, Number(contest.team_id), user.id))) {
            return jsonRes({ error: '仅该团队创建者或管理员可以提交申请。' }, 403);
        }
        const pending = await env.DB.prepare(
            "SELECT id FROM contest_public_requests WHERE contest_id = ? AND status = 'pending'"
        ).bind(contestId).first();
        if (pending) return jsonRes({ error: '该比赛已有待审核的公开申请。' }, 409);
        const note = String((await request.formData()).get('note') || '').trim().slice(0, 500);
        await env.DB.prepare(
            'INSERT INTO contest_public_requests (contest_id, requested_by, review_note) VALUES (?, ?, ?)'
        ).bind(contestId, user.id, note).run();
        return jsonRes({ ok: true });
    }

    const leaderboardMatch = path.match(/^\/api\/contests\/(\d+)\/leaderboard$/);
    if (leaderboardMatch && request.method === 'GET') {
        const contestId = Number(leaderboardMatch[1]);
        const access = await ensureUserCanAccessContest(env, request, user, contestId);
        if (!access.ok) return jsonRes({ error: access.error || '无权查看排行榜。' }, access.status || 403);
        const rows = await env.DB.prepare(`
            SELECT s.user_id, u.username, s.problem_id, MAX(s.score) AS best_score,
                   MAX(s.passed) AS passed, MAX(s.total) AS total
            FROM contest_submissions s
            JOIN users u ON u.id = s.user_id
            WHERE s.contest_id = ?
            GROUP BY s.user_id, s.problem_id
            ORDER BY u.username COLLATE NOCASE
        `).bind(contestId).all<any>();
        const problemRows = await env.DB.prepare(
            'SELECT problem_id FROM contest_problems WHERE contest_id = ? ORDER BY problem_order, problem_id'
        ).bind(contestId).all<any>();
        const problems = (problemRows.results || []).map((row: any) => String(row.problem_id));
        const standings = new Map<number, { user_id: number; username: string; score: number; problems: Record<string, number> }>();
        for (const row of rows.results || []) {
            const userId = Number(row.user_id);
            const item = standings.get(userId) || {
                user_id: userId,
                username: String(row.username),
                score: 0,
                problems: {},
            };
            const problemId = String(row.problem_id);
            const score = Math.max(0, Math.min(100, Number(row.best_score || 0)));
            item.problems[problemId] = score;
            item.score += score;
            standings.set(userId, item);
        }
        return jsonRes({
            contest_id: contestId,
            problems,
            standings: [...standings.values()].sort((a, b) => b.score - a.score || a.username.localeCompare(b.username)),
        });
    }

    const enrollMatch = path.match(/^\/api\/contests\/(\d+)\/enroll$/) || path.match(/^\/api\/contest\/(\d+)\/enroll$/);
    if (enrollMatch && request.method === 'POST') {
        const contestId = Number(enrollMatch[1]);
        if (!user) return jsonRes({ error: '请先登录后再报名比赛。' }, 403);

        const contest = await getContestById(env, contestId);
        if (!contest) return jsonRes({ error: '比赛不存在' }, 404);

        const state = contestScheduleState(contest.start_at, contest.end_at);
        if (state === 'ended') return jsonRes({ error: '比赛已结束，无法报名。' }, 403);

        await request.formData().catch(() => null);
        const teamId = contest.participation_mode === 'team' ? Number(contest.team_id || 0) : 0;

        if (contest.participation_mode === 'team') {
            if (!teamId) return jsonRes({ error: '团队赛尚未关联所属团队。' }, 400);
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
        if (!user) return jsonRes({ error: '请先登录。' }, 403);
        const form = await request.formData();
        const title = String(form.get('title') || '').trim().slice(0, 120);
        const description = String(form.get('description') || '').trim().slice(0, 5000);
        const teamId = Number(form.get('team_id') || 0);
        const startAt = String(form.get('start_at') || '').trim();
        const endAt = String(form.get('end_at') || '').trim();
        const normalizedStart = parseContestDateTime(startAt);
        const normalizedEnd = parseContestDateTime(endAt);
        if (!title || !normalizedStart || !normalizedEnd || Date.parse(normalizedEnd) <= Date.parse(normalizedStart)) {
            return jsonRes({ error: '请填写有效的标题、开始时间和结束时间。' }, 400);
        }
        if (!Number.isSafeInteger(teamId) || teamId <= 0 || !(await isTeamManager(env, teamId, user.id))) {
            return jsonRes({ error: '仅团队创建者或管理员可以在所属团队创建比赛。' }, 403);
        }
        const team = await env.DB.prepare("SELECT id FROM teams WHERE id = ? AND status = 'active'").bind(teamId).first();
        if (!team) return jsonRes({ error: '团队不存在或已停用。' }, 404);
        const problemIds = [...new Set(form.getAll('problem_id').map(value => String(value).trim()).filter(Boolean))];
        if (problemIds.length < 1 || problemIds.length > 50) {
            return jsonRes({ error: '每场比赛必须添加 1 至 50 道题目。' }, 400);
        }
        const publicProblems = await loadAvailableContestProblems();
        const publicIds = new Set(publicProblems.map(problem => problem.id));
        const contestNames = new Map(
            (await env.DB.prepare(
                "SELECT problem_id, problem_name FROM oj_proposals WHERE proposal_category = 'contest' AND status = 'approved'"
            ).all<{ problem_id: string; problem_name: string }>()).results.map(problem =>
                [String(problem.problem_id), String(problem.problem_name || `比赛题 ${problem.problem_id}`)] as const
            )
        );
        for (const problemId of problemIds) {
            if (/^1\d+$/.test(problemId)) {
                if (!publicIds.has(problemId)) return jsonRes({ error: `公开题目 ${problemId} 不存在。` }, 400);
                continue;
            }
            if (/^6\d+$/.test(problemId)) {
                const proposal = await env.DB.prepare(
                    "SELECT id FROM oj_proposals WHERE problem_id = ? AND proposal_category = 'contest' AND status = 'approved' LIMIT 1"
                ).bind(problemId).first();
                if (!proposal) return jsonRes({ error: `比赛题目 ${problemId} 不存在或尚未审核通过。` }, 400);
                continue;
            }
            return jsonRes({ error: `题目 ${problemId} 不可用于比赛；团队私有题不允许加入比赛。` }, 400);
        }
        const slug = `${title.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-').replace(/^-|-$/g, '')}-${Date.now()}`;
        const statements: TypedD1PreparedStatement[] = [
            env.DB.prepare(
                "INSERT INTO contests (title,slug,description,organizer_id,team_id,participation_mode,is_ioi,start_at,end_at,schedule_state) VALUES (?,?,?,?,?,'team',1,?,?,'scheduled')"
            ).bind(title, slug, description, user.id, teamId, normalizedStart, normalizedEnd),
            ...problemIds.map((problemId, index) =>
                env.DB.prepare(
                    "INSERT INTO contest_problems (contest_id,problem_id,problem_name,problem_order,visibility) SELECT id,?,?,?,'contest' FROM contests WHERE slug = ?"
                ).bind(
                    problemId,
                    publicIds.has(problemId)
                        ? publicProblems.find(problem => problem.id === problemId)?.title || `题目 ${problemId}`
                        : contestNames.get(problemId) || `比赛题 ${problemId}`,
                    index + 1,
                    slug
                )
            ),
        ];
        await env.DB.batch(statements);
        const createdContest = await env.DB.prepare('SELECT id FROM contests WHERE slug = ?').bind(slug).first<{ id: number }>();
        if (!createdContest) throw new Error('Contest batch completed without creating the contest.');
        const contestId = Number(createdContest.id);
        return jsonRes({ ok: true, contest_id: contestId });
    }

    const problemMatch = path.match(/^\/api\/contests\/(\d+)\/problems$/);
    if (problemMatch && request.method === 'POST') {
        const contest = await getContestById(env, Number(problemMatch[1]));
        if (!contest) return jsonRes({ error: '比赛不存在。' }, 404);
        if (contestScheduleState(contest.start_at, contest.end_at) !== 'scheduled') {
            return jsonRes({ error: '比赛开始后不能再更改赛题。' }, 403);
        }
        if (!user || !contest.team_id || !(await isTeamManager(env, Number(contest.team_id), user.id))) {
            return jsonRes({ error: '仅该团队创建者或管理员可以编排比赛题目。' }, 403);
        }
        const form = await request.formData();
        const problemId = String(form.get('problem_id') || '').trim();
        const order = Number(form.get('problem_order') || 0);
        if (!Number.isSafeInteger(order) || order < 1 || order > 50) return jsonRes({ error: '题目顺序须在 1 至 50 之间。' }, 400);
        const existingProblem = await env.DB.prepare(
            'SELECT 1 FROM contest_problems WHERE contest_id = ? AND problem_id = ?'
        ).bind(Number(problemMatch[1]), problemId).first();
        const currentCount = await env.DB.prepare('SELECT COUNT(*) AS count FROM contest_problems WHERE contest_id = ?')
            .bind(Number(problemMatch[1])).first<any>();
        if (!existingProblem && Number(currentCount?.count || 0) >= 50) return jsonRes({ error: '比赛最多只能设置 50 道题目。' }, 400);
        if (/^1\d+$/.test(problemId)) {
            if (!(await loadAvailableContestProblems()).some(problem => problem.id === problemId)) {
                return jsonRes({ error: '公开题目不存在。' }, 404);
            }
        } else if (/^6\d+$/.test(problemId)) {
            const proposal = await env.DB.prepare("SELECT id FROM oj_proposals WHERE problem_id=? AND proposal_category='contest' AND status='approved'").bind(problemId).first();
            if (!proposal) return jsonRes({ error: '比赛题目不存在或尚未审核通过。' }, 404);
        } else {
            return jsonRes({ error: '团队私有题不能加入比赛。' }, 400);
        }
        const problemName = /^1\d+$/.test(problemId)
            ? (await loadAvailableContestProblems()).find(problem => problem.id === problemId)?.title || `题目 ${problemId}`
            : String((await env.DB.prepare(
                "SELECT problem_name FROM oj_proposals WHERE problem_id=? AND proposal_category='contest' AND status='approved' ORDER BY id DESC LIMIT 1"
            ).bind(problemId).first<any>())?.problem_name || `比赛题 ${problemId}`);
        await env.DB.prepare('INSERT OR REPLACE INTO contest_problems (contest_id,problem_id,problem_name,problem_order,visibility) VALUES (?,?,?,?,?)').bind(Number(problemMatch[1]), problemId, problemName, order, 'contest').run();
        return jsonRes({ ok: true });
    }

    return jsonRes({ error: 'Contest API not found' }, 404);
}
