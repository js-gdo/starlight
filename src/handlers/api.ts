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
import { jsonRes } from '../utils/auth';
import type { Env } from '../env.d';

export async function handleApi(request: Request, env: Env, path: string) {
    if (path === '/api/health') {
        return handleHealth(request, env);
    }
    if (path === '/api/egg/status' || path === '/api/egg/claim') {
        return handleEgg(request, env, path);
    }

    // 按路径前缀分发
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