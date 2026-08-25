import { getSessionUser, jsonRes } from '../utils/auth';
import { getTranslator } from '../utils/i18n';
import type { Env } from '../env.d';

export async function handleFollow(request: Request, env: Env) {
    const t = getTranslator(request);
    if (request.method !== 'POST') return jsonRes({ error: t('apiMethodNotAllowed') }, 405);

    const user = await getSessionUser(env, request);
    if (!user) return jsonRes({ error: t('apiNotLoggedIn') }, 403);

    const db = env.DB;
    const body = await request.json() as { followee_id: number };
    const followee_id = body.followee_id;

    if (!followee_id) return jsonRes({ error: t('apiMissingParams') });
    if (parseInt(String(followee_id)) === user.id) return jsonRes({ error: t('apiCannotFollowSelf') });

    const exists = await db.prepare('SELECT * FROM follows WHERE follower_id = ? AND followee_id = ?')
        .bind(user.id, followee_id).first();

    if (exists) {
        await db.prepare('DELETE FROM follows WHERE follower_id = ? AND followee_id = ?')
            .bind(user.id, followee_id).run();
        return jsonRes({ message: t('apiUnfollowSuccess') });
    } else {
        await db.prepare('INSERT INTO follows (follower_id, followee_id) VALUES (?, ?)')
            .bind(user.id, followee_id).run();
        return jsonRes({ message: t('apiFollowSuccess') });
    }
}