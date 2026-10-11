import { getSessionUser, jsonRes, createSession, getSessionMaxAge } from '../utils/auth';
import { sha256 } from '../utils/crypto';
import { createInviteCode } from '../utils/invite';
import { getLocationInfo } from '../utils/auth';
import { getTranslator } from '../utils/i18n';
import type { Env } from '../env.d';

export async function handleAuth(request: Request, env: Env, path: string) {
    const t = getTranslator(request);
    const method = request.method;
    const db = env.DB;

    if (path === '/api/login' && method === 'GET') {
        const user = await getSessionUser(env, request);
        if (!user) return jsonRes({ error: t('apiNotLoggedIn') }, 403);

        return jsonRes({
            user: {
                id: user.id,
                username: user.username,
                admin: user.admin,
                color: user.color,
                tag: user.tag,
                avatar_url: user.avatar_url,
            },
        });
    }

    if (path === '/api/login' && method === 'POST') {
        const body = await request.json() as { username: string; password: string };
        const { username, password } = body;
        if (!username || !password) return jsonRes({ error: t('apiMissingParams') }, 400);

        const hashedPassword = await sha256(password);
        const dbUser = await db.prepare('SELECT * FROM users WHERE username = ? AND password = ?')
            .bind(username, hashedPassword).first();
        if (!dbUser) return jsonRes({ error: t('apiLoginFailed') }, 401);
        if (!dbUser.use) return jsonRes({ error: t('apiBanned') }, 403);

        const loginIp = request.headers.get('CF-Connecting-IP') || '';
        let loginRegion = String(request.cf?.region || '');
        let loginCity = String(request.cf?.city || '');
        const loginTime = new Date().toISOString();
        try {
            const info = await getLocationInfo(loginIp, loginRegion, loginCity);
            loginRegion = info.region || loginRegion;
            loginCity = info.city || loginCity;
        } catch { }

        await db.prepare('UPDATE users SET last_ip = ?, last_region = ?, last_city = ?, last_login_at = ? WHERE id = ?')
            .bind(loginIp, loginRegion, loginCity, loginTime, dbUser.id).run();
        await db.prepare('INSERT INTO login_history (user_id, ip_address, user_agent, created_at) VALUES (?, ?, ?, ?)')
            .bind(dbUser.id, loginIp, (request.headers.get('User-Agent') || '').slice(0, 500), loginTime).run();
        await db.prepare('DELETE FROM login_history WHERE user_id = ? AND id NOT IN (SELECT id FROM login_history WHERE user_id = ? ORDER BY id DESC LIMIT 10)')
            .bind(dbUser.id, dbUser.id).run();

        return new Response(JSON.stringify({
            message: t('apiLoginSuccess'),
            user: { id: dbUser.id, username: dbUser.username, admin: dbUser.admin, color: dbUser.color, avatar_url: dbUser.avatar_url }
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Set-Cookie': `uid=${await createSession(env, dbUser.id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${getSessionMaxAge()}`
            }
        });
    }

    if (path === '/api/register' && method === 'POST') {
        const body = await request.json() as { username: string; password: string; inviteCode?: string };
        const username = String(body.username || '');
        const password = String(body.password || '');
        const inviteCode = String(body.inviteCode || '').trim().toLowerCase();
        if (!username || !password) return jsonRes({ error: t('apiMissingParams') }, 400);
        if (username.length < 3) return jsonRes({ error: t('apiUsernameLength') }, 400);
        if (username.length > 25) return jsonRes({ error: t('apiUsernameMaxLength') }, 400);
        if (password.length < 6) return jsonRes({ error: t('apiPasswordLength') }, 400);

        const { checkViolation } = await import('../utils/violation');
        const nameViolation = await checkViolation(username);
        if (nameViolation.violated) {
            return jsonRes({ error: t('apiUsernameBadWords', { words: nameViolation.words.join('、') }) }, 400);
        }

        const existing = await db.prepare('SELECT * FROM users WHERE username = ?').bind(username).first();
        if (existing) return jsonRes({ error: t('apiUsernameExists') }, 409);

        let inviter: { id: number; registered_ip: string; last_ip: string } | null = null;
        if (inviteCode) {
            if (!/^[0-9a-f]{4}$/.test(inviteCode)) return jsonRes({ error: '邀请码必须是 4 位十六进制字符' }, 400);
            const inviterRows = await db.prepare(
                'SELECT id, registered_ip, last_ip FROM users WHERE invite_code = ? LIMIT 2'
            ).bind(inviteCode).all<{ id: number; registered_ip: string; last_ip: string }>();
            if (!inviterRows.results?.length) return jsonRes({ error: '邀请码无效' }, 400);
            if (inviterRows.results.length > 1) return jsonRes({ error: '该邀请码存在重复，请联系邀请人更换邀请码' }, 400);
            inviter = inviterRows.results[0];
            const registeringIp = request.headers.get('CF-Connecting-IP') || '';
            const inviterIp = inviter.registered_ip || inviter.last_ip || '';
            if (registeringIp && inviterIp && registeringIp === inviterIp) {
                return jsonRes({ error: '邀请人与注册者 IP 相同，请删除邀请码后重试' }, 400);
            }
        }

        const hashedPassword = await sha256(password);
        const newUserInviteCode = await createInviteCode(username);
        const starterAssets = JSON.stringify(['E5-2686 v4', 'X99 主板', '16GB DDR4', '1TB HDD']);
        const registeredIp = request.headers.get('CF-Connecting-IP') || '';
        const insertUser = db.prepare('INSERT INTO users (username, password, color, points, invite_code, registered_ip, server_coin, server_hardware_score, server_assets, server_cpu, server_motherboard, server_ram, server_storage) VALUES (?, ?, ?, ?, ?, ?, 5, 28216, ?, ?, ?, ?, ?)')
            .bind(username, hashedPassword, 'red', inviter ? 30 : 0, newUserInviteCode, registeredIp, starterAssets, 'E5-2686 v4', 'X99 主板', '16GB DDR4', '1TB HDD');
        if (inviter) {
            await db.batch([
                insertUser,
                db.prepare('INSERT INTO referrals (invitee_id, inviter_id) SELECT id, ? FROM users WHERE username = ?')
                    .bind(inviter.id, username),
            ]);
        } else {
            await insertUser.run();
        }
        return jsonRes({ message: t('apiRegisterSuccess'), invited: Boolean(inviter), pointsAwarded: inviter ? 30 : 0 }, 201);
    }

    return jsonRes({ error: t('apiNotFound') }, 404);
}