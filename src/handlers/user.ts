import { getSessionUser, jsonRes } from '../utils/auth';
import { checkViolation, violationErrorPage } from '../utils/violation';
import { getTranslator } from '../utils/i18n';
import { normalizeProfileFields, validateAvatarUrl, validateProfileUrl } from '../utils/profile';
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
        const raw = {
            bio: String(form.get('bio') || ''),
            avatar_url: String(form.get('avatar_url') || ''),
            location: String(form.get('location') || ''),
            profile_link: String(form.get('profile_link') || ''),
            real_name: String(form.get('real_name') || ''),
        };
        const normalized = normalizeProfileFields(raw);

        if (normalized.avatar_url && !validateAvatarUrl(normalized.avatar_url)) {
            return jsonRes({ error: '头像链接无效' }, 400);
        }
        if (normalized.profile_link && !validateProfileUrl(normalized.profile_link)) {
            return jsonRes({ error: '个人主页链接无效' }, 400);
        }

        const violation = await checkViolation(normalized.bio);
        if (violation.violated) return violationErrorPage(violation, t);

        await db.prepare('UPDATE users SET bio = ?, avatar_url = ?, location = ?, profile_link = ?, real_name = ? WHERE id = ?')
            .bind(normalized.bio, normalized.avatar_url, normalized.location, normalized.profile_link, normalized.real_name, user.id)
            .run();
        return new Response(null, { status: 302, headers: { Location: `/user/${user.id}` } });
    }

    return jsonRes({ error: t('apiNotFound') }, 404);
}