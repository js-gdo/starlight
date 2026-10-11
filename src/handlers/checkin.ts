import { getSessionUser, jsonRes } from '../utils/auth';
import { generateFortune } from '../utils/fortune';
import { getChinaDateString } from '../utils/time';
import { getTranslator } from '../utils/i18n';
import type { Env } from '../env.d';

export async function handleCheckin(request: Request, env: Env) {
    const t = getTranslator(request);
    if (request.method !== 'POST') return jsonRes({ error: t('apiMethodNotAllowed') }, 405);

    const user = await getSessionUser(env, request);
    if (!user) return jsonRes({ error: t('apiNotLoggedIn') }, 403);

    const db = env.DB;
    const today = getChinaDateString();

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
    const checkinResults = await db.batch([
        db.prepare('UPDATE users SET checkin_date = ?, last_fortune = ?, points = points + 10 WHERE id = ? AND (checkin_date IS NULL OR checkin_date != ?)')
            .bind(today, JSON.stringify(fortune), user.id, today),
        db.prepare(
            `INSERT OR IGNORE INTO referral_checkins (invitee_id, checkin_date)
             SELECT r.invitee_id, ?
             FROM referrals r
             JOIN users u ON u.id = r.invitee_id
             WHERE r.invitee_id = ? AND u.checkin_date = ?`
        ).bind(today, user.id, today),
    ]);
    if (Number(checkinResults[0]?.meta?.changes || 0) === 0) {
        const latest = await db.prepare('SELECT last_fortune FROM users WHERE id = ?').bind(user.id).first<{ last_fortune: string }>();
        let latestFortune = null;
        try {
            if (latest?.last_fortune) latestFortune = JSON.parse(latest.last_fortune);
        } catch {
            latestFortune = null;
        }
        return jsonRes({
            message: t('apiAlreadyCheckedin'),
            fortune: latestFortune || generateFortune(),
            checked: true,
            points: 0,
        });
    }
    const pointsRow = await db.prepare('SELECT points FROM users WHERE id = ?').bind(user.id).first<{ points: number }>();
    const newPoints = Number(pointsRow?.points || 0);
    return jsonRes({
        message: t('apiCheckinSuccess'),
        fortune: fortune,
        checked: false,
        points: 10,
        total: newPoints
    });
}