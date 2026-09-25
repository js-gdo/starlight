import { getSessionUser, jsonRes } from '../utils/auth';
import type { Env } from '../env.d';

export async function handleRedeem(request: Request, env: Env, path: string) {
    if (path !== '/api/redeem' || request.method !== 'POST') return jsonRes({ error: 'API not found' }, 404);
    const user = await getSessionUser(env, request);
    if (!user) return jsonRes({ error: '请先登录' }, 403);
    const body = await request.json() as { code?: string };
    const code = String(body.code || '').trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9_-]{3,63}$/.test(code)) return jsonRes({ error: '兑换码格式无效' }, 400);
    const result = await env.DB.prepare(
        `SELECT r.*, u.code AS used_code FROM redeem_codes r
         LEFT JOIN redeem_code_uses u ON u.code = r.code AND u.user_id = ?
         WHERE r.code = ? AND r.enabled = 1`
    ).bind(user.id, code).first<any>();
    if (!result) return jsonRes({ error: '兑换码不存在或已失效' }, 404);
    if (result.used_code) return jsonRes({ error: '你已经兑换过此兑换码' }, 409);
    if (Number(result.max_uses) > 0 && Number(result.used_count) >= Number(result.max_uses)) return jsonRes({ error: '兑换码已达到使用次数上限' }, 409);
    if (result.expires_at && String(result.expires_at) < new Date().toISOString()) return jsonRes({ error: '兑换码已过期' }, 409);
    await env.DB.prepare('INSERT INTO redeem_code_uses (code, user_id) VALUES (?, ?)').bind(code, user.id).run();
    await env.DB.prepare('UPDATE redeem_codes SET used_count = used_count + 1 WHERE code = ? AND used_count < max_uses').bind(code).run();
    await env.DB.prepare('UPDATE users SET points = points + ?, server_coin = server_coin + ? WHERE id = ?')
        .bind(Number(result.points || 0), Number(result.server_coin || 0), user.id).run();
    return jsonRes({ ok: true, points: Number(result.points || 0), server_coin: Number(result.server_coin || 0) });
}
