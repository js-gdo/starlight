import { handleApi } from './handlers/api';
import type { Env } from './env.d';
import { renderAchievements } from './routes/achievements';
import { renderAdminList } from './routes/admin-list';
import { renderArticleDetail, renderArticleEdit, renderArticleList, renderArticleNew } from './routes/articles';
import { renderBackendConsole } from './routes/backendConsole';
import { renderBenben } from './routes/benben';
import { renderClipboard } from './routes/clipboard';
import { renderContestCreate, renderContestDetail, renderContestLeaderboard, renderContestList } from './routes/contest';
import { renderChallenges } from './routes/challenges';
import { renderGame } from './routes/game';
import { renderRuins } from './routes/ruins';
import { renderSpaceShop } from './routes/space-shop';
import { renderSpaceStation } from './routes/space-station';
import { renderHealth } from './routes/health';
import { renderHome } from './routes/home';
import { renderInvite } from './routes/invite';
import { renderJudgement } from './routes/judgement';
import { renderLeaderboard } from './routes/leaderboard';
import { renderMessages } from './routes/messages';
import { renderOjList, renderOjProblem, renderOjProposal, renderOjProposalReview, renderOjSubmission, validateOjPageAccess } from './routes/oj';
import { renderOS } from './routes/os';
import { renderPmChat, renderPmIndex } from './routes/pm';
import { renderRedeem } from './routes/redeem';
import { renderSearch } from './routes/search';
import { renderServer } from './routes/server';
import { renderStatusPage } from './routes/status';
import { renderTeam, renderTeamList, renderTeamNew, renderTeamPostDetail, renderTeamPosts, renderTeamRequests, renderTeamSettings } from './routes/teams';
import { renderTicketDetail, renderTicketEdit, renderTicketList, renderTicketNew } from './routes/tickets';
import { renderUser, renderUserSettings } from './routes/user';
import { renderLogin, renderRegister } from './routes/auth';

const HTML_HEADERS = { 'Content-Type': 'text/html; charset=utf-8' };

type RouteHandler = (env: Env, request: Request, path: string) => Promise<Response> | Response;

interface RouteDefinition {
    matches: (path: string) => boolean;
    handle: RouteHandler;
}

type PageRenderer = (env: Env, request: Request, path: string) => Promise<string>;

function htmlResponse(content: string): Response {
    return new Response(content, { headers: HTML_HEADERS });
}

function exactPage(paths: string[], render: PageRenderer): RouteDefinition {
    return {
        matches: (path) => paths.includes(path),
        handle: async (env, request, path) => htmlResponse(await render(env, request, path)),
    };
}

function matchingPage(matches: (path: string) => boolean, render: PageRenderer): RouteDefinition {
    return {
        matches,
        handle: async (env, request, path) => htmlResponse(await render(env, request, path)),
    };
}

function directRoute(matches: (path: string) => boolean, handle: RouteHandler): RouteDefinition {
    return { matches, handle };
}

const routes: RouteDefinition[] = [
    exactPage(['/', '/index.html'], (env, request) => renderHome(env, request)),
    exactPage(['/os'], (env, request) => renderOS(env, request)),
    directRoute((path) => path === '/login', async (env, request) => {
        const result = await renderLogin(env, request);
        const redirect = result.redirect;
        if (redirect) {
            return new Response(null, { status: 302, headers: { Location: redirect } });
        }
        if (typeof result.html !== 'string') throw new Error('Login renderer returned neither HTML nor a redirect');
        return htmlResponse(result.html);
    }),
    directRoute((path) => path === '/register', async (env, request) => {
        const result = await renderRegister(env, request);
        const redirect = result.redirect;
        if (redirect) {
            return new Response(null, { status: 302, headers: { Location: redirect } });
        }
        if (typeof result.html !== 'string') throw new Error('Registration renderer returned neither HTML nor a redirect');
        return htmlResponse(result.html);
    }),
    directRoute((path) => path === '/logout', () => new Response(null, {
        status: 302,
        headers: {
            Location: '/',
            'Set-Cookie': 'uid=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/',
        },
    })),
    exactPage(['/benben'], (env, request) => renderBenben(env, request)),
    exactPage(['/messages'], (env, request) => renderMessages(env, request)),
    exactPage(['/pm'], (env, request) => renderPmIndex(env, request)),
    matchingPage((path) => path.startsWith('/pm/') && path.length > 4, (env, request, path) => renderPmChat(env, request, path)),
    exactPage(['/articles/list'], (env, request) => renderArticleList(env, request)),
    exactPage(['/articles/new'], (env, request) => renderArticleNew(env, request)),
    matchingPage(
        (path) => path.startsWith('/articles/') && path.length > 10,
        (env, request, path) => path.endsWith('/edit')
            ? renderArticleEdit(env, request, path)
            : renderArticleDetail(env, request, path),
    ),
    exactPage(['/ticket/list'], (env, request) => renderTicketList(env, request)),
    exactPage(['/ticket/new'], (env, request) => renderTicketNew(env, request)),
    matchingPage(
        (path) => path.startsWith('/ticket/') && path.length > 8,
        (env, request, path) => path.endsWith('/edit')
            ? renderTicketEdit(env, request, path)
            : renderTicketDetail(env, request, path),
    ),
    exactPage(['/judgement'], (env, request) => renderJudgement(env, request)),
    directRoute((path) => path === '/oj', async (env, request) => {
        const denied = await validateOjPageAccess(env, request, '/oj');
        return denied || htmlResponse(await renderOjList(env, request));
    }),
    exactPage(['/contest'], (env, request) => renderContestList(env, request)),
    matchingPage((path) => /^\/team\/\d+\/contest\/new$/.test(path), (env, request, path) => renderContestCreate(env, request, path)),
    matchingPage((path) => /^\/contest\/\d+\/rank$/.test(path), (env, request, path) => renderContestLeaderboard(env, request, path)),
    matchingPage((path) => path.startsWith('/contest/') && path.length > '/contest/'.length, (env, request, path) => renderContestDetail(env, request, path)),
    exactPage(['/oj/propose'], (env, request) => renderOjProposal(env, request)),
    directRoute((path) => path === '/oj/proposals', (env, request) => renderOjProposalReview(env, request)),
    directRoute((path) => path.startsWith('/oj/submission/') && path.length > '/oj/submission/'.length, async (env, request, path) => {
        const denied = await validateOjPageAccess(env, request, path);
        return denied || htmlResponse(await renderOjSubmission(env, request, path));
    }),
    exactPage(['/leaderboard'], (env, request) => renderLeaderboard(env, request)),
    exactPage(['/achievements'], (env, request) => renderAchievements(env, request)),
    exactPage(['/challenges'], (env, request) => renderChallenges(env, request)),
    exactPage(['/redeem'], (env, request) => renderRedeem(env, request)),
    exactPage(['/game'], (env, request) => renderGame(env, request)),
    exactPage(['/ruins'], (env, request) => renderRuins(env, request)),
    exactPage(['/space-shop'], (env, request) => renderSpaceShop(env, request)),
    exactPage(['/space-station'], (env, request) => renderSpaceStation(env, request)),
    exactPage(['/search'], (env, request) => renderSearch(env, request)),
    directRoute((path) => path === '/invite', (env, request) => renderInvite(env, request)),
    exactPage(['/team'], (env, request) => renderTeamList(env, request)),
    exactPage(['/team/new'], (env, request) => renderTeamNew(env, request)),
    directRoute((path) => path === '/team/requests', (env, request) => renderTeamRequests(env, request)),
    matchingPage((path) => path.startsWith('/team/') && path.endsWith('/settings'), (env, request, path) => renderTeamSettings(env, request, path)),
    directRoute((path) => /^\/team\/\d+\/posts$/.test(path), (env, request, path) => renderTeamPosts(env, request, path)),
    directRoute((path) => /^\/team\/\d+\/posts\/\d+$/.test(path), (env, request, path) => renderTeamPostDetail(env, request, path)),
    matchingPage((path) => path.startsWith('/team/') && path.length > 6, (env, request, path) => renderTeam(env, request, path)),
    directRoute((path) => path.startsWith('/oj/') && path.length > 4, async (env, request, path) => {
        const denied = await validateOjPageAccess(env, request, path);
        return denied || htmlResponse(await renderOjProblem(env, request, path));
    }),
    exactPage(['/clipboard'], (env, request) => renderClipboard(env, request)),
    directRoute((path) => path === '/backend' || path.startsWith('/backend/'), async (env, request) => {
        const result = await renderBackendConsole(env, request);
        return result instanceof Response ? result : htmlResponse(result);
    }),
    exactPage(['/server'], (env, request) => renderServer(env, request)),
    exactPage(['/admin-list'], (env, request) => renderAdminList(env, request)),
    exactPage(['/health'], (env, request) => renderHealth(env, request)),
    exactPage(['/settings'], (env, request) => renderUserSettings(env, request)),
    matchingPage((path) => path.startsWith('/user/') && path.length > 6, (env, request, path) => renderUser(env, request, path)),
    directRoute((path) => path === '/api' || path.startsWith('/api/'), (env, request, path) => handleApi(request, env, path)),
];

export async function handleRequest(request: Request, env: Env, path: string): Promise<Response> {
    const route = routes.find((candidate) => candidate.matches(path));
    if (route) return route.handle(env, request, path);
    return renderStatusPage(env, request, 404, '页面不存在', '找不到你访问的页面。');
}
