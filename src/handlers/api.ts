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
import { handleRedeem } from './redeem';
import { handleGame } from './game';
import { handleTeams } from './teams';
import { handleContests } from './contest';
import type { Env } from '../env.d';

export async function handleApi(request: Request, env: Env, path: string) {
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
        const goldLimit = Math.max(1, Math.ceil(total * 0.1));
        const blueLimit = Math.max(goldLimit, Math.ceil(total * 0.3));
        const greenLimit = Math.max(blueLimit, Math.ceil(total * 0.6));
        const level = rank <= goldLimit ? 'gold' : rank <= blueLimit ? 'blue' : rank <= greenLimit ? 'green' : null;
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
