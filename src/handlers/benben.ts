import { getSessionUser, jsonRes } from '../utils/auth';
import { checkViolation, violationErrorPage } from '../utils/violation';
import { getTranslator } from '../utils/i18n';
import type { Env } from '../env.d';

export async function handleBenben(request: Request, env: Env, path: string) {
    const t = getTranslator(request);
    const method = request.method;
    const db = env.DB;
    const user = await getSessionUser(env, request);

    if (path === '/api/benben' && method === 'POST') {
        if (!user) return jsonRes({ error: t('apiNotLoggedIn') }, 403);
        if (!user.speak) return jsonRes({ error: t('apiMuted', { action: t('benben') }) }, 403);

        const form = await request.formData();
        const content = form.get('content');
        if (!content || content.trim() === '') return jsonRes({ error: t('apiBenbenContentEmpty') }, 400);

        const violation = await checkViolation(content);
        if (violation.violated) return violationErrorPage(violation, t);

        await db.prepare('INSERT INTO benben (content, author_id) VALUES (?, ?)')
            .bind(content.trim(), user.id).run();
        return new Response(null, { status: 302, headers: { Location: '/benben' } });
    }

    const match = path.match(/^\/api\/benben\/(\d+)$/);
    if (match && method === 'POST') {
        if (!user) return jsonRes({ error: t('apiNotLoggedIn') }, 403);
        const id = parseInt(match[1]);
        const benben = await db.prepare('SELECT * FROM benben WHERE id = ?').bind(id).first();
        if (!benben) return jsonRes({ error: t('apiBenbenNotFound') });
        if (user.id !== benben.author_id && !user.admin) return jsonRes({ error: t('apiPermissionDenied') });
        await db.prepare('DELETE FROM benben WHERE id = ?').bind(id).run();
        return new Response(null, { status: 302, headers: { Location: '/benben' } });
    }

    return jsonRes({ error: t('apiNotFound') }, 404);
}