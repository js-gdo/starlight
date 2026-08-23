import { getSessionUser, jsonRes } from '../utils/auth';
import type { Env } from '../env.d';

export async function handleFollow(request: Request, env: Env) {
    if (request.method !== 'POST') return jsonRes({ error: 'Method not allowed' }, 405);
    const user = await getSessionUser(env, request);
    if (!user) return jsonRes({ error: '未登录' }, 403);

    const db = env.DB;
    const body = await request.json() as { followee_id: number };
    const followee_id = body.followee_id;
    if (!followee_id) return jsonRes({ error: '缺少参数' });
    if (parseInt(String(followee_id)) === user.id) return jsonRes({ error: '不能关注自己' });

    const exists = await db.prepare('SELECT * FROM follows WHERE follower_id = ? AND followee_id = ?')
        .bind(user.id, followee_id).first();
    if (exists) {
        await db.prepare('DELETE FROM follows WHERE follower_id = ? AND followee_id = ?')
            .bind(user.id, followee_id).run();
        return jsonRes({ message: '已取消关注' });
    } else {
        await db.prepare('INSERT INTO follows (follower_id, followee_id) VALUES (?, ?)')
            .bind(user.id, followee_id).run();
        return jsonRes({ message: '关注成功' });
    }
}