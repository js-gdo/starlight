import { getSessionUser, jsonRes } from '../utils/auth';
import { checkViolation } from '../utils/violation';
import { sendNotification } from '../utils/notification';
import { getTranslator } from '../utils/i18n';
import type { Env } from '../env.d';

export async function handleMessages(request: Request, env: Env, path: string) {
    const t = getTranslator(request);
    const method = request.method;
    const db = env.DB;
    const user = await getSessionUser(env, request);

    if (path === '/api/messages/send' && method === 'POST') {
        if (!user) return jsonRes({ error: t('apiNotLoggedIn') }, 403);
        if (!user.speak) return jsonRes({ error: t('apiMuted', { action: t('privateMessage') }) }, 403);

        const body = await request.json() as { to_user_id: number; content: string };
        const { to_user_id, content } = body;
        if (!to_user_id || !content) return jsonRes({ error: t('apiMissingParams') }, 400);
        if (parseInt(String(to_user_id)) === user.id) return jsonRes({ error: t('apiCannotMessageSelf') }, 400);

        const target = await db.prepare('SELECT * FROM users WHERE id = ?').bind(to_user_id).first();
        if (!target) return jsonRes({ error: t('apiUserNotFound') }, 404);

        const violation = await checkViolation(content);
        if (violation.violated) {
            return jsonRes({ error: t('apiContentBadWords', { words: violation.words.join('、') }) }, 400);
        }

        await sendNotification(env, to_user_id, user.id, content, 'private', 0);
        return jsonRes({ message: t('apiMessageSent') });
    }

    if (path === '/api/messages/read' && method === 'POST') {
        if (!user) return jsonRes({ error: t('apiNotLoggedIn') }, 403);
        const body = await request.json() as { message_id?: number };
        if (body.message_id) {
            await db.prepare('UPDATE messages SET is_read = 1 WHERE id = ? AND to_user_id = ?')
                .bind(body.message_id, user.id).run();
        } else {
            await db.prepare('UPDATE messages SET is_read = 1 WHERE to_user_id = ? AND is_read = 0')
                .bind(user.id).run();
        }
        return jsonRes({ message: t('apiMarkedAsRead') });
    }

    if (path === '/api/messages/unread' && method === 'GET') {
        if (!user) return jsonRes({ error: t('apiNotLoggedIn') }, 403);
        const countResult = await db.prepare('SELECT COUNT(*) as cnt FROM messages WHERE to_user_id = ? AND is_read = 0')
            .bind(user.id).first();
        return jsonRes({ unread: countResult ? countResult.cnt : 0 });
    }

    if (path === '/api/messages/list' && method === 'GET') {
        if (!user) return jsonRes({ error: t('apiNotLoggedIn') }, 403);
        const messages = await db.prepare(
            `SELECT m.*, u.username as from_name, u.color as from_color, u.tag as from_tag
             FROM messages m
             LEFT JOIN users u ON m.from_user_id = u.id
             WHERE m.to_user_id = ?
             ORDER BY m.created_at DESC LIMIT 50`
        ).bind(user.id).all();
        return jsonRes({ messages: messages.results });
    }

    return jsonRes({ error: t('apiNotFound') }, 404);
}