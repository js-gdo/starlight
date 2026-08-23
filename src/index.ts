import { initDB } from './db/init';
import { renderHome } from './routes/home';
import { renderLogin, renderRegister } from './routes/auth';
import { renderBenben } from './routes/benben';
import { renderMessages } from './routes/messages';
import { renderPmIndex, renderPmChat } from './routes/pm';
import {
    renderArticleList,
    renderArticleNew,
    renderArticleDetail,
    renderArticleEdit,
} from './routes/articles';
import {
    renderTicketList,
    renderTicketNew,
    renderTicketDetail,
    renderTicketEdit,
} from './routes/tickets';
import { renderJudgement } from './routes/judgement';
import { renderClipboard } from './routes/clipboard';
import { renderBackend } from './routes/backend';
import { renderUser } from './routes/user';
import { handleApi } from './handlers/api';
import type { Env } from './env.d';

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext) {
        try {
            const url = new URL(request.url);
            const path = url.pathname;

            await initDB(env);

            // ============ 页面路由 ============
            if (path === '/' || path === '/index.html') {
                return new Response(await renderHome(env, request), {
                    headers: { 'Content-Type': 'text/html; charset=utf-8' },
                });
            }

            if (path === '/login') {
                const result = await renderLogin(env, request);
                if (result.redirect) {
                    return new Response(null, { status: 302, headers: { Location: result.redirect } });
                }
                return new Response(result.html, {
                    headers: { 'Content-Type': 'text/html; charset=utf-8' },
                });
            }

            if (path === '/register') {
                const result = await renderRegister(env, request);
                if (result.redirect) {
                    return new Response(null, { status: 302, headers: { Location: result.redirect } });
                }
                return new Response(result.html, {
                    headers: { 'Content-Type': 'text/html; charset=utf-8' },
                });
            }

            if (path === '/logout') {
                return new Response(null, {
                    status: 302,
                    headers: {
                        'Location': '/',
                        'Set-Cookie': 'uid=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/',
                    },
                });
            }

            if (path === '/benben') {
                return new Response(await renderBenben(env, request), {
                    headers: { 'Content-Type': 'text/html; charset=utf-8' },
                });
            }

            if (path === '/messages') {
                return new Response(await renderMessages(env, request), {
                    headers: { 'Content-Type': 'text/html; charset=utf-8' },
                });
            }

            if (path === '/pm') {
                return new Response(await renderPmIndex(env, request), {
                    headers: { 'Content-Type': 'text/html; charset=utf-8' },
                });
            }
            if (path.startsWith('/pm/') && path.length > 4) {
                return new Response(await renderPmChat(env, request, path), {
                    headers: { 'Content-Type': 'text/html; charset=utf-8' },
                });
            }

            if (path === '/articles/list') {
                return new Response(await renderArticleList(env, request), {
                    headers: { 'Content-Type': 'text/html; charset=utf-8' },
                });
            }
            if (path === '/articles/new') {
                return new Response(await renderArticleNew(env, request), {
                    headers: { 'Content-Type': 'text/html; charset=utf-8' },
                });
            }
            if (path.startsWith('/articles/') && path.length > 10) {
                if (path.endsWith('/edit')) {
                    return new Response(await renderArticleEdit(env, request, path), {
                        headers: { 'Content-Type': 'text/html; charset=utf-8' },
                    });
                }
                return new Response(await renderArticleDetail(env, request, path), {
                    headers: { 'Content-Type': 'text/html; charset=utf-8' },
                });
            }

            if (path === '/ticket/list') {
                return new Response(await renderTicketList(env, request), {
                    headers: { 'Content-Type': 'text/html; charset=utf-8' },
                });
            }
            if (path === '/ticket/new') {
                return new Response(await renderTicketNew(env, request), {
                    headers: { 'Content-Type': 'text/html; charset=utf-8' },
                });
            }
            if (path.startsWith('/ticket/') && path.length > 8) {
                if (path.endsWith('/edit')) {
                    return new Response(await renderTicketEdit(env, request, path), {
                        headers: { 'Content-Type': 'text/html; charset=utf-8' },
                    });
                }
                return new Response(await renderTicketDetail(env, request, path), {
                    headers: { 'Content-Type': 'text/html; charset=utf-8' },
                });
            }

            if (path === '/judgement') {
                return new Response(await renderJudgement(env, request), {
                    headers: { 'Content-Type': 'text/html; charset=utf-8' },
                });
            }

            if (path === '/clipboard') {
                return new Response(await renderClipboard(env, request), {
                    headers: { 'Content-Type': 'text/html; charset=utf-8' },
                });
            }

            if (path === '/backend') {
                return new Response(await renderBackend(env, request), {
                    headers: { 'Content-Type': 'text/html; charset=utf-8' },
                });
            }

            if (path.startsWith('/user/') && path.length > 6) {
                return new Response(await renderUser(env, request, path), {
                    headers: { 'Content-Type': 'text/html; charset=utf-8' },
                });
            }

            // ============ API 路由 ============
            if (path.startsWith('/api/')) {
                return await handleApi(request, env, path);
            }

            return new Response('Not Found', { status: 404 });
        } catch (e: any) {
            console.error('Worker error:', e);
            return new Response(`Error: ${e.message}`, { status: 500 });
        }
    },
} satisfies ExportedHandler<Env>;