import { getSessionUser, jsonRes } from '../utils/auth';
import { checkViolation, violationErrorPage } from '../utils/violation';
import { getTranslator } from '../utils/i18n';
import { normalizeProfileFields, validateAvatarUrl, validateProfileUrl } from '../utils/profile';
import { sha256 } from '../utils/crypto';
import type { Env } from '../env.d';

export async function handleUser(request: Request, env: Env, path: string) {
    const t = getTranslator(request);
    const method = request.method;
    const db = env.DB;
    const user = await getSessionUser(env, request);

    if (path === '/api/user/password' && method === 'POST') {
        if (!user) return jsonRes({ error: t('apiNotLoggedIn') }, 403);
        const body = await request.json() as { current_password?: string; new_password?: string };
        if (!body.current_password || !body.new_password) return jsonRes({ error: t('apiMissingParams') }, 400);
        if (body.new_password.length < 6 || body.new_password.length > 128) return jsonRes({ error: '新密码长度应为 6-128 位' }, 400);
        const current = await db.prepare('SELECT password FROM users WHERE id = ?').bind(user.id).first<any>();
        if (!current || current.password !== await sha256(body.current_password)) return jsonRes({ error: '当前密码错误' }, 400);
        await db.prepare('UPDATE users SET password = ? WHERE id = ?').bind(await sha256(body.new_password), user.id).run();
        return jsonRes({ ok: true, message: '密码已更新，请重新登录' });
    }

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
        const sidebarMode = String(form.get('sidebar_mode') || 'classic') === 'hover' ? 'hover' : 'classic';
        const uiMode = String(form.get('ui_mode') || 'classic') === 'modern' ? 'modern' : 'classic';
        const normalized = normalizeProfileFields(raw);

        if (normalized.avatar_url && !validateAvatarUrl(normalized.avatar_url)) {
            return jsonRes({ error: '头像链接无效' }, 400);
        }

        if (normalized.profile_link && !validateProfileUrl(normalized.profile_link)) {
            return jsonRes({ error: '个人主页链接无效' }, 400);
        }

        const violation = await checkViolation(normalized.bio);
        if (violation.violated) return violationErrorPage(violation, t);

        await db.prepare('UPDATE users SET bio = ?, avatar_url = ?, location = ?, profile_link = ?, real_name = ?, sidebar_mode = ?, ui_mode = ? WHERE id = ?')
            .bind(normalized.bio, normalized.avatar_url, normalized.location, normalized.profile_link, normalized.real_name, sidebarMode, uiMode, user.id)
            .run();
        return new Response(null, { status: 302, headers: { Location: `/user/${user.id}` } });
    }

    return jsonRes({ error: t('apiNotFound') }, 404);
}