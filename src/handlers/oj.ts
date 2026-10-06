import type { Env } from '../env.d';
import { getSessionUser, jsonRes } from '../utils/auth';
import { writeAudit } from '../utils/audit';
import { ensureUserCanAccessContest } from './contest';
import { filterVisibleOjProblems } from '../utils/problem';

const OJ_BASE_URL = 'https://oj.lin114514.top';

function ojUrl(path: string, request: Request): URL {
    const url = new URL(path, OJ_BASE_URL);
    const incoming = new URL(request.url);
    for (const key of ['pid', 'sid', 'cid', 'contest_id', 'tid']) {
        const value = incoming.searchParams.get(key);
        if (value) url.searchParams.set(key, value);
    }
    return url;
}

async function proxyJson(url: URL, init?: RequestInit, transform?: (data: any) => unknown): Promise<Response> {
    try {
        const response = await fetch(url, {
            ...init,
            headers: {
                Accept: 'application/json',
                ...(init?.headers || {}),
            },
        });
        const responseBody = await response.text();
        const body = transform && response.ok
            ? JSON.stringify(transform(JSON.parse(responseBody)))
            : responseBody;
        return new Response(body, {
            status: response.status,
            headers: { 'Content-Type': response.headers.get('Content-Type') || 'application/json; charset=utf-8' },
        });
    } catch (error) {
        console.error('OJ upstream request failed:', error);
        return new Response(JSON.stringify({ error: 'OJ service is temporarily unavailable.' }), {
            status: 502,
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
        });
    }
}

function filterHiddenProblems(data: any): unknown {
    if (Array.isArray(data)) {
        return filterVisibleOjProblems(data);
    }
    if (!data || typeof data !== 'object' || !Array.isArray(data.problems)) return data;
    const problems = filterVisibleOjProblems(data.problems);
    return {
        ...data,
        problems,
        ...(Object.prototype.hasOwnProperty.call(data, 'count') ? { count: problems.length } : {}),
    };
}

async function requireSuperuser(request: Request, env: Env): Promise<any | null> {
    const user = await getSessionUser(env, request);
    return user?.id === 1 ? user : null;
}

function parseTags(value: string | File | null): string[] {
    return [...new Set(String(value || '').split(/[\n,，]/).map(tag => tag.trim()).filter(Boolean))].slice(0, 12);
}

function validateProposalCategory(categoryValue: string, problemIdValue: string): {
    category: 'public' | 'team' | 'contest';
    problemId: string;
    visibility: 'public' | 'private';
} | { error: string } {
    if (!['public', 'team', 'contest'].includes(categoryValue)) return { error: 'Invalid proposal category.' };
    const category = categoryValue as 'public' | 'team' | 'contest';
    const problemId = problemIdValue.trim();
    if (!problemId) return { category, problemId, visibility: category === 'team' ? 'private' : 'public' };
    if (!/^\d+$/.test(problemId)) return { error: 'Problem ID must be numeric.' };
    if (category === 'public' && !/^1\d+$/.test(problemId)) return { error: 'Public problem ID must start with 1.' };
    if (category === 'team' && !/^5\d+$/.test(problemId)) return { error: 'Team problem ID must start with 5.' };
    if (category === 'contest' && !/^6\d+$/.test(problemId)) return { error: 'Contest problem ID must start with 6.' };
    return {
        category,
        problemId,
        visibility: category === 'team' && Number(problemId.slice(-1)) % 2 === 0 ? 'private' : 'public',
    };
}

