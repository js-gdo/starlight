import { ensureDB } from './db/init';
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
import { renderUser, renderUserSettings } from './routes/user';
import { renderServer } from './routes/server';
import { renderAdminList } from './routes/admin-list';
import { renderHealth } from './routes/health';
import { renderContestList, renderContestDetail } from './routes/contest';
import { renderOjList, renderOjProblem, renderOjSubmission, renderOjProposal, renderOjProposalReview } from './routes/oj';
import { renderLeaderboard } from './routes/leaderboard';
import { renderAchievements } from './routes/achievements';
import { renderRedeem } from './routes/redeem';
import { renderGame } from './routes/game';
import { renderSearch } from './routes/search';
import { handleApi } from './handlers/api';
import { renderTeamNew, renderTeam, renderTeamRequests } from './routes/teams';
import type { Env } from './env.d';

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext) {
        try {
            const url = new URL(request.url);
            const path = url.pathname;

            await ensureDB(env);

            // ============ 椤甸潰璺敱 ============
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

                        if (path === '/oj') {
                return new Response(await renderOjList(env, request), {
                    headers: { 'Content-Type': 'text/html; charset=utf-8' },
                });
            }

            if (path === '/contest') {
                return new Response(await renderContestList(env, request), {
                    headers: { 'Content-Type': 'text/html; charset=utf-8' },
                });
            }
            if (path.startsWith('/contest/') && path.length > '/contest/'.length) {
                return new Response(await renderContestDetail(env, request, path), {
                    headers: { 'Content-Type': 'text/html; charset=utf-8' },
                });
            }

            if (path === '/oj/propose') {
                return new Response(await renderOjProposal(env, request), {
                    headers: { 'Content-Type': 'text/html; charset=utf-8' },
                });
            }
            if (path === '/oj/proposals') {
                return new Response(await renderOjProposalReview(env, request), {
                    headers: { 'Content-Type': 'text/html; charset=utf-8' },
                });
            }

            if (path.startsWith('/oj/submission/') && path.length > '/oj/submission/'.length) {
                return new Response(await renderOjSubmission(env, request, path), {
                    headers: { 'Content-Type': 'text/html; charset=utf-8' },
                });
            }
if (path === '/leaderboard') {
                return new Response(await renderLeaderboard(env, request), {
                    headers: { 'Content-Type': 'text/html; charset=utf-8' },
                });
            }

            if (path === '/achievements') {
                return new Response(await renderAchievements(env, request), {
                    headers: { 'Content-Type': 'text/html; charset=utf-8' },
                });
            }
            if (path === '/redeem') {
                return new Response(await renderRedeem(env, request), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
            }
            if (path === '/game') {
                return new Response(await renderGame(env, request), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
            }
            if (path === '/search') {
                return new Response(await renderSearch(env, request), {
                    headers: { 'Content-Type': 'text/html; charset=utf-8' },
                });
            }
            if (path === '/team/new') {
                return new Response(await renderTeamNew(env, request), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
            }
            if (path === '/team/requests') {
                return new Response(await renderTeamRequests(env, request), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
            }
            if (path.startsWith('/team/') && path.length > 6) {
                return new Response(await renderTeam(env, request, path), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
            }
            if (path.startsWith('/oj/') && path.length > 4) {
                return new Response(await renderOjProblem(env, request, path), {
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

            if (path === '/server') {
                return new Response(await renderServer(env, request), {
                    headers: { 'Content-Type': 'text/html; charset=utf-8' },
                });
            }

            if (path === '/admin-list') {
                return new Response(await renderAdminList(env, request), {
                    headers: { 'Content-Type': 'text/html; charset=utf-8' },
                });
            }

            if (path === '/health') {
                return new Response(await renderHealth(env, request), {
                    headers: { 'Content-Type': 'text/html; charset=utf-8' },
                });
            }

            if (path === '/settings') {
                return new Response(await renderUserSettings(env, request), {
                    headers: { 'Content-Type': 'text/html; charset=utf-8' },
                });
            }

            if (path.startsWith('/user/') && path.length > 6) {
                return new Response(await renderUser(env, request, path), {
                    headers: { 'Content-Type': 'text/html; charset=utf-8' },
                });
            }

            // ============ API 璺敱 ============
            if (path.startsWith('/api/')) {
                return await handleApi(request, env, path);
            }

            return new Response('Not Found', { status: 404 });
        } catch (e: any) {
            console.error('Worker error:', e);
            return new Response('Internal Server Error', { status: 500 });
        }
    },
} satisfies ExportedHandler<Env>;



