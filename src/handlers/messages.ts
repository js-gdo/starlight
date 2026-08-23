import { getSessionUser, jsonRes } from '../utils/auth';
import { checkViolation } from '../utils/violation';
import { sendNotification } from '../utils/notification';
import type { Env } from '../env.d';

export async function handleMessages(request: Request, env: Env, path: string) {
    const method = request.method;
    const db = env.DB;
    const user = await getSessionUser(env, request);

    if (path === '/api/messages/send' && method === 'POST') {
        if (!user) return jsonRes({ error: '未登录' }, 403);
        if (!user.speak) return jsonRes({ error: '您已被禁言，无法发送私信。如需申诉，请提交工单。' }, 403);

        const body = await request.json() as { to_user_id: number; content: string };
        const { to_user_id, content } = body;
        if (!to_user_id || !content) return jsonRes({ error: '缺少参数' }, 400);
        if (parseInt(String(to_user_id)) === user.id) return jsonRes({ error: '不能给自己发私信' }, 400);

        const target = await db.prepare('SELECT * FROM users WHERE id = ?').bind(to_user_id).first();
        if (!target) return jsonRes({ error: '用户不存在' }, 404);

        const violation = await checkViolation(content);
        if (violation.violated) {
            return jsonRes({ error: `内容包含违禁词：${violation.words.join('、')}` }, 400);
        }

        await sendNotification(env, to_user_id, user.id, content, 'private', 0);
        return jsonRes({ message: '私信发送成功' });
    }

    if (path === '/api/messages/read' && method === 'POST') {
        if (!user) return jsonRes({ error: '未登录' }, 403);
        const body = await request.json() as { message_id?: number };
        if (body.message_id) {
            await db.prepare('UPDATE messages SET is_read = 1 WHERE id = ? AND to_user_id = ?')
                .bind(body.message_id, user.id).run();
        } else {
            await db.prepare('UPDATE messages SET is_read = 1 WHERE to_user_id = ? AND is_read = 0')
                .bind(user.id).run();
        }
        return jsonRes({ message: '已标记为已读' });
    }

    if (path === '/api/messages/unread' && method === 'GET') {
        if (!user) return jsonRes({ error: '未登录' }, 403);
        const countResult = await db.prepare('SELECT COUNT(*) as cnt FROM messages WHERE to_user_id = ? AND is_read = 0')
            .bind(user.id).first();
        return jsonRes({ unread: countResult ? countResult.cnt : 0 });
    }

    if (path === '/api/messages/list' && method === 'GET') {
        if (!user) return jsonRes({ error: '未登录' }, 403);
        const messages = await db.prepare(
            `SELECT m.*, u.username as from_name, u.color as from_color, u.tag as from_tag
       FROM messages m
       LEFT JOIN users u ON m.from_user_id = u.id
       WHERE m.to_user_id = ?
       ORDER BY m.created_at DESC LIMIT 50`
        ).bind(user.id).all();
        return jsonRes({ messages: messages.results });
    }

    return jsonRes({ error: 'Not found' }, 404);
}