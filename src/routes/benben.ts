import { getSessionUser } from '../utils/auth';
import { getLayout } from '../utils/layout';
import { renderUsernameLink, htmlEscape } from '../utils/html';
import { formatTimeToChina } from '../utils/time';
import { getTranslator } from '../utils/i18n';
import type { Env } from '../env.d';

export async function renderBenben(env: Env, req: Request) {
    const t = getTranslator(req);
    const user = await getSessionUser(env, req);
    const db = env.DB;

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
    <div class="page-header"><h1><i class="fas fa-comment-dots"></i> ${t('benben')}</h1></div>
    ${user ? `
      <div class="card">
        <form action="/api/benben" method="POST" style="display:flex;gap:8px;">
          <input type="text" name="content" placeholder="${t('benbenPlaceholder')}" required style="flex:1;padding:8px 12px;border:1px solid #ddd;border-radius:4px;font-size:14px;">
          <button type="submit" style="background:#8E44AD;color:#fff;padding:8px 20px;border:none;border-radius:4px;cursor:pointer;">${t('submit')}</button>
        </form>
      </div>
    ` : `
      <div class="card" style="color:#999;text-align:center;">${t('loginRequired')}</div>
    `}
    <div class="card">
      ${benben.results.map((b: any) => `
        <div style="padding:10px 0;border-bottom:1px solid #f5f5f5;">
          ${renderUsernameLink(b.username, b.color, b.tag, b.author_id)}
          <span style="font-size:13px;color:#999;margin-left:8px;">${formatTimeToChina(b.created_at)}</span>
          <div class="markdown-content" style="margin-top:4px;font-size:14px;">${htmlEscape(b.content)}</div>
          ${user && (user.id === b.author_id || user.admin) ? `
            <form action="/api/benben/${b.id}" method="POST" style="display:inline;margin-top:4px;">
              <button type="submit" style="background:none;border:none;color:#e74c3c;cursor:pointer;font-size:12px;"><i class="fas fa-trash-alt"></i> ${t('delete')}</button>
            </form>
          ` : ''}
        </div>
      `).join('')}
      ${benben.results.length === 0 ? `<div style="color:#999;padding:20px 0;text-align:center;">${t('noBenben')}</div>` : ''}
    </div>
  `;
    return await getLayout(env, user, t('benben'), content, '', req);
}