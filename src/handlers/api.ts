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
import { htmlEscape, renderUserVerificationBadge } from '../utils/html';
import { validateAvatarUrl } from '../utils/profile';
import { handleRedeem } from './redeem';
import { handleGame } from './game';
import { handleTeams } from './teams';
import { handleContests } from './contest';
import type { Env } from '../env.d';

async function renderUserSvg(env: Env, uid: number): Promise<Response> {
    const user = await env.DB.prepare(
        `WITH target AS (
            SELECT id, username, color, tag, avatar_url, points
            FROM users WHERE id = ? AND use = 1
         )
         SELECT target.*,
            (SELECT COUNT(*) FROM users WHERE use = 1) AS total_users,
            (SELECT COUNT(*) FROM users WHERE use = 1
             AND (points > target.points OR (points = target.points AND id <= target.id))) AS user_rank
         FROM target`
    ).bind(uid).first<any>();
    if (!user) return jsonRes({ error: 'User not found' }, 404);
    const rankLevel = getPointsRankBadgeLevel(Number(user.user_rank || 0), Number(user.total_users || 0));
    const name = String(user.username || 'Unknown');
    const safeName = htmlEscape(name);
    const usernameWidth = Array.from(name).reduce((width, char) => width + (char.codePointAt(0)! > 255 ? 16 : 9), 0);
    const colorKey = String(user.color || 'red');
    const safeColorKey = isValidUserColor(colorKey) ? colorKey : 'red';
    const nameColor = safeColorKey === 'rainbow' ? 'url(#username-gradient)' : getUserColor(safeColorKey);
    const avatarUrl = String(user.avatar_url || '');
    const safeAvatarUrl = validateAvatarUrl(avatarUrl) ? htmlEscape(avatarUrl) : '';
    const initial = htmlEscape(Array.from(name)[0] || '?').toUpperCase();
    const tag = String(user.tag || '');
    const safeTag = htmlEscape(Array.from(tag).slice(0, 28).join(''));
    const tagWidth = Math.max(38, Math.min(Array.from(tag).length, 28) * 8 + 16);
    const tagColor = safeColorKey === 'rainbow' ? 'url(#username-gradient)' : getUserColor(safeColorKey);
    const rankBadge = rankLevel ? renderUserVerificationBadge(rankLevel) : '';
    const badgeWidth = rankLevel ? 19 : 0;
    const tagX = 60 + usernameWidth + badgeWidth + 6;
    const width = Math.max(160, tagX + (safeTag ? tagWidth : 0) + 12);
    const gradient = safeColorKey === 'rainbow'
        ? '<linearGradient id="username-gradient"><stop stop-color="#E74C3C"/><stop offset="14%" stop-color="#E67E22"/><stop offset="29%" stop-color="#F1C40F"/><stop offset="43%" stop-color="#5EB95E"/><stop offset="57%" stop-color="#00BCD4"/><stop offset="71%" stop-color="#0E90D2"/><stop offset="100%" stop-color="#8E44AD"/></linearGradient>'
        : '';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="40" viewBox="0 0 ${width} 40" role="img" aria-label="${safeName}">
  <title>${safeName}</title>
  <defs>${gradient}<clipPath id="avatar-clip"><circle cx="20" cy="20" r="16"/></clipPath></defs>
  <a href="/user/${uid}" target="_top" aria-label="View ${safeName}'s profile">
    <rect width="${width}" height="40" rx="20" fill="#fff" stroke="#e9e4ef"/>
    <circle cx="20" cy="20" r="16" fill="#8E44AD"/>
    <text x="20" y="25" text-anchor="middle" font-family="Arial,sans-serif" font-size="15" font-weight="700" fill="#fff">${initial}</text>
    ${safeAvatarUrl ? `<image href="${safeAvatarUrl}" x="4" y="4" width="32" height="32" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatar-clip)"/>` : ''}
    <text x="44" y="25" font-family="Arial,sans-serif" font-size="15" font-weight="600" fill="${nameColor}">${safeName}</text>
    ${rankBadge ? `<g transform="translate(${44 + usernameWidth + 4} 12)"><title>${rankLevel} rank</title>${rankBadge}</g>` : ''}
    ${safeTag ? `<rect x="${tagX}" y="10" width="${tagWidth}" height="20" rx="6" fill="${tagColor}"/><text x="${tagX + tagWidth / 2}" y="24" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" font-weight="600" fill="#fff">${safeTag}</text>` : ''}
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
