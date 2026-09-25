import type { Env } from '../env.d';
import { getSessionUser, jsonRes } from '../utils/auth';
import { writeAudit } from '../utils/audit';
import { ensureUserCanAccessContest } from './contest';

const OJ_BASE_URL = 'https://oj.lin114514.top';

function ojUrl(path: string, request: Request): URL {
    const url = new URL(path, OJ_BASE_URL);
    const incoming = new URL(request.url);
    for (const key of ['pid', 'sid', 'cid', 'contest_id']) {
        const value = incoming.searchParams.get(key);
        if (value) url.searchParams.set(key, value);
    }
    return url;
}

async function proxyJson(url: URL, init?: RequestInit): Promise<Response> {
    try {
        const response = await fetch(url, {
            ...init,
            headers: {
                Accept: 'application/json',
                ...(init?.headers || {}),
            },
        });
        const body = await response.text();
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
    const contestId = Number(incoming.searchParams.get('cid') || incoming.searchParams.get('contest_id') || '0');
    const contestReadAccess = contestId > 0 ? await ensureUserCanAccessContest(env, request, user, contestId) : null;

    if (contestId > 0 && contestReadAccess && !contestReadAccess.ok) {
        return jsonRes({ error: contestReadAccess.error || '比赛权限不足' }, contestReadAccess.status || 403);
    }
    if (contestId > 0 && path === '/api/oj/problems') {
        const rows = await env.DB.prepare('SELECT problem_id, problem_order FROM contest_problems WHERE contest_id = ? ORDER BY problem_order, problem_id').bind(contestId).all<any>();
        return jsonRes({
            count: rows.results.length,
            problems: (rows.results || []).map((row: any) => ({
                id: String(row.problem_id),
                title: `Contest Problem ${row.problem_id}`,
                name: `Contest Problem ${row.problem_id}`,
                difficulty: 'contest',
            })),
        });
    }
    const problemId = incoming.searchParams.get('pid') || incoming.searchParams.get('problem_id') || '';
    if (problemId && contestId === 0 && (/^5\d+$/.test(problemId) || /^6\d+$/.test(problemId))) {
        const proposal = await env.DB.prepare("SELECT proposal_category,team_id,visibility FROM oj_proposals WHERE problem_id=? AND status='approved' ORDER BY id DESC LIMIT 1").bind(problemId).first<any>();
        if (!proposal) return jsonRes({ error: '题目不存在或尚未审核通过。' }, 404);
        if (proposal.proposal_category === 'contest') return jsonRes({ error: '比赛题目必须通过比赛入口并携带 cid 访问。' }, 403);
        if (proposal.visibility === 'private') {
            if (!user || !proposal.team_id) return jsonRes({ error: '仅团队成员可访问该题目。' }, 403);
            const member = await env.DB.prepare("SELECT 1 FROM team_members WHERE team_id=? AND user_id=? AND status='approved'").bind(proposal.team_id, user.id).first();
            if (!member) return jsonRes({ error: '仅团队成员可访问该题目。' }, 403);
        }
    }
    if (contestId > 0 && path === '/api/oj/judge' && request.method === 'POST' && contestReadAccess && contestReadAccess.state === 'ended') {
        return jsonRes({ error: '比赛已结束，无法继续提交。' }, 403);
    }
    if (path === '/api/oj/problems') {
        return proxyJson(ojUrl('/api/get/problem/list', request));
    }
    if (path === '/api/oj/problem') {
        return proxyJson(ojUrl('/api/get/problem', request));
    }
    if (path === '/api/oj/submission') {
        return proxyJson(ojUrl('/api/get/submission', request));
    }
    if (path === '/api/oj/judge' && request.method === 'POST') {
        const body = await request.text();
        return proxyJson(ojUrl('/api/judge/anonymous', request), {
            method: 'POST',
            body,
            headers: { 'Content-Type': request.headers.get('Content-Type') || 'application/json' },
        });
    }
    return new Response(JSON.stringify({ error: 'OJ API not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
}
