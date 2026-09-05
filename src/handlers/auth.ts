import { getSessionUser, jsonRes } from '../utils/auth';
import { sha256 } from '../utils/crypto';
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
        let loginRegion = request.cf?.region || '';
        let loginCity = request.cf?.city || '';
        const loginTime = new Date().toISOString();
        try {
            const info = await getLocationInfo(loginIp);
            loginRegion = info.region || loginRegion;
            loginCity = info.city || loginCity;
        } catch { }

        await db.prepare('UPDATE users SET last_ip = ?, last_region = ?, last_city = ?, last_login_at = ? WHERE id = ?')
            .bind(loginIp, loginRegion, loginCity, loginTime, dbUser.id).run();

        return new Response(JSON.stringify({
            message: t('apiLoginSuccess'),
            user: { id: dbUser.id, username: dbUser.username, admin: dbUser.admin, color: dbUser.color }
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Set-Cookie': `uid=${dbUser.id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`
            }
        });
    }

    if (path === '/api/register' && method === 'POST') {
        const body = await request.json() as { username: string; password: string };
        const { username, password } = body;
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

        const hashedPassword = await sha256(password);
        await db.prepare('INSERT INTO users (username, password, color) VALUES (?, ?, ?)')
            .bind(username, hashedPassword, 'red').run();
        return jsonRes({ message: t('apiRegisterSuccess') }, 201);
    }

    return jsonRes({ error: t('apiNotFound') }, 404);
}