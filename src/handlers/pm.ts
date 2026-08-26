import { getSessionUser, jsonRes } from '../utils/auth';
import { checkViolation } from '../utils/violation';
import { sendPmChatMessage } from '../utils/notification';
import { getTranslator } from '../utils/i18n';
import { validateAtMentionSpacing, normalizeAtMentionsInContent } from '../utils/html';
import type { Env } from '../env.d';

export async function handlePm(request: Request, env: Env, path: string) {
    const t = getTranslator(request);
    const method = request.method;
    const db = env.DB;
    const user = await getSessionUser(env, request);

    if (path === '/api/user/find' && method === 'GET') {
        if (!user) return jsonRes({ error: t('apiNotLoggedIn') }, 403);
        const url = new URL(request.url);
        const username = url.searchParams.get('username');
        if (!username) return jsonRes({ error: t('apiMissingParams') }, 400);
        const found = await db.prepare('SELECT id, username FROM users WHERE username = ?').bind(username).first();
        if (!found) return jsonRes({ error: t('apiUserNotFound') }, 404);
        return jsonRes({ uid: found.id, username: found.username });
    }

    if (path === '/api/pm/send' && method === 'POST') {
        if (!user) return jsonRes({ error: t('apiNotLoggedIn') }, 403);
        if (!user.speak) return jsonRes({ error: t('apiMuted', { action: t('privateMessage') }) }, 403);

        const body = await request.json() as { to_uid: number; content: string };
        const toUid = parseInt(String(body.to_uid));
        const content = (body.content || '').trim();
        if (!toUid || !content) return jsonRes({ error: t('apiMissingParams') }, 400);
        if (toUid === user.id) return jsonRes({ error: t('apiCannotMessageSelf') }, 400);

        const target = await db.prepare('SELECT * FROM users WHERE id = ?').bind(toUid).first();
        if (!target) return jsonRes({ error: t('apiUserNotFound') }, 404);

        const invalidMentions = validateAtMentionSpacing(content);
        if (invalidMentions.length > 0) return jsonRes({ error: t('apiAtMentionFormat') }, 400);

        const violation = await checkViolation(content);
        if (violation.violated) {
            return jsonRes({ error: t('apiContentBadWords', { words: violation.words.join('、') }) }, 400);
        }

        const normalizedContent = await normalizeAtMentionsInContent(db, content);
        await sendPmChatMessage(env, user.id, toUid, normalizedContent);
        return jsonRes({ message: t('apiMessageSent') });
    }

    if (path === '/api/pm/chat' && method === 'GET') {
        if (!user) return jsonRes({ error: t('apiNotLoggedIn') }, 403);
        const url = new URL(request.url);
        const toUid = parseInt(String(url.searchParams.get('to_uid')));
        const after = parseInt(String(url.searchParams.get('after'))) || 0;
        if (!toUid) return jsonRes({ error: t('apiMissingToUid') }, 400);

        const messages = await db.prepare(`
            SELECT * FROM messages WHERE type = 'pm_chat' AND id > ? AND
                ((from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?))
            ORDER BY id ASC LIMIT 200
        `).bind(after, user.id, toUid, toUid, user.id).all();

        await db.prepare(`UPDATE messages SET is_read = 1 WHERE type = 'pm_chat' AND from_user_id = ? AND to_user_id = ? AND is_read = 0`)
            .bind(toUid, user.id).run();

        return jsonRes({ messages: messages.results });
    }

    return jsonRes({ error: t('apiNotFound') }, 404);
}