import { getSessionUser, jsonRes, getPermissionName } from '../utils/auth';
import { sendNotification } from '../utils/notification';
import { getTranslator } from '../utils/i18n';
import type { Env } from '../env.d';

export async function handleAdmin(request: Request, env: Env, path: string) {
    const t = getTranslator(request);
    const method = request.method;
    const db = env.DB;
    const user = await getSessionUser(env, request);

    if (!user || !user.admin) return jsonRes({ error: t('apiPermissionDenied') }, 403);

    const userMatch = path.match(/^\/api\/admin\/user\/(\d+)$/);
    if (userMatch && method === 'POST') {
        const id = parseInt(userMatch[1]);
        const form = await request.formData();
        const mode = String(form.get('mode') || 'profile');
        const color = String(form.get('color') || 'red');
        const tag = String(form.get('tag') || '');
        const permission = form.get('permission');
        const action = form.get('action');
        const reason = String(form.get('reason') || '').trim();

        if (mode === 'permission' && (!permission || !action)) {
            return jsonRes({ error: t('apiMissingPermissionOrAction') }, 400);
        }
        if ((permission && !action) || (!permission && action)) {
            return jsonRes({ error: t('apiPermissionAndActionRequired') }, 400);
        }

        const targetUser = await db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
        if (!targetUser) return jsonRes({ error: t('apiUserNotFound') }, 404);
        if (id === 1 && user.id !== 1) return jsonRes({ error: t('apiCannotModifySuperAdmin') }, 403);

        if (permission && action) {
            if (permission === 'use') {
                const newValue = action === 'grant' ? 1 : 0;
                await db.prepare('UPDATE users SET use = ? WHERE id = ?').bind(newValue, id).run();
            } else if (permission === 'speak') {
                const newValue = action === 'grant' ? 1 : 0;
                await db.prepare('UPDATE users SET speak = ? WHERE id = ?').bind(newValue, id).run();
                if (action === 'revoke') {
                    await db.prepare('UPDATE users SET violation_count = COALESCE(violation_count, 0) + 1 WHERE id = ?').bind(id).run();
                }
            } else if (permission === 'admin') {
                if (user.id !== 1) return jsonRes({ error: t('apiOnlySuperAdminCanSetAdmin') }, 403);
                const newValue = action === 'grant' ? 1 : 0;
                await db.prepare('UPDATE users SET admin = ? WHERE id = ?').bind(newValue, id).run();
            }
        }

        await db.prepare('UPDATE users SET color = ?, tag = ? WHERE id = ?').bind(color, tag, id).run();

        if (permission && action) {
            const finalReason = reason || (action === 'grant' ? t('apiActionGrant') : t('apiActionRevoke'));
            await db.prepare(
                `INSERT INTO permission_logs (target_id, admin_id, action, permission, reason)
                 VALUES (?, ?, ?, ?, ?)`
            ).bind(id, user.id, action, permission, finalReason).run();

            if (targetUser.id !== user.id) {
                const actionText = action === 'grant' ? t('apiActionGrant') : t('apiActionRevoke');
                const permName = permission === 'use' ? t('apiPermissionUse') :
                    permission === 'speak' ? t('apiPermissionSpeak') :
                        t('apiPermissionAdmin');
                await sendNotification(
                    env,
                    <number>targetUser.id,
                    user.id,
                    t('adminPermissionChangeNotify', {
                        permission: permName,
                        action: actionText,
                        reason: finalReason
                    }),
                    'permission_change',
                    0
                );
            }
        }
        return new Response(null, { status: 302, headers: { Location: '/backend' } });
    }

    const userDeleteMatch = path.match(/^\/api\/admin\/user\/(\d+)\/delete$/);
    if (userDeleteMatch && method === 'POST') {
        const id = parseInt(userDeleteMatch[1]);
        if (id === 1) return jsonRes({ error: t('apiCannotModifySuperAdmin') });
        await db.prepare('DELETE FROM comments WHERE article_id IN (SELECT id FROM articles WHERE author_id = ?)').bind(id).run();
        await db.prepare('DELETE FROM comments WHERE author_id = ?').bind(id).run();
        await db.prepare('DELETE FROM articles WHERE author_id = ?').bind(id).run();
        await db.prepare('DELETE FROM ticket_replies WHERE ticket_id IN (SELECT id FROM tickets WHERE author_id = ?)').bind(id).run();
        await db.prepare('DELETE FROM ticket_replies WHERE author_id = ?').bind(id).run();
        await db.prepare('DELETE FROM tickets WHERE author_id = ?').bind(id).run();
        await db.prepare('DELETE FROM benben WHERE author_id = ?').bind(id).run();
        await db.prepare('DELETE FROM messages WHERE from_user_id = ? OR to_user_id = ?').bind(id, id).run();
        await db.prepare('DELETE FROM follows WHERE follower_id = ? OR followee_id = ?').bind(id, id).run();
        await db.prepare('DELETE FROM judgements WHERE target_id = ? OR author_id = ?').bind(id, id).run();
        await db.prepare('DELETE FROM permission_logs WHERE target_id = ? OR admin_id = ?').bind(id, id).run();
        await db.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
        return new Response(null, { status: 302, headers: { Location: '/backend' } });
    }

    const articleDeleteMatch = path.match(/^\/api\/admin\/article\/(\d+)\/delete$/);
    if (articleDeleteMatch && method === 'POST') {
        const id = parseInt(articleDeleteMatch[1]);
        const article = await db.prepare('SELECT * FROM articles WHERE id = ?').bind(id).first();
        if (article && article.author_id !== user.id) {
            await sendNotification(
                env,
                <number>article.author_id,
                user.id,
                t('adminArticleDeleteNotify', { title: article.title }),
                'article_delete',
                id
            );
        }
        await db.prepare('DELETE FROM comments WHERE article_id = ?').bind(id).run();
        await db.prepare('DELETE FROM articles WHERE id = ?').bind(id).run();
        return new Response(null, { status: 302, headers: { Location: '/backend' } });
    }

    const pinMatch = path.match(/^\/api\/admin\/article\/(\d+)\/pin$/);
    if (pinMatch && method === 'POST') {
        const id = parseInt(pinMatch[1]);
        const article = await db.prepare('SELECT is_pinned FROM articles WHERE id = ?').bind(id).first();
        if (!article) return jsonRes({ error: t('apiArticleNotFound') });
        const newStatus = article.is_pinned ? 0 : 1;
        await db.prepare('UPDATE articles SET is_pinned = ? WHERE id = ?').bind(newStatus, id).run();
        return new Response(null, { status: 302, headers: { Location: '/backend' } });
    }

    const lockMatch = path.match(/^\/api\/admin\/article\/(\d+)\/lock$/);
    if (lockMatch && method === 'POST') {
        const id = parseInt(lockMatch[1]);
        const article = await db.prepare('SELECT is_locked FROM articles WHERE id = ?').bind(id).first();
        if (!article) return jsonRes({ error: t('apiArticleNotFound') });
        const newStatus = article.is_locked ? 0 : 1;
        await db.prepare('UPDATE articles SET is_locked = ? WHERE id = ?').bind(newStatus, id).run();
        return new Response(null, { status: 302, headers: { Location: '/backend' } });
    }

    const ticketDeleteMatch = path.match(/^\/api\/admin\/ticket\/(\d+)\/delete$/);
    if (ticketDeleteMatch && method === 'POST') {
        const id = parseInt(ticketDeleteMatch[1]);
        await db.prepare('DELETE FROM ticket_replies WHERE ticket_id = ?').bind(id).run();
        await db.prepare('DELETE FROM tickets WHERE id = ?').bind(id).run();
        return new Response(null, { status: 302, headers: { Location: '/backend' } });
    }

    if (path === '/api/admin/banner/add' && method === 'POST') {
        const form = await request.formData();
        const image_url = form.get('image_url');
        const link_url = form.get('link_url') || '';
        const sort_order = parseInt(String(form.get('sort_order'))) || 0;
        if (!image_url) return jsonRes({ error: t('apiImageUrlRequired') }, 400);
        await db.prepare('INSERT INTO banners (image_url, link_url, sort_order) VALUES (?, ?, ?)')
            .bind(image_url, link_url, sort_order).run();
        return new Response(null, { status: 302, headers: { Location: '/backend' } });
    }

    const bannerDeleteMatch = path.match(/^\/api\/admin\/banner\/(\d+)\/delete$/);
    if (bannerDeleteMatch && method === 'POST') {
        const id = parseInt(bannerDeleteMatch[1]);
        await db.prepare('DELETE FROM banners WHERE id = ?').bind(id).run();
        return new Response(null, { status: 302, headers: { Location: '/backend' } });
    }

    return jsonRes({ error: t('apiNotFound') }, 404);
}