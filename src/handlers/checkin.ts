import { getSessionUser, jsonRes } from '../utils/auth';
import { generateFortune } from '../utils/fortune';
import type { Env } from '../env.d';

export async function handleCheckin(request: Request, env: Env) {
    if (request.method !== 'POST') return jsonRes({ error: 'Method not allowed' }, 405);
    const user = await getSessionUser(env, request);
    if (!user) return jsonRes({ error: '未登录' }, 403);

    const db = env.DB;
    const today = new Date().toISOString().split('T')[0];
    if (user.checkin_date === today) {
        let fortune = null;
        if (user.last_fortune) {
            try { fortune = JSON.parse(user.last_fortune); } catch { }
        }
        if (!fortune) fortune = generateFortune();
        return jsonRes({
            message: '今日已签到',
            fortune: fortune,
            checked: true,
            points: 0
        });
    }

    const fortune = generateFortune();
    const newPoints = (user.points || 0) + 10;
    await db.prepare('UPDATE users SET checkin_date = ?, last_fortune = ?, points = ? WHERE id = ?')
        .bind(today, JSON.stringify(fortune), newPoints, user.id).run();
    return jsonRes({
        message: '签到成功！获得 10 积分',
        fortune: fortune,
        checked: false,
        points: 10,
        total: newPoints
    });
}