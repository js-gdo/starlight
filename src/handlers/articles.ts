import { getSessionUser, jsonRes, generateHex } from '../utils/auth';
import { checkViolation, violationErrorPage } from '../utils/violation';
import { sendNotification } from '../utils/notification';
import { getTranslator } from '../utils/i18n';
import { validateAtMentionSpacing } from '../utils/html';
import type { Env } from '../env.d';

export async function handleArticles(request: Request, env: Env, path: string) {
    const t = getTranslator(request);
    const method = request.method;
    const db = env.DB;
    const user = await getSessionUser(env, request);

    if (path === '/api/articles' && method === 'POST') {
        if (!user) return jsonRes({ error: t('apiNotLoggedIn') }, 403);
        if (!user.speak) return jsonRes({ error: t('apiMuted', { action: t('newArticle') }) }, 403);

        const form = await request.formData();
        const title = form.get('title');
        const content = form.get('content');
        if (!title || !content) return jsonRes({ error: t('apiMissingTitleOrContent') });

        const invalidMentions = validateAtMentionSpacing(String(content));
        if (invalidMentions.length > 0) return jsonRes({ error: t('apiAtMentionFormat') }, 400);

        const violation = await checkViolation(`${title}\n${content}`);
        if (violation.violated) return violationErrorPage(violation, t);

        const hex = generateHex();
        await db.prepare('INSERT INTO articles (hex_id, title, content, author_id) VALUES (?, ?, ?, ?)')
            .bind(hex, title, content, user.id).run();
        return new Response(null, { status: 302, headers: { Location: `/articles/${hex}` } });
    }

    const articleMatch = path.match(/^\/api\/articles\/(\d+)$/);
    if (articleMatch && method === 'POST') {
        const id = parseInt(articleMatch[1]);
        const form = await request.formData();
        const methodOverride = form.get('_method');

        if (methodOverride === 'PUT') {
            if (!user) return jsonRes({ error: t('apiNotLoggedIn') }, 403);
            const article = await db.prepare('SELECT * FROM articles WHERE id = ?').bind(id).first();
            if (!article) return jsonRes({ error: t('apiArticleNotFound') });
            if (user.id !== article.author_id && !user.admin) return jsonRes({ error: t('apiPermissionDenied') });
            if (!user.speak) return jsonRes({ error: t('apiMuted', { action: t('editArticle') }) }, 403);

            const title = form.get('title');
            const content = form.get('content');
            if (!title || !content) return jsonRes({ error: t('apiMissingTitleOrContent') });

            const invalidMentions = validateAtMentionSpacing(String(content));
            if (invalidMentions.length > 0) return jsonRes({ error: t('apiAtMentionFormat') }, 400);

            const violation = await checkViolation(`${title}\n${content}`);
            if (violation.violated) return violationErrorPage(violation, t);

            await db.prepare('UPDATE articles SET title = ?, content = ? WHERE id = ?')
                .bind(title, content, id).run();
            return new Response(null, { status: 302, headers: { Location: `/articles/${article.hex_id}` } });
        } else if (methodOverride === 'DELETE') {
            if (!user) return jsonRes({ error: t('apiNotLoggedIn') }, 403);
            const article = await db.prepare('SELECT * FROM articles WHERE id = ?').bind(id).first();
            if (!article) return jsonRes({ error: t('apiArticleNotFound') });
            if (user.id !== article.author_id && !user.admin) return jsonRes({ error: t('apiPermissionDenied') });
            await db.prepare('DELETE FROM comments WHERE article_id = ?').bind(id).run();
            await db.prepare('DELETE FROM articles WHERE id = ?').bind(id).run();
            return new Response(null, { status: 302, headers: { Location: '/articles/list' } });
        }
        return jsonRes({ error: t('apiInvalidRequest') }, 400);
    }

    if (path === '/api/comments' && method === 'POST') {
        if (!user) return jsonRes({ error: t('apiNotLoggedIn') }, 403);
        if (!user.speak) return jsonRes({ error: t('apiMuted', { action: t('comments') }) }, 403);

        const form = await request.formData();
        const article_id = form.get('article_id');
        const content = form.get('content');
        const parent_id = parseInt(String(form.get('parent_id'))) || 0;
        if (!article_id || !content) return jsonRes({ error: t('apiMissingParams') });

        const targetArticle = await db.prepare('SELECT is_locked, author_id FROM articles WHERE id = ?')
            .bind(article_id).first();
        if (!targetArticle) return jsonRes({ error: t('apiArticleNotFound') }, 404);
        if (targetArticle.is_locked && !user.admin) return jsonRes({ error: t('lockedCannotComment') }, 403);

        const invalidMentions = validateAtMentionSpacing(String(content));
        if (invalidMentions.length > 0) return jsonRes({ error: t('apiAtMentionFormat') }, 400);

        const violation = await checkViolation(content);
        if (violation.violated) return violationErrorPage(violation, t);

        await db.prepare('INSERT INTO comments (article_id, author_id, content, parent_id) VALUES (?, ?, ?, ?)')
            .bind(article_id, user.id, content, parent_id).run();

        if (targetArticle.author_id !== user.id) {
            await sendNotification(env, targetArticle.author_id, user.id,
                `${t('comments')}: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`,
                'comment', parseInt(String(article_id)));
        }
        const referer = request.headers.get('referer') || '/articles/list';
        return new Response(null, { status: 302, headers: { Location: referer } });
    }

    const commentMatch = path.match(/^\/api\/comments\/(\d+)$/);
    if (commentMatch && method === 'POST') {
        if (!user) return jsonRes({ error: t('apiNotLoggedIn') }, 403);
        const form = await request.formData();
        const methodOverride = form.get('_method');
        if (methodOverride === 'DELETE') {
            const id = parseInt(commentMatch[1]);
            const comment = await db.prepare('SELECT * FROM comments WHERE id = ?').bind(id).first();
            if (!comment) return jsonRes({ error: t('apiCommentDeleted') });
            if (user.id !== comment.author_id && !user.admin) return jsonRes({ error: t('apiPermissionDenied') });
            await db.prepare('DELETE FROM comments WHERE id = ?').bind(id).run();
            const referer = request.headers.get('referer') || '/articles/list';
            return new Response(null, { status: 302, headers: { Location: referer } });
        }
        return jsonRes({ error: t('apiInvalidRequest') }, 400);
    }

    return jsonRes({ error: t('apiNotFound') }, 404);
}