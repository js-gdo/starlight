import { getSessionUser, jsonRes } from '../utils/auth';
import { sha256 } from '../utils/crypto';
import { getLocationInfo } from '../utils/auth'; // 从 auth 工具中导入
import type { Env } from '../env.d';

export async function handleAuth(request: Request, env: Env, path: string) {
    const method = request.method;
    const db = env.DB;

    if (path === '/api/login' && method === 'POST') {
        const body = await request.json() as { username: string; password: string };
        const { username, password } = body;
        if (!username || !password) return jsonRes({ error: '用户名和密码不能为空' }, 400);
        const hashedPassword = await sha256(password);
        const dbUser = await db.prepare('SELECT * FROM users WHERE username = ? AND password = ?')
            .bind(username, hashedPassword).first();
        if (!dbUser) return jsonRes({ error: '用户名或密码错误' }, 401);
        if (!dbUser.use) return jsonRes({ error: '您的账号已被禁用' }, 403);

        // 记录登录IP和地域
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
            message: '登录成功',
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
        if (!username || !password) return jsonRes({ error: '用户名和密码不能为空' }, 400);
        if (username.length < 3) return jsonRes({ error: '用户名至少3个字符' }, 400);
        if (username.length > 25) return jsonRes({ error: '用户名不能超过25个字符' }, 400);
        if (password.length < 6) return jsonRes({ error: '密码至少6个字符' }, 400);

        // 检查用户名违禁词（需导入 checkViolation）
        const { checkViolation } = await import('../utils/violation');
        const nameViolation = await checkViolation(username);
        if (nameViolation.violated) {
            return jsonRes({ error: `用户名包含违禁词：${nameViolation.words.join('、')}` }, 400);
        }

        const existing = await db.prepare('SELECT * FROM users WHERE username = ?').bind(username).first();
        if (existing) return jsonRes({ error: '用户名已存在' }, 409);
        const hashedPassword = await sha256(password);
        await db.prepare('INSERT INTO users (username, password, color) VALUES (?, ?, ?)')
            .bind(username, hashedPassword, 'red').run();
        return jsonRes({ message: '注册成功！请登录' }, 201);
    }

    return jsonRes({ error: 'Not found' }, 404);
}