async function handleProposalApi(request: Request, env: Env, path: string): Promise<Response | null> {
    const user = await requireSuperuser(request, env);
    if (!user) return jsonRes({ error: 'Only superuser (UID 1) can manage OJ proposals.' }, 403);
    const db = env.DB;

    if (path === '/api/oj/proposals' && request.method === 'GET') {
        const rows = await db.prepare(
            `SELECT p.*, u.username AS proposer_name
             FROM oj_proposals p LEFT JOIN users u ON u.id = p.proposer_id
             ORDER BY p.created_at DESC, p.id DESC`
        ).all<any>();
        return jsonRes({ proposals: (rows.results || []).map(row => ({
            ...row,
            tags: (() => { try { return JSON.parse(String(row.tags || '[]')); } catch { return []; } })(),
        })) });
    }

    if (path === '/api/oj/proposals' && request.method === 'POST') {
        const form = await request.formData();
        const problemName = String(form.get('problem_name') || '').trim().slice(0, 120);
        const tags = parseTags(form.get('tags'));
        const pickupCode = String(form.get('pickup_code') || '').trim().toUpperCase();
        const categoryValue = form.get('proposal_category');
        const problemIdValue = String(form.get('problem_id') || '');
        const categoryResult = validateProposalCategory(String(categoryValue || 'public'), problemIdValue);
        if ('error' in categoryResult) return jsonRes({ error: categoryResult.error }, 400);
        if (categoryValue !== null && !problemIdValue.trim()) return jsonRes({ error: 'Please provide the problem ID.' }, 400);
        const teamIdValue = String(form.get('team_id') || '').trim();
        const teamId = categoryResult.category === 'team' && /^\d+$/.test(teamIdValue) ? Number(teamIdValue) : null;
        if (!problemName) return jsonRes({ error: 'Please enter a problem name.' }, 400);
        if (!/^[A-Z]{5}$/.test(pickupCode)) return jsonRes({ error: 'Pickup code must be exactly 5 uppercase letters.' }, 400);
        if (categoryResult.category === 'team') {
            if (!teamId) return jsonRes({ error: 'Please select a team.' }, 400);
            const team = await db.prepare("SELECT id FROM teams WHERE id = ? AND status = 'active'").bind(teamId).first();
            if (!team) return jsonRes({ error: 'Selected team is unavailable.' }, 400);
            const membership = await db.prepare("SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ? AND status = 'approved'").bind(teamId, user.id).first();
            if (!membership) return jsonRes({ error: 'Only your own team can be selected for team problems.' }, 403);
        }
        let result;
        try {
            result = await db.prepare(
                `INSERT INTO oj_proposals
                 (proposer_id, problem_name, tags, pickup_code, proposal_category, problem_id, team_id, visibility, reviewer_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`
            ).bind(
                user.id,
                problemName,
                JSON.stringify(tags),
                pickupCode,
                categoryResult.category,
                categoryResult.problemId,
                teamId,
                categoryResult.visibility,
            ).run();
        } catch (error) {
            console.error('Failed to create OJ proposal:', error);
            return jsonRes({ error: 'Failed to create proposal. Please try again.' }, 500);
        }
        const proposalId = Number(result.meta?.last_row_id || 0);
        await writeAudit(env, user.id, 'Submit OJ proposal', 'oj_proposal', proposalId,
            `Problem name: ${problemName} | Category: ${categoryResult.category} | Problem ID: ${categoryResult.problemId || 'n/a'} | Tags: ${tags.join(', ') || 'none'} | Pickup code accepted.`);
        return new Response(null, { status: 302, headers: { Location: '/oj/propose?submitted=1' } });
    }

    const reviewMatch = path.match(/^\/api\/oj\/proposals\/(\d+)$/);
    if (reviewMatch && request.method === 'POST') {
        const id = Number(reviewMatch[1]);
        const form = await request.formData();
        const status = String(form.get('status') || '');
        const note = String(form.get('review_note') || '').trim().slice(0, 500);
        if (!['pending', 'approved', 'rejected'].includes(status)) return jsonRes({ error: 'Invalid review status.' }, 400);
        const existing = await db.prepare('SELECT id FROM oj_proposals WHERE id = ?').bind(id).first();
        if (!existing) return jsonRes({ error: 'Proposal not found.' }, 404);
        await db.prepare(
            `UPDATE oj_proposals SET status = ?, reviewer_id = ?, review_note = ?, reviewed_at = datetime('now')
             WHERE id = ?`
        ).bind(status, user.id, note, id).run();
        await writeAudit(env, user.id, `Review OJ proposal: ${status}`, 'oj_proposal', id, note);
        return new Response(null, { status: 302, headers: { Location: '/oj/proposals' } });
    }
    return null;
}

