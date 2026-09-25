import type { Env } from '../env.d';
import { getSessionUser, jsonRes } from '../utils/auth';
import { writeAudit } from '../utils/audit';

const OJ_BASE_URL = 'https://oj.lin114514.top';

function ojUrl(path: string, request: Request): URL {
    const url = new URL(path, OJ_BASE_URL);
    const incoming = new URL(request.url);
    for (const key of ['pid', 'sid']) {
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
        return new Response(JSON.stringify({ error: 'OJ 服务暂时不可用，请稍后重试' }), {
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
    return [...new Set(String(value || '').split(/[,，\n]/).map(tag => tag.trim()).filter(Boolean))].slice(0, 12);
}

async function handleProposalApi(request: Request, env: Env, path: string): Promise<Response | null> {
    const user = await requireSuperuser(request, env);
    if (!user) return jsonRes({ error: '仅 superuser（UID 1）可管理 OJ 投题' }, 403);
    const db = env.DB;

    if (path === '/api/oj/proposals' && request.method === 'GET') {
        const rows = await db.prepare(
            `SELECT p.*, u.username AS proposer_name
             FROM oj_proposals p LEFT JOIN users u ON u.id = p.proposer_id
             ORDER BY p.created_at DESC, p.id DESC`
        ).all<any>();
        return jsonRes({ proposals: (rows.results || []).map(row => ({
            ...row,
            tags: (() => { try { return JSON.parse(String(row.tags || '[]')); } catch { return []; } })()
        })) });
    }

    if (path === '/api/oj/proposals' && request.method === 'POST') {
        const form = await request.formData();
        const problemName = String(form.get('problem_name') || '').trim().slice(0, 120);
        const tags = parseTags(form.get('tags'));
        const pickupCode = String(form.get('pickup_code') || '').trim().toUpperCase();
        if (!problemName) return jsonRes({ error: '请填写题目名称' }, 400);
        if (!/^[A-Z]{5}$/.test(pickupCode)) return jsonRes({ error: '取件码必须是 5 个英文字母' }, 400);
        const result = await db.prepare(
            `INSERT INTO oj_proposals (proposer_id, problem_name, tags, pickup_code)
             VALUES (?, ?, ?, ?)`
        ).bind(user.id, problemName, JSON.stringify(tags), pickupCode).run();
        const proposalId = Number(result.meta?.last_row_id || 0);
        await writeAudit(env, user.id, '提交 OJ 投题', 'oj_proposal', proposalId,
            `题目名称: ${problemName} | 标签: ${tags.join(', ') || '无'} | 外部取件码已登记`);
        return new Response(null, { status: 302, headers: { Location: '/oj/propose?submitted=1' } });
    }

    const reviewMatch = path.match(/^\/api\/oj\/proposals\/(\d+)$/);
    if (reviewMatch && request.method === 'POST') {
        const id = Number(reviewMatch[1]);
        const form = await request.formData();
        const status = String(form.get('status') || '');
        const note = String(form.get('review_note') || '').trim().slice(0, 500);
        if (!['pending', 'approved', 'rejected'].includes(status)) return jsonRes({ error: '无效的审核状态' }, 400);
        const existing = await db.prepare('SELECT id FROM oj_proposals WHERE id = ?').bind(id).first();
        if (!existing) return jsonRes({ error: '投题记录不存在' }, 404);
        await db.prepare(
            `UPDATE oj_proposals SET status = ?, reviewer_id = ?, review_note = ?, reviewed_at = datetime('now')
             WHERE id = ?`
        ).bind(status, user.id, note, id).run();
        await writeAudit(env, user.id, `审核 OJ 投题：${status}`, 'oj_proposal', id, note);
        return new Response(null, { status: 302, headers: { Location: '/oj/proposals' } });
    }
    return null;
}

export async function handleOj(request: Request, env: Env, path: string): Promise<Response> {
    if (path === '/api/oj/proposals' || /^\/api\/oj\/proposals\/\d+$/.test(path)) {
        const proposalResponse = await handleProposalApi(request, env, path);
        if (proposalResponse) return proposalResponse;
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
