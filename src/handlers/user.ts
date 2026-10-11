import { getSessionUser, jsonRes, createSession, getSessionMaxAge } from '../utils/auth';
import { checkViolation, violationErrorPage } from '../utils/violation';
import { getTranslator } from '../utils/i18n';
import { normalizeProfileFields, validateAvatarUrl, validateProfileUrl, validateBackgroundUrl, normalizeBackgroundMode } from '../utils/profile';
import { sha256 } from '../utils/crypto';
import { createInviteCode } from '../utils/invite';
import { findLuoguUser, hasLuoguVerificationCode } from '../utils/luogu';
import type { Env } from '../env.d';

export async function handleUser(request: Request, env: Env, path: string) {
    const t = getTranslator(request);
    const method = request.method;
    const db = env.DB;
    const user = await getSessionUser(env, request);

    if (path === '/api/user/luogu/bind' && method === 'POST') {
        if (!user) return jsonRes({ error: t('apiNotLoggedIn') }, 403);
        const current = await db.prepare(
            'SELECT luogu_uid, luogu_username FROM users WHERE id = ?'
        ).bind(user.id).first<{ luogu_uid: number | null; luogu_username: string }>();
        if (current?.luogu_uid) {
            return jsonRes({ error: `此账号已绑定洛谷用户 ${current.luogu_username}。` }, 409);
        }

        const form = await request.formData();
        const username = String(form.get('username') || '').trim();
        if (!username || username.length > 40 || /[\u0000-\u0020\u007f]/.test(username)) {
            return jsonRes({ error: '请输入有效的洛谷用户名（最多 40 个字符，不含空格）。' }, 400);
        }

        const verificationCode = await createInviteCode(user.username);
        const url = new URL('https://www.luogu.com.cn/api/user/search');
        url.searchParams.set('keyword', username);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        let response: Response;
        try {
            response = await fetch(url, {
                method: 'GET',
                headers: {
                    Accept: 'application/json',
                    Referer: 'https://www.luogu.com.cn/',
                },
                signal: controller.signal,
            });
        } catch (error) {
            clearTimeout(timeout);
            console.error('Failed to fetch Luogu user search results:', error);
            return jsonRes({ error: '暂时无法连接洛谷，请稍后重试。' }, 502);
        }
        if (!response.ok) {
            clearTimeout(timeout);
            console.error(`Luogu user search returned HTTP ${response.status}.`);
            return jsonRes({ error: '洛谷用户查询暂时失败，请稍后重试。' }, 502);
        }
        let data: unknown;
        try {
            data = await response.json();
        } catch (error) {
            clearTimeout(timeout);
            console.error('Luogu user search returned invalid JSON:', error);
            return jsonRes({ error: '洛谷返回了无法识别的数据，请稍后重试。' }, 502);
        } finally {
            clearTimeout(timeout);
        }
        const luoguUser = findLuoguUser(data, username);
        if (!luoguUser) return jsonRes({ error: '未找到完全匹配的洛谷用户名。' }, 404);
        if (!hasLuoguVerificationCode(luoguUser.slogan, verificationCode)) {
            return jsonRes({
                error: `请先在洛谷个人签名中加入验证码 ${verificationCode}，保存后再验证。`,
                verification_code: verificationCode,
            }, 400);
        }

        const update = await db.prepare(
            `UPDATE users SET luogu_uid = ?, luogu_username = ?
             WHERE id = ? AND luogu_uid IS NULL
               AND NOT EXISTS (SELECT 1 FROM users WHERE luogu_uid = ?)`
        ).bind(luoguUser.uid, luoguUser.name, user.id, luoguUser.uid).run();
        if (Number(update.meta.changes || 0) !== 1) {
            const [latest, existingOwner] = await Promise.all([
                db.prepare('SELECT luogu_uid, luogu_username FROM users WHERE id = ?').bind(user.id)
                    .first<{ luogu_uid: number | null; luogu_username: string }>(),
                db.prepare('SELECT id FROM users WHERE luogu_uid = ? AND id != ?')
                    .bind(luoguUser.uid, user.id).first(),
            ]);
            if (latest?.luogu_uid) return jsonRes({ error: '此账号已绑定洛谷账号，不能重复绑定。' }, 409);
            if (existingOwner) return jsonRes({ error: '该洛谷账号已被其他站点账号绑定。' }, 409);
            throw new Error('Luogu binding update did not affect exactly one user.');
        }
        return jsonRes({
            ok: true,
            luogu_uid: luoguUser.uid,
            luogu_username: luoguUser.name,
            avatar: luoguUser.avatar,
        });
    }

    if (path === '/api/user/export' && method === 'GET') {
        if (!user) return jsonRes({ error: t('apiNotLoggedIn') }, 403);
        const [articles, comments, likes, bookmarks, referrals, checkins, loginHistory] = await Promise.all([
            db.prepare(
                'SELECT hex_id, title, content, article_type, category, problem_id, created_at FROM articles WHERE author_id = ? ORDER BY created_at DESC'
            ).bind(user.id).all(),
            db.prepare(
                `SELECT c.content, c.parent_id, c.created_at, a.hex_id AS article_hex_id, a.title AS article_title
                 FROM comments c JOIN articles a ON a.id = c.article_id
                 WHERE c.author_id = ? ORDER BY c.created_at DESC`
            ).bind(user.id).all(),
            db.prepare(
                `SELECT a.hex_id, a.title, l.created_at FROM article_likes l
                 JOIN articles a ON a.id = l.article_id WHERE l.user_id = ? ORDER BY l.created_at DESC`
            ).bind(user.id).all(),
            db.prepare(
                `SELECT a.hex_id, a.title, b.created_at FROM article_bookmarks b
                 JOIN articles a ON a.id = b.article_id WHERE b.user_id = ? ORDER BY b.created_at DESC`
            ).bind(user.id).all(),
            db.prepare(
                `SELECT r.created_at, u.username AS invitee_username FROM referrals r
                 JOIN users u ON u.id = r.invitee_id WHERE r.inviter_id = ?
                 UNION ALL
                 SELECT r.created_at, u.username AS invitee_username FROM referrals r
                 JOIN users u ON u.id = r.inviter_id WHERE r.invitee_id = ?`
            ).bind(user.id, user.id).all(),
            db.prepare(
                `SELECT rc.checkin_date, r.inviter_id FROM referral_checkins rc
                 JOIN referrals r ON r.invitee_id = rc.invitee_id
                 WHERE rc.invitee_id = ? OR r.inviter_id = ? ORDER BY rc.checkin_date DESC`
            ).bind(user.id, user.id).all(),
            db.prepare(
                'SELECT ip_address, user_agent, created_at FROM login_history WHERE user_id = ? ORDER BY id DESC LIMIT 100'
            ).bind(user.id).all(),
        ]);
        const exportData = {
            exportedAt: new Date().toISOString(),
            profile: {
                id: user.id,
                username: user.username,
                createdAt: user.created_at,
                points: user.points,
                realName: user.real_name,
                location: user.location,
                profileLink: user.profile_link,
                bio: user.bio,
                avatarUrl: user.avatar_url,
                luoguUid: user.luogu_uid,
                luoguUsername: user.luogu_username,
            },
            articles: articles.results,
            comments: comments.results,
            likedArticles: likes.results,
            bookmarkedArticles: bookmarks.results,
            referrals: referrals.results,
            referralCheckins: checkins.results,
            recentLogins: loginHistory.results,
        };
        return new Response(JSON.stringify(exportData, null, 2), {
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Content-Disposition': `attachment; filename="starlight-user-data-${Number(user.id)}.json"`,
                'Cache-Control': 'private, no-store',
                'X-Content-Type-Options': 'nosniff',
            },
        });
    }

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