export async function handleOj(request: Request, env: Env, path: string): Promise<Response> {
    if (path === '/api/oj/proposals' || /^\/api\/oj\/proposals\/\d+$/.test(path)) {
        const proposalResponse = await handleProposalApi(request, env, path);
        if (proposalResponse) return proposalResponse;
    }

    const user = await getSessionUser(env, request);
    const incoming = new URL(request.url);
    const rawContestId = incoming.searchParams.get('cid') ?? incoming.searchParams.get('contest_id');
    const hasContestContext = rawContestId !== null;
    const contestId = hasContestContext && /^\d+$/.test(rawContestId || '') ? Number(rawContestId) : 0;
    if (hasContestContext && (!Number.isSafeInteger(contestId) || contestId <= 0)) {
        return jsonRes({ error: '比赛编号无效。' }, 403);
    }
    const contestReadAccess = hasContestContext ? await ensureUserCanAccessContest(env, request, user, contestId) : null;

    if (hasContestContext && contestReadAccess && !contestReadAccess.ok) {
        return jsonRes({ error: contestReadAccess.error || '比赛权限不足' }, 403);
    }
    if (hasContestContext && contestReadAccess?.state !== 'running' &&
        !(contestReadAccess?.state === 'ended' && path === '/api/oj/submission')) {
        return jsonRes({ error: contestReadAccess?.state === 'ended' ? '比赛已结束，题目暂不可访问。' : '比赛尚未开始，暂不可访问。' }, 403);
    }
    if (contestId > 0 && path === '/api/oj/problems') {
        const rows = await env.DB.prepare(
            `SELECT cp.problem_id, cp.problem_name, cp.problem_order, p.problem_name AS proposal_name
             FROM contest_problems cp
             LEFT JOIN oj_proposals p ON p.problem_id = cp.problem_id
               AND p.proposal_category = 'contest' AND p.status = 'approved'
             WHERE cp.contest_id = ? ORDER BY cp.problem_order, cp.problem_id`
        ).bind(contestId).all<any>();
        return jsonRes({
            count: rows.results.length,
            problems: (rows.results || []).map((row: any) => ({
                id: String(row.problem_id),
                title: String(row.problem_name || row.proposal_name || `题目 ${row.problem_id}`),
                name: String(row.problem_name || row.proposal_name || `题目 ${row.problem_id}`),
                difficulty: 'contest',
            })),
        });
    }
    const rawTeamId = incoming.searchParams.get('tid');
    const hasTeamContext = rawTeamId !== null;
    const teamId = hasTeamContext && /^\d+$/.test(rawTeamId || '') ? Number(rawTeamId) : 0;
    if (hasTeamContext) {
        if (!Number.isSafeInteger(teamId) || teamId <= 0 || !user) {
            return jsonRes({ error: '团队编号无效或尚未登录。' }, 403);
        }
        const membership = await env.DB.prepare(
            "SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ? AND status = 'approved'"
        ).bind(teamId, user.id).first();
        if (!membership) return jsonRes({ error: '仅团队成员可访问团队题目。' }, 403);
    }
    if (hasTeamContext && path === '/api/oj/problems' && teamId > 0) {
        const rows = await env.DB.prepare(
            `SELECT problem_id, problem_name, tags FROM oj_proposals
             WHERE proposal_category = 'team' AND team_id = ? AND status = 'approved'
             ORDER BY problem_id`
        ).bind(teamId).all<any>();
        return jsonRes({
            count: rows.results.length,
            problems: (rows.results || []).map((row: any) => ({
                id: String(row.problem_id),
                title: String(row.problem_name || `题目 ${row.problem_id}`),
                name: String(row.problem_name || `题目 ${row.problem_id}`),
                difficulty: 'team',
                tags: (() => { try { return JSON.parse(String(row.tags || '[]')); } catch { return []; } })(),
            })),
        });
    }
    const problemId = incoming.searchParams.get('pid') || incoming.searchParams.get('problem_id') || '';
    if (problemId && contestId > 0) {
        const included = await env.DB.prepare(
            'SELECT 1 FROM contest_problems WHERE contest_id = ? AND problem_id = ?'
        ).bind(contestId, problemId).first();
        if (!included) return jsonRes({ error: '该题目不属于此比赛。' }, 403);
    }
    if (problemId && contestId === 0 && (/^5\d+$/.test(problemId) || /^6\d+$/.test(problemId))) {
        const proposal = await env.DB.prepare("SELECT proposal_category,team_id,visibility FROM oj_proposals WHERE problem_id=? AND status='approved' ORDER BY id DESC LIMIT 1").bind(problemId).first<any>();
        if (!proposal) return jsonRes({ error: '题目不存在或尚未审核通过。' }, 404);
        if (proposal.proposal_category === 'contest') return jsonRes({ error: '比赛题目必须通过比赛入口并携带 cid 访问。' }, 403);
        if (proposal.visibility === 'private') {
            if (!hasTeamContext || teamId !== Number(proposal.team_id) || !user || !proposal.team_id) {
                return jsonRes({ error: '团队私有题必须通过所属团队题目区并携带正确的 tid 参数访问。' }, 403);
            }
            const member = await env.DB.prepare("SELECT 1 FROM team_members WHERE team_id=? AND user_id=? AND status='approved'").bind(proposal.team_id, user.id).first();
            if (!member) return jsonRes({ error: '仅团队成员可访问该题目。' }, 403);
        }
    }
    if (path === '/api/oj/problems') {
        return proxyJson(ojUrl('/api/get/problem/list', request), undefined, filterHiddenProblems);
    }
    if (path === '/api/oj/problem') {
        return proxyJson(ojUrl('/api/get/problem', request));
    }
    if (path === '/api/oj/submission') {
        const sid = incoming.searchParams.get('sid') || '';
        if (contestId > 0) {
            const tracked = await env.DB.prepare(
                'SELECT id, user_id FROM contest_submissions WHERE contest_id = ? AND submission_id = ?'
            ).bind(contestId, sid).first<any>();
            if (!tracked || Number(tracked.user_id) !== Number(user?.id)) {
                return jsonRes({ error: '该提交不属于当前参赛用户。' }, 403);
            }
        }
        const response = await fetch(ojUrl('/api/get/submission', request), {
            headers: { Accept: 'application/json' },
        }).catch((error) => {
            console.error('OJ submission request failed:', error);
            return null;
        });
        if (!response) return jsonRes({ error: 'OJ 服务暂时不可用。' }, 502);
        const body = await response.text();
        if (response.ok && contestId > 0) {
            try {
                const result = JSON.parse(body) as {
                    status?: string; result?: string; passed?: number; total?: number;
                    testpoints?: Array<{ status?: string; result?: string }>;
                };
                const status = String(result.status || result.result || 'Judging');
                const active = /judg|queue|running|pending/i.test(status);
                const points = Array.isArray(result.testpoints) ? result.testpoints : [];
                const total = Math.max(0, Number(result.total || points.length || 0));
                const passed = Math.max(0, Math.min(total, Number(
                    result.passed ?? points.filter(point => /^(?:ac|accepted)$/i.test(String(point.status || point.result || ''))).length
                )));
                if (!active && total > 0) {
                    const score = Math.max(0, Math.min(100, Math.floor((passed / total) * 100)));
                    await env.DB.prepare(
                        "UPDATE contest_submissions SET status = ?, passed = ?, total = ?, score = ?, updated_at = datetime('now') WHERE contest_id = ? AND submission_id = ?"
                    ).bind(status, passed, total, score, contestId, sid).run();
                }
            } catch (error) {
                console.error('Failed to record contest submission score:', error);
            }
        }
        return new Response(body, {
            status: response.status,
            headers: { 'Content-Type': response.headers.get('Content-Type') || 'application/json; charset=utf-8' },
        });
    }
    if (path === '/api/oj/judge' && request.method === 'POST') {
        const rawBody = await request.text();
        let submission: { id?: string | number; code?: string };
        try {
            submission = JSON.parse(rawBody) as { id?: string | number; code?: string };
        } catch {
            return jsonRes({ error: '提交数据格式无效。' }, 400);
        }
        const submittedProblemId = String(submission.id || '');
        if (!submittedProblemId || typeof submission.code !== 'string' || !submission.code.trim()) {
            return jsonRes({ error: '请提供题目编号和代码。' }, 400);
        }
        if (contestId > 0 && submittedProblemId !== problemId) {
            return jsonRes({ error: '提交题目与当前比赛题目不一致。' }, 403);
        }
        if (contestId === 0 && hasTeamContext && /^5[02468]/.test(submittedProblemId)) {
            const proposal = await env.DB.prepare(
                "SELECT team_id, visibility FROM oj_proposals WHERE problem_id = ? AND proposal_category = 'team' AND status = 'approved' ORDER BY id DESC LIMIT 1"
            ).bind(submittedProblemId).first<any>();
            if (!proposal || Number(proposal.team_id) !== teamId) return jsonRes({ error: '该题目不属于指定团队。' }, 403);
        }
        const upstream = await fetch(ojUrl('/api/judge/anonymous', request), {
            method: 'POST',
            body: rawBody,
            headers: {
                Accept: 'application/json',
                'Content-Type': request.headers.get('Content-Type') || 'application/json',
            },
        }).catch((error) => {
            console.error('OJ judge request failed:', error);
            return null;
        });
        if (!upstream) return jsonRes({ error: 'OJ 服务暂时不可用。' }, 502);
        const responseBody = await upstream.text();
        if (upstream.ok && contestId > 0) {
            try {
                const result = JSON.parse(responseBody) as { submissionID?: string | number; submission_id?: string | number; id?: string | number };
                const submissionId = String(result.submissionID ?? result.submission_id ?? result.id ?? '');
                if (submissionId) {
                    await env.DB.prepare(
                        "INSERT OR IGNORE INTO contest_submissions (contest_id, user_id, problem_id, submission_id) VALUES (?, ?, ?, ?)"
                    ).bind(contestId, user!.id, submittedProblemId, submissionId).run();
                }
            } catch (error) {
                console.error('Failed to record contest submission:', error);
            }
        }
        return new Response(responseBody, {
            status: upstream.status,
            headers: { 'Content-Type': upstream.headers.get('Content-Type') || 'application/json; charset=utf-8' },
        });
    }
    return new Response(JSON.stringify({ error: 'OJ API not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
}
