import { handleAuth } from './auth';
import { handleArticles } from './articles';
import { handleTickets } from './tickets';
import { handleBenben } from './benben';
import { handleCheckin } from './checkin';
import { handleFollow } from './follow';
import { handleMessages } from './messages';
import { handlePm } from './pm';
import { handleAdmin } from './admin';
import { handleUser } from './user';
import { handleReports } from './reports';
import { handleServer } from './server';
import { handleHealth } from './health';
import { handleEgg } from './egg';
import { handleOj } from './oj';
import { jsonRes } from '../utils/auth';
import { getPointsRankBadgeLevel, getUserColor, isValidUserColor } from '../utils/constants';
import { getAchievementBadges, getAchievementDefinition, getUserAchievementIds } from '../utils/achievements';
import { htmlEscape } from '../utils/html';
import { validateAvatarUrl } from '../utils/profile';
import { handleRedeem } from './redeem';
import { handleGame } from './game';
import { handleTeams } from './teams';
import { handleContests } from './contest';
import type { Env } from '../env.d';

async function renderUserSvg(env: Env, uid: number): Promise<Response> {
    const user = await env.DB.prepare(
        'SELECT id, username, color, tag, avatar_url, points, admin, use FROM users WHERE id = ?'
    ).bind(uid).first<any>();
    if (!user || !user.use) return jsonRes({ error: 'User not found' }, 404);

    const totalRow = await env.DB.prepare('SELECT COUNT(*) AS count FROM users WHERE use = 1').first<any>();
    const rankRow = await env.DB.prepare(
        `SELECT COUNT(*) AS count FROM users
         WHERE use = 1 AND (points > ? OR (points = ? AND id <= ?))`
    ).bind(Number(user.points || 0), Number(user.points || 0), uid).first<any>();
    const rankLevel = getPointsRankBadgeLevel(Number(rankRow?.count || 0), Number(totalRow?.count || 0));
    await getAchievementBadges(env.DB, uid);
    const achievementIds = await getUserAchievementIds(env.DB, uid);
    const achievements = achievementIds
        .map((id) => getAchievementDefinition(id))
        .filter((achievement): achievement is NonNullable<typeof achievement> => !!achievement);
    const visibleAchievements = achievements.slice(0, 16);
    const name = String(user.username || 'Unknown');
    const safeName = htmlEscape(name);
    const usernameWidth = Array.from(name).reduce((width, char) => width + (char.codePointAt(0)! > 255 ? 27 : 15), 0);
    const width = Math.max(
        640,
        151 + usernameWidth + (rankLevel ? 42 : 0) + 24,
        180 + visibleAchievements.length * 34 + (achievements.length > visibleAchievements.length ? 46 : 0)
    );
    const colorKey = String(user.color || 'red');
    const safeColorKey = isValidUserColor(colorKey) ? colorKey : 'red';
    const nameColor = safeColorKey === 'rainbow' ? 'url(#username-gradient)' : getUserColor(safeColorKey);
    const avatarUrl = String(user.avatar_url || '');
    const safeAvatarUrl = validateAvatarUrl(avatarUrl) ? htmlEscape(avatarUrl) : '';
    const initial = htmlEscape(Array.from(name)[0] || '?').toUpperCase();
    const tag = String(user.tag || '');
    const safeTag = htmlEscape(Array.from(tag).slice(0, 28).join(''));
    const tagWidth = Math.max(38, Math.min(Array.from(tag).length, 28) * 12 + 22);
    const tagColor = safeColorKey === 'rainbow' ? 'url(#username-gradient)' : getUserColor(safeColorKey);
    const rankColor = rankLevel === 'gold' ? '#f1c40f' : rankLevel === 'blue' ? '#3498db' : '#5eb95e';
    const gradient = safeColorKey === 'rainbow'
        ? '<linearGradient id="username-gradient"><stop stop-color="#E74C3C"/><stop offset="14%" stop-color="#E67E22"/><stop offset="29%" stop-color="#F1C40F"/><stop offset="43%" stop-color="#5EB95E"/><stop offset="57%" stop-color="#00BCD4"/><stop offset="71%" stop-color="#0E90D2"/><stop offset="100%" stop-color="#8E44AD"/></linearGradient>'
        : '';
    const achievementSvg = visibleAchievements.map((achievement, index) => {
        const x = 151 + index * 34;
        return `<g transform="translate(${x} 139)"><title>${htmlEscape(achievement.name + ': ' + achievement.description)}</title><circle r="11" fill="${htmlEscape(achievement.color)}" opacity=".14"/><text text-anchor="middle" dominant-baseline="central" font-size="15" fill="${htmlEscape(achievement.color)}">${htmlEscape(achievement.icon)}</text></g>`;
    }).join('');
    const remaining = achievements.length - visibleAchievements.length;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="168" viewBox="0 0 ${width} 168" role="img" aria-label="${safeName} profile">
  <title>${safeName} · UID ${uid}</title>
  <defs>${gradient}<clipPath id="avatar-clip"><circle cx="78" cy="82" r="52"/></clipPath></defs>
  <a href="/user/${uid}" target="_top" aria-label="View ${safeName}'s profile">
    <rect width="${width}" height="168" rx="18" fill="#fff" stroke="#e9e4ef"/>
    <circle cx="78" cy="82" r="55" fill="#f2eaf7"/>
    <circle cx="78" cy="82" r="52" fill="#8E44AD"/>
    <text x="78" y="91" text-anchor="middle" font-family="Arial,sans-serif" font-size="32" font-weight="700" fill="#fff">${initial}</text>
    ${safeAvatarUrl ? `<image href="${safeAvatarUrl}" x="26" y="30" width="104" height="104" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatar-clip)"/>` : ''}
    <text x="151" y="64" font-family="Arial,sans-serif" font-size="27" font-weight="700" fill="${nameColor}">${safeName}</text>
    ${rankLevel ? `<g transform="translate(${151 + usernameWidth + 14} 45)"><title>${rankLevel} rank</title><circle r="12" fill="${rankColor}"/><path d="M-5 0l3.5 3.5L5-4" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></g>` : ''}
    ${safeTag ? `<rect x="151" y="78" width="${tagWidth}" height="23" rx="6" fill="${tagColor}"/><text x="${151 + tagWidth / 2}" y="94" text-anchor="middle" font-family="Arial,sans-serif" font-size="12" font-weight="600" fill="#fff">${safeTag}</text>` : ''}
    <text x="151" y="120" font-family="Arial,sans-serif" font-size="13" fill="#7b7282">UID ${uid} · ${Number(user.points || 0)} points${Number(user.admin) ? ' · Admin' : ''}</text>
    ${achievementSvg}
    ${remaining > 0 ? `<g transform="translate(${151 + visibleAchievements.length * 34} 139)"><circle r="11" fill="#eee9f2"/><text text-anchor="middle" dominant-baseline="central" font-family="Arial,sans-serif" font-size="10" fill="#6f6578">+${remaining}</text><title>${remaining} more achievements</title></g>` : ''}
  </a>
</svg>`;
    return new Response(svg, {
        headers: {
            'Content-Type': 'image/svg+xml; charset=utf-8',
            'Cache-Control': 'public, max-age=300',
            'X-Content-Type-Options': 'nosniff',
        },
    });
}

export async function handleApi(request: Request, env: Env, path: string) {
    if (path === '/api/usersvg') {
        if (request.method !== 'GET') return jsonRes({ error: 'Method not allowed' }, 405);
        const uidParam = new URL(request.url).searchParams.get('uid');
        if (!uidParam || uidParam !== uidParam.trim() || !/^[1-9]\d*$/.test(uidParam)) {
            return jsonRes({ error: 'Invalid user ID' }, 400);
        }
        const uid = Number(uidParam);
        if (!Number.isSafeInteger(uid)) return jsonRes({ error: 'Invalid user ID' }, 400);
        return renderUserSvg(env, uid);
    }

    if (path === '/api/health') {
        return handleHealth(request, env);
    }
    if (path === '/api/egg/status' || path === '/api/egg/claim') {
        return handleEgg(request, env, path);
    }
    if (path.startsWith('/api/oj/')) {
        return handleOj(request, env, path);
    }
    if (path === '/api/redeem') return handleRedeem(request, env, path);
    if (path.startsWith('/api/game/')) return handleGame(request, env, path);
    if (path === '/api/teams' || path.startsWith('/api/teams/')) return handleTeams(request, env, path);
    if (path === '/api/contests' || path.startsWith('/api/contests/') || path === '/api/contest' || path.startsWith('/api/contest/')) return handleContests(request, env, path);
    if (path === '/api/leaderboard/badge' && request.method === 'GET') {
        const uid = Number(new URL(request.url).searchParams.get('uid'));
        if (!Number.isInteger(uid) || uid <= 0) return jsonRes({ error: 'Invalid user ID' }, 400);
        const user = await env.DB.prepare('SELECT points FROM users WHERE id = ? AND use = 1').bind(uid).first<any>();
        if (!user) return jsonRes({ level: null });
        const totalRow = await env.DB.prepare('SELECT COUNT(*) AS count FROM users WHERE use = 1').first<any>();
        const total = Number(totalRow?.count || 0);
        const rankRow = await env.DB.prepare(
            `SELECT COUNT(*) AS count FROM users
             WHERE use = 1 AND (points > ? OR (points = ? AND id <= ?))`
        ).bind(Number(user.points || 0), Number(user.points || 0), uid).first<any>();
        const rank = Number(rankRow?.count || 0);
        const level = getPointsRankBadgeLevel(rank, total);
        return jsonRes({ level, rank, total });
    }

    // other routes below omitted: unchanged from project
    if (path === '/api/login' || path === '/api/register') {
        return handleAuth(request, env, path);
    }
    if (path === '/api/checkin') {
        return handleCheckin(request, env);
    }
    if (path === '/api/follow') {
        return handleFollow(request, env);
    }
    if (path.startsWith('/api/benben')) {
        return handleBenben(request, env, path);
    }
    if (path.startsWith('/api/articles') || path.startsWith('/api/comments')) {
        return handleArticles(request, env, path);
    }
    if (path.startsWith('/api/tickets')) {
        return handleTickets(request, env, path);
    }
    if (path.startsWith('/api/messages')) {
        return handleMessages(request, env, path);
    }
    if (path.startsWith('/api/pm') || path === '/api/user/find') {
        return handlePm(request, env, path);
    }
    if (path.startsWith('/api/admin')) {
        return handleAdmin(request, env, path);
    }
    if (path.startsWith('/api/reports')) {
        return handleReports(request, env, path);
    }
    if (path.startsWith('/api/server')) {
        return handleServer(request, env, path);
    }
    if (path.startsWith('/api/user')) {
        return handleUser(request, env, path);
    }

    return jsonRes({ error: 'API not found' }, 404);
}
