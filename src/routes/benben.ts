// src/routes/benben.ts
import { getSessionUser } from '../utils/auth';
import { getLayout } from '../utils/layout';
import { renderUsernameLink, htmlEscape } from '../utils/html';
import { formatTimeToChina } from '../utils/time';
import type { Env } from '../env.d';  // 如果有的话，否则使用全局

export async function renderBenben(env: Env, req: Request) {
    const user = await getSessionUser(env, req);
    const db = env.DB;

    // 注意：原代码计算了 unreadCount 但未使用，可保留或删除。此处保留但不存储。
    if (user) {
        await db.prepare('SELECT COUNT(*) as cnt FROM messages WHERE to_user_id = ? AND is_read = 0')
            .bind(user.id).first();
    }

    const benben = await db.prepare(
        `SELECT b.*, u.username, u.color, u.tag
     FROM benben b JOIN users u ON b.author_id = u.id
     WHERE u.use = 1
     ORDER BY b.created_at DESC LIMIT 100`
    ).all();

    const content = `
    <div class="page-header"><h1><i class="fas fa-comment-dots"></i> 动态</h1></div>
    ${user ? `
      <div class="card">
        <form action="/api/benben" method="POST" style="display:flex;gap:8px;">
          <input type="text" name="content" placeholder="说点什么..." required style="flex:1;padding:8px 12px;border:1px solid #ddd;border-radius:4px;font-size:14px;">
          <button type="submit" style="background:#8E44AD;color:#fff;padding:8px 20px;border:none;border-radius:4px;cursor:pointer;">发布</button>
        </form>
      </div>
    ` : `
      <div class="card" style="color:#999;text-align:center;">请 <a href="/login" style="color:#8E44AD;">登录</a> 后发布动态</div>
    `}
    <div class="card">
      ${benben.results.map((b: any) => `
        <div style="padding:10px 0;border-bottom:1px solid #f5f5f5;">
          ${renderUsernameLink(b.username, b.color, b.tag, b.author_id)}
          <span style="font-size:13px;color:#999;margin-left:8px;">${formatTimeToChina(b.created_at)}</span>
          <div class="markdown-content" style="margin-top:4px;font-size:14px;">${htmlEscape(b.content)}</div>
          ${user && (user.id === b.author_id || user.admin) ? `
            <form action="/api/benben/${b.id}" method="POST" style="display:inline;margin-top:4px;">
              <button type="submit" style="background:none;border:none;color:#e74c3c;cursor:pointer;font-size:12px;"><i class="fas fa-trash-alt"></i> 删除</button>
            </form>
          ` : ''}
        </div>
      `).join('')}
      ${benben.results.length === 0 ? '<div style="color:#999;padding:20px 0;text-align:center;">暂无动态</div>' : ''}
    </div>
  `;
    return await getLayout(env, user, '动态', content);
}