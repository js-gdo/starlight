import { getSessionUser, jsonRes } from '../utils/auth';
import { checkViolation } from '../utils/violation';
import { sendPmChatMessage } from '../utils/notification';
import type { Env } from '../env.d';

export async function handlePm(request: Request, env: Env, path: string) {
    const method = request.method;
    const db = env.DB;
    const user = await getSessionUser(env, request);

    // 查找用户（用于私信发起）
    if (path === '/api/user/find' && method === 'GET') {
        if (!user) return jsonRes({ error: '未登录' }, 403);
        const url = new URL(request.url);
        const username = url.searchParams.get('username');
        if (!username) return jsonRes({ error: '缺少用户名参数' }, 400);
        const found = await db.prepare('SELECT id, username FROM users WHERE username = ?').bind(username).first();
        if (!found) return jsonRes({ error: '用户不存在' }, 404);
        return jsonRes({ uid: found.id, username: found.username });
    }

    // 发送私信
    if (path === '/api/pm/send' && method === 'POST') {
        if (!user) return jsonRes({ error: '未登录' }, 403);
        if (!user.speak) return jsonRes({ error: '您已被禁言，无法发送私信。如需申诉，请提交工单。' }, 403);

        const body = await request.json() as { to_uid: number; content: string };
        const toUid = parseInt(String(body.to_uid));
        const content = (body.content || '').trim();
        if (!toUid || !content) return jsonRes({ error: '缺少参数' }, 400);
        if (toUid === user.id) return jsonRes({ error: '不能给自己发私信' }, 400);

        const target = await db.prepare('SELECT * FROM users WHERE id = ?').bind(toUid).first();
        if (!target) return jsonRes({ error: '用户不存在' }, 404);

        const violation = await checkViolation(content);
        if (violation.violated) {
            return jsonRes({ error: `内容包含违禁词：${violation.words.join('、')}` }, 400);
        }

        await sendPmChatMessage(env, user.id, toUid, content);
        return jsonRes({ message: '发送成功' });
    }

    // 获取聊天记录
    if (path === '/api/pm/chat' && method === 'GET') {
        if (!user) return jsonRes({ error: '未登录' }, 403);
        const url = new URL(request.url);
        const toUid = parseInt(String(url.searchParams.get('to_uid')));
        const after = parseInt(String(url.searchParams.get('after'))) || 0;
        if (!toUid) return jsonRes({ error: '缺少 to_uid 参数' }, 400);

        const messages = await db.prepare(`
      SELECT * FROM messages WHERE type = 'pm_chat' AND id > ? AND
        ((from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?))
      ORDER BY id ASC LIMIT 200
    `).bind(after, user.id, toUid, toUid, user.id).all();

        await db.prepare(`UPDATE messages SET is_read = 1 WHERE type = 'pm_chat' AND from_user_id = ? AND to_user_id = ? AND is_read = 0`)
            .bind(toUid, user.id).run();

        return jsonRes({ messages: messages.results });
    }

    return jsonRes({ error: 'Not found' }, 404);
}