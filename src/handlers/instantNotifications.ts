import { getSessionUser, jsonRes } from '../utils/auth';
import type { Env } from '../env.d';

export async function handleInstantNotifications(request: Request, env: Env, path: string): Promise<Response> {
    const user = await getSessionUser(env, request);
    if (!user) return jsonRes({ error: '请先登录。' }, 403);

    if (path === '/api/noti' && request.method === 'GET') {
        if (Number(user.id) !== 1) return jsonRes({ error: '仅 UID 1 可以发送即时通知。' }, 403);
        const requestOrigin = request.headers.get('Origin');
        const fetchSite = request.headers.get('Sec-Fetch-Site');
        if ((requestOrigin && requestOrigin !== new URL(request.url).origin) || fetchSite === 'cross-site') {
            return jsonRes({ error: '即时通知请求必须来自本站。' }, 403);
        }

        const params = new URL(request.url).searchParams;
        const targetId = params.get('u') || '';
        const title = (params.get('t') || '').trim();
        const content = (params.get('c') || '').trim();
        if (!/^[1-9]\d*$/.test(targetId) || !Number.isSafeInteger(Number(targetId))
            || !title || title.length > 120 || !content || content.length > 2000) {
            return jsonRes({ error: '参数无效：u 必须是用户 UID，标题最多 120 字，内容最多 2000 字。' }, 400);
        }

        const recipient = await env.DB.prepare('SELECT id FROM users WHERE id = ? AND use = 1')
            .bind(Number(targetId)).first<{ id: number }>();
        if (!recipient) return jsonRes({ error: '接收用户不存在或已停用。' }, 404);

        const result = await env.DB.prepare(
            'INSERT INTO instant_notifications (user_id, title, content) VALUES (?, ?, ?)'
        ).bind(Number(targetId), title, content).run();
        return new Response(JSON.stringify({ ok: true, id: Number(result.meta?.last_row_id || 0) }), {
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Cache-Control': 'private, no-store',
            },
        });
    }

    if (path === '/api/noti/poll' && request.method === 'GET') {
        const afterParam = new URL(request.url).searchParams.get('after') ?? '0';
        if (!/^(0|[1-9]\d*)$/.test(afterParam) || !Number.isSafeInteger(Number(afterParam))) {
            return jsonRes({ error: '通知游标无效。' }, 400);
        }

        const rows = await env.DB.prepare(
            `SELECT id, title, content
             FROM instant_notifications
             WHERE user_id = ? AND id > ?
             ORDER BY id ASC
             LIMIT 20`
        ).bind(Number(user.id), Number(afterParam)).all<{ id: number; title: string; content: string }>();
        return new Response(JSON.stringify({
            notifications: (rows.results || []).map(row => ({
                id: Number(row.id),
                title: String(row.title || ''),
                content: String(row.content || ''),
            })),
        }), {
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Cache-Control': 'private, no-store',
            },
        });
    }

    return jsonRes({ error: '方法不允许。' }, 405);
}
