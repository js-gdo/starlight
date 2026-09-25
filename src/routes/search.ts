import { getSessionUser } from '../utils/auth';
import { getLayout } from '../utils/layout';
import { htmlEscape, renderUsernameLink } from '../utils/html';
import type { Env } from '../env.d';

export async function renderSearch(env: Env, req: Request) {
    const user = await getSessionUser(env, req);
    const query = new URL(req.url).searchParams.get('q')?.trim().slice(0, 80) || '';
    const like = `%${query.replace(/[%_]/g, '\\$&')}%`;
    const [articles, users, tickets] = query ? await Promise.all([
        env.DB.prepare(`SELECT a.id, a.hex_id, a.title, a.created_at, u.username, u.color, u.tag, a.author_id
            FROM articles a LEFT JOIN users u ON u.id = a.author_id
            WHERE a.title LIKE ? ESCAPE '\\' OR a.content LIKE ? ESCAPE '\\'
            ORDER BY a.created_at DESC LIMIT 20`).bind(like, like).all(),
        env.DB.prepare("SELECT id, username, color, tag FROM users WHERE username LIKE ? ESCAPE '\\' ORDER BY username LIMIT 20").bind(like).all(),
        env.DB.prepare(`SELECT t.id, t.title, t.created_at, u.username, u.color, u.tag, t.author_id
            FROM tickets t LEFT JOIN users u ON u.id = t.author_id
            WHERE t.title LIKE ? ESCAPE '\\' OR t.content LIKE ? ESCAPE '\\'
            ORDER BY t.created_at DESC LIMIT 20`).bind(like, like).all(),
    ]) : [{ results: [] }, { results: [] }, { results: [] }];

    const content = `
        <div class="page-header"><h1><i class="fas fa-search"></i> 全站搜索</h1>
        <form method="GET" action="/search" style="display:flex;gap:8px;margin-top:12px;">
            <input name="q" value="${htmlEscape(query)}" placeholder="搜索帖子、用户或工单" maxlength="80" style="flex:1;padding:9px 12px;border:1px solid #ddd;border-radius:6px;">
            <button type="submit" style="border:0;border-radius:6px;background:#8E44AD;color:#fff;padding:0 18px;cursor:pointer;">搜索</button>
        </form></div>
        ${query ? `
        <div class="card"><h2>用户</h2>${users.results.length ? users.results.map((item: any) => `<div class="search-row">${renderUsernameLink(item.username, item.color, item.tag, item.id)}</div>`).join('') : '<p class="muted">没有匹配用户。</p>'}</div>
        <div class="card"><h2>帖子</h2>${articles.results.length ? articles.results.map((item: any) => `<div class="search-row"><a href="/articles/${encodeURIComponent(item.hex_id || item.id)}">${htmlEscape(item.title || '无标题')}</a><span>${item.username ? renderUsernameLink(item.username, item.color, item.tag, item.author_id) : ''}</span></div>`).join('') : '<p class="muted">没有匹配帖子。</p>'}</div>
        <div class="card"><h2>工单</h2>${tickets.results.length ? tickets.results.map((item: any) => `<div class="search-row"><a href="/ticket/${item.id}">${htmlEscape(item.title || '无标题')}</a><span>${item.username ? renderUsernameLink(item.username, item.color, item.tag, item.author_id) : ''}</span></div>`).join('') : '<p class="muted">没有匹配工单。</p>'}</div>
        ` : '<div class="card muted">输入关键词开始搜索。</div>'}
    `;
    return getLayout(env, user, '全站搜索', content, `.search-row{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid #f1f1f1}.search-row a{color:#8E44AD;text-decoration:none}.search-row span,.muted{color:#888;font-size:13px}.card h2{font-size:16px;margin-bottom:8px}.card{margin-bottom:12px}`, req);
}
