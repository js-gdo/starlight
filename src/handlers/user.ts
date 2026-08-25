import { getSessionUser, jsonRes } from '../utils/auth';
import { checkViolation, violationErrorPage } from '../utils/violation';
import { getTranslator } from '../utils/i18n';
import type { Env } from '../env.d';

export async function handleUser(request: Request, env: Env, path: string) {
    const t = getTranslator(request);
    const method = request.method;
    const db = env.DB;
    const user = await getSessionUser(env, request);

    if (path === '/api/user/bio' && method === 'POST') {
        if (!user) return jsonRes({ error: t('apiNotLoggedIn') }, 403);
        if (!user.speak) return jsonRes({ error: t('apiMuted', { action: t('bio') }) }, 403);

        const form = await request.formData();
        const bio = form.get('bio') || '';
        const violation = await checkViolation(bio);
        if (violation.violated) return violationErrorPage(violation, t);

        await db.prepare('UPDATE users SET bio = ? WHERE id = ?').bind(bio.trim(), user.id).run();
        return new Response(null, { status: 302, headers: { Location: `/user/${user.id}` } });
    }

    return jsonRes({ error: t('apiNotFound') }, 404);
}