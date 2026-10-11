import { ensureDB } from './db/init';
import { handleRequest } from './router';
import { renderStatusPage } from './routes/status';
import { jsonRes } from './utils/auth';
import type { Env } from './env.d';

export default {
    async fetch(request: Request, env: Env, _ctx: ExecutionContext) {
        const path = new URL(request.url).pathname;

        try {
            await ensureDB(env);
            return await handleRequest(request, env, path);
        } catch (error: unknown) {
            console.error('Worker error:', error);
            if (path === '/api' || path.startsWith('/api/')) {
                return jsonRes({ error: 'Internal server error' }, 500);
            }
            return renderStatusPage(env, request, 500, '页面出错了', '服务器暂时无法完成这次请求。');
        }
    },
} satisfies ExportedHandler<Env>;
