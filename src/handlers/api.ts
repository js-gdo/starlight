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
import { jsonRes } from '../utils/auth';
import type { Env } from '../env.d';

export async function handleApi(request: Request, env: Env, path: string) {
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
    if (path.startsWith('/api/pm')) {
        return handlePm(request, env, path);
    }
    if (path.startsWith('/api/admin')) {
        return handleAdmin(request, env, path);
    }
    if (path.startsWith('/api/user')) {
        // /api/user/find 已在 pm.ts 中处理，但这里也捕获以防未处理
        // 实际 pm.ts 已处理 /api/user/find，但为了不遗漏，我们也可以再次检查
        // 由于 handlePm 已经包含了 /api/user/find，所以这里可以留空或转发
        // 但为了清晰，我们可以让 user.ts 处理 /api/user/bio，而 /api/user/find 已在 pm.ts 中
        // 所以这里调用 handleUser
        return handleUser(request, env, path);
    }

    return jsonRes({ error: 'API not found' }, 404);
}