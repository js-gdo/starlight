import { getSessionUser, jsonRes, createSession, getSessionMaxAge } from '../utils/auth';
import { checkViolation, violationErrorPage } from '../utils/violation';
import { getTranslator } from '../utils/i18n';
import { normalizeProfileFields, validateAvatarUrl, validateProfileUrl, validateBackgroundUrl, normalizeBackgroundMode } from '../utils/profile';
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
        await db.prepare('UPDATE users SET password = ?, session_version = session_version + 1 WHERE id = ?').bind(await sha256(body.new_password), user.id).run();
        const session = await createSession(env, user.id);
        return new Response(JSON.stringify({ ok: true, message: '密码已更新，其他设备已退出' }), {
            headers: {
                'Content-Type': 'application/json',
                'Set-Cookie': `uid=${session}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${getSessionMaxAge()}`,
            },
        });
    }

    if (path === '/api/user/sessions/revoke-others' && method === 'POST') {
        if (!user) return jsonRes({ error: t('apiNotLoggedIn') }, 403);
        await db.prepare('UPDATE users SET session_version = session_version + 1 WHERE id = ?').bind(user.id).run();
        const session = await createSession(env, user.id);
        return new Response(JSON.stringify({ ok: true, message: '其他设备已退出登录' }), {
            headers: {
                'Content-Type': 'application/json',
                'Set-Cookie': `uid=${session}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${getSessionMaxAge()}`,
            },
        });
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
        const layoutMode = String(form.get('layout_mode') || 'classic') === 'starlight' ? 'starlight' : 'classic';
        const backgroundUrl = String(form.get('background_url') || '').trim();
        const backgroundMode = normalizeBackgroundMode(form.get('background_mode'));
        const redirectDelayValue = Number.parseInt(String(form.get('redirect_delay_seconds') || '5'), 10);
        const redirectDelay = redirectDelayValue === 0 || redirectDelayValue >= 5 ? Math.min(redirectDelayValue, 300) : 5;
        const normalized = normalizeProfileFields(raw);

        if (normalized.avatar_url && !validateAvatarUrl(normalized.avatar_url)) {
            return jsonRes({ error: '头像链接无效' }, 400);
        }

        if (normalized.profile_link && !validateProfileUrl(normalized.profile_link)) {
            return jsonRes({ error: '个人主页链接无效' }, 400);
        }

        if (!validateBackgroundUrl(backgroundUrl)) {
            return jsonRes({ error: '背景图片 URL 无效，请使用有效的 HTTP 或 HTTPS 图片链接' }, 400);
        }

        const violation = await checkViolation(normalized.bio);
        if (violation.violated) return violationErrorPage(violation, t);

        await db.prepare('UPDATE users SET bio = ?, avatar_url = ?, location = ?, profile_link = ?, real_name = ?, sidebar_mode = ?, ui_mode = ?, layout_mode = ?, background_url = ?, background_mode = ?, redirect_delay_seconds = ? WHERE id = ?')
            .bind(normalized.bio, normalized.avatar_url, normalized.location, normalized.profile_link, normalized.real_name, sidebarMode, uiMode, layoutMode, backgroundUrl, backgroundMode, redirectDelay, user.id)
            .run();
        return new Response(null, { status: 302, headers: { Location: `/user/${user.id}` } });
    }

    return jsonRes({ error: t('apiNotFound') }, 404);
}