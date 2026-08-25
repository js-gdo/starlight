import { getSessionUser, jsonRes } from '../utils/auth';
import { generateFortune } from '../utils/fortune';
import { getTranslator } from '../utils/i18n';
import type { Env } from '../env.d';

export async function handleCheckin(request: Request, env: Env) {
    const t = getTranslator(request);
    if (request.method !== 'POST') return jsonRes({ error: t('apiMethodNotAllowed') }, 405);

    const user = await getSessionUser(env, request);
    if (!user) return jsonRes({ error: t('apiNotLoggedIn') }, 403);

    const db = env.DB;
    const today = new Date().toISOString().split('T')[0];

    if (user.checkin_date === today) {
        let fortune = null;
        if (user.last_fortune) {
            try { fortune = JSON.parse(user.last_fortune); } catch { }
        }
        if (!fortune) fortune = generateFortune();
        return jsonRes({
            message: t('apiAlreadyCheckedin'),
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
        message: t('apiCheckinSuccess'),
        fortune: fortune,
        checked: false,
        points: 10,
        total: newPoints
    });
}