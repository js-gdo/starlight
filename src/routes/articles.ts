import { getSessionUser } from '../utils/auth';
import { getLayout } from '../utils/layout';
import { renderUsernameLink, htmlEscape } from '../utils/html';
import { formatTimeToChina } from '../utils/time';
import { getTranslator } from '../utils/i18n';
import type { Env } from '../env.d';

export async function renderArticleList(env: Env, req: Request) {
    const t = getTranslator(req);
    const user = await getSessionUser(env, req);
    const db = env.DB;
    const url = new URL(req.url);
    const typeParam = url.searchParams.get('type') || 'all';
    const problemIdParam = url.searchParams.get('id') || '';

    let unreadCount = 0;
    if (user) {
        const countResult = await db.prepare('SELECT COUNT(*) as cnt FROM messages WHERE to_user_id = ? AND is_read = 0')
            .bind(user.id).first();
        unreadCount = countResult ? countResult.cnt : 0;
    }

    let sql = `SELECT a.*, u.username, u.color, u.tag
         FROM articles a JOIN users u ON a.author_id = u.id`;
    const bindValues: any[] = [];
    if (typeParam === 'normal') {
        sql += ` WHERE (a.article_type IS NULL OR a.article_type = ?)`;
        bindValues.push('normal');
    } else if (typeParam === 'problem') {
        sql += ` WHERE a.article_type = ?`;
        bindValues.push('problem');
        if (problemIdParam) {
            sql += ` AND a.problem_id = ?`;
            bindValues.push(problemIdParam);
        }
    }
    sql += ` ORDER BY a.is_pinned DESC, a.created_at DESC`;

    const articles = await db.prepare(sql).bind(...bindValues).all();
    const filterLinks = [
        { value: 'all', label: '全部' },
        { value: 'normal', label: '普通帖子' },
        { value: 'problem', label: '题目讨论帖' },
    ];
    const problemFilterUrl = typeParam === 'problem' ? `?type=problem&id=${encodeURIComponent(problemIdParam)}` : '?type=problem';

    const content = `
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
      <div><h1><i class="fas fa-file-alt"></i> ${t('articleList')}</h1></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <a href="/articles/new" style="background:#8E44AD;color:#fff;padding:6px 16px;border-radius:4px;text-decoration:none;font-size:14px;"><i class="fas fa-plus"></i> ${t('newArticle')}</a>
        <a href="/articles/new?problem=true" style="background:#2c7be5;color:#fff;padding:6px 16px;border-radius:4px;text-decoration:none;font-size:14px;"><i class="fas fa-plus"></i> 发布题目讨论帖</a>
      </div>
    </div>
    <div class="card" style="margin-bottom:12px;">
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        ${filterLinks.map((item) => {
            const selected = typeParam === item.value;
            const href = item.value === 'problem' ? '/articles/list?type=problem' : `/articles/list?type=${item.value}`;
            return `<a href="${href}" style="padding:6px 12px;border-radius:999px;text-decoration:none;font-size:13px;border:1px solid ${selected ? '#8E44AD' : '#ddd'};background:${selected ? '#8E44AD' : '#fff'};color:${selected ? '#fff' : '#333'};">${item.label}</a>`;
        }).join('')}
      </div>
      ${typeParam === 'problem' ? `
        <form method="GET" action="/articles/list" style="margin-top:12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <input type="hidden" name="type" value="problem">
          <label style="font-size:13px;color:#666;">选择题目</label>
          <select name="id" onchange="this.form.submit()" style="padding:6px 10px;border:1px solid #ddd;border-radius:4px;min-width:180px;">
            <option value="">全部题目</option>
            ${await (async () => {
                const problemOptions = (await import('../utils/problem')).fetchProblemList();
                const problems = await problemOptions;
                return problems.map((problem) => `<option value="${problem.id}" ${problemIdParam === String(problem.id) ? 'selected' : ''}>${problem.title || problem.name || problem.id}</option>`).join('');
            })()}
          </select>
        </form>
      ` : ''}
    </div>
    <div class="card">
      ${articles.results.map((a: any) => `
        <div style="padding:10px 0;border-bottom:1px solid #f5f5f5;">
          <a href="/articles/${a.hex_id}" style="font-size:16px;font-weight:500;color:#333;text-decoration:none;">${htmlEscape(a.title)}</a>
          ${a.article_type === 'problem' ? `<span style="background:#2c7be5;color:#fff;font-size:10px;padding:1px 8px;border-radius:3px;margin-left:4px;">题目讨论帖</span>` : ''}
          ${a.is_pinned ? `<span style="background:#f39c12;color:#fff;font-size:10px;padding:1px 8px;border-radius:3px;margin-left:4px;">${t('articlePinned')}</span>` : ''}
          ${a.is_locked ? `<span style="background:#e74c3c;color:#fff;font-size:10px;padding:1px 8px;border-radius:3px;margin-left:4px;"><i class="fas fa-lock"></i> ${t('articleLocked')}</span>` : ''}
          <div style="color:#999;font-size:13px;margin-top:2px;">
            ${renderUsernameLink(a.username, a.color, a.tag, a.author_id)}
            · ${formatTimeToChina(a.created_at)}
          </div>
        </div>
      `).join('')}
      ${articles.results.length === 0 ? `<div style="color:#999;padding:20px 0;text-align:center;">${t('noArticles')}</div>` : ''}
    </div>
  `;
    return await getLayout(env, user, t('articleList'), content, '', req);
}

export async function renderArticleNew(env: Env, req: Request) {
    const t = getTranslator(req);
    const user = await getSessionUser(env, req);
    if (!user) return t('loginRequired');

    const db = env.DB;
    let unreadCount = 0;
    if (user) {
        const countResult = await db.prepare('SELECT COUNT(*) as cnt FROM messages WHERE to_user_id = ? AND is_read = 0')
            .bind(user.id).first();
        unreadCount = countResult ? countResult.cnt : 0;
    }

    const url = new URL(req.url);
    const isProblemMode = url.searchParams.get('problem') === 'true';
    const problemOptions = await (await import('../utils/problem')).fetchProblemList();

    const content = `
    <div class="page-header"><h1><i class="fas fa-plus-circle"></i> ${isProblemMode ? '发布题目讨论帖' : t('newArticle')}</h1></div>
    <div class="card" style="max-width:800px;">
      <form action="/api/articles" method="POST">
        ${isProblemMode ? '<input type="hidden" name="problem" value="true">' : ''}
        ${isProblemMode ? `
          <div style="margin-bottom:14px;">
            <label style="display:block;font-weight:500;margin-bottom:4px;font-size:14px;">选择题目</label>
            <select name="problem_id" required style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:4px;font-size:14px;">
              <option value="">请选择题目</option>
              ${problemOptions.map((problem) => `<option value="${problem.id}">${problem.title || problem.name || problem.id}</option>`).join('')}
            </select>
          </div>
        ` : ''}
        <div style="margin-bottom:14px;">
          <label style="display:block;font-weight:500;margin-bottom:4px;font-size:14px;">${t('articleTitle')}</label>
          <input name="title" placeholder="${t('articleTitle')}" required style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:4px;font-size:14px;">
        </div>
        <div style="margin-bottom:14px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <label style="font-weight:500;font-size:14px;">${t('articleContent')}</label>
            <div style="display:flex;gap:4px;">
              <button type="button" id="mdEditBtn" onclick="toggleMdPreview('articleMd','edit')" style="padding:3px 12px;border:1px solid #8E44AD;background:#8E44AD;color:#fff;border-radius:4px;font-size:12px;cursor:pointer;">${t('editTab')}</button>
              <button type="button" id="mdPreviewBtn" onclick="toggleMdPreview('articleMd','preview')" style="padding:3px 12px;border:1px solid #ddd;background:#fff;color:#666;border-radius:4px;font-size:12px;cursor:pointer;">${t('previewTab')}</button>
            </div>
          </div>
          <textarea id="articleMd" name="content" placeholder="${t('markdownSupported')}" rows="8" required style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:4px;font-size:14px;resize:vertical;font-family:monospace;"></textarea>
          <div id="articleMdPreview" class="markdown-body md-preview-box" style="display:none;width:100%;padding:12px;border:1px solid #eee;border-radius:4px;min-height:200px;background:#fafbfc;"></div>
        </div>
        <button type="submit" style="background:#8E44AD;color:#fff;padding:8px 24px;border:none;border-radius:4px;font-size:14px;font-weight:500;cursor:pointer;">${t('publish')}</button>
        <a href="/articles/list" style="margin-left:10px;color:#999;text-decoration:none;">${t('cancel')}</a>
      </form>
    </div>
    <script>
    function toggleMdPreview(textareaId, mode) {
      var ta = document.getElementById(textareaId);
      var pv = document.getElementById(textareaId + 'Preview');
      var editBtn = document.getElementById('mdEditBtn');
      var previewBtn = document.getElementById('mdPreviewBtn');
      if (mode === 'preview') {
        ta.style.display = 'none';
        pv.style.display = 'block';
        editBtn.style.background = '#fff'; editBtn.style.color = '#666'; editBtn.style.borderColor = '#ddd';
        previewBtn.style.background = '#8E44AD'; previewBtn.style.color = '#fff'; previewBtn.style.borderColor = '#8E44AD';
        if (typeof marked !== 'undefined') {
          marked.setOptions({ breaks: true, gfm: true, sanitize: false, headerIds: false, mangle: false });
          pv.innerHTML = marked.parse(ta.value || '');
          if (typeof typesetMath === 'function') typesetMath(pv);
        } else {
          pv.textContent = ta.value || '';
        }
      } else {
        ta.style.display = 'block';
        pv.style.display = 'none';
        editBtn.style.background = '#8E44AD'; editBtn.style.color = '#fff'; editBtn.style.borderColor = '#8E44AD';
        previewBtn.style.background = '#fff'; previewBtn.style.color = '#666'; previewBtn.style.borderColor = '#ddd';
      }
    }
    </script>
  `;
    return await getLayout(env, user, t('newArticle'), content, '', req);
}

export async function renderArticleDetail(env: Env, req: Request, path: string) {
    const t = getTranslator(req);
    const user = await getSessionUser(env, req);
    const db = env.DB;
    const hexId = path.split('/')[2];

    let unreadCount = 0;
    if (user) {
        const countResult = await db.prepare('SELECT COUNT(*) as cnt FROM messages WHERE to_user_id = ? AND is_read = 0')
            .bind(user.id).first();
        unreadCount = countResult ? countResult.cnt : 0;
    }

    const article = await db.prepare(
        `SELECT a.*, u.username, u.color, u.tag
         FROM articles a JOIN users u ON a.author_id = u.id
         WHERE a.hex_id = ?`
    ).bind(hexId).first();
    if (!article) return t('articleNotFound');

    const problemUrl = article.article_type === 'problem' && article.problem_id ? `https://oj.lin114514.top/${article.problem_id}` : '';
    const comments = await db.prepare(
        `SELECT c.*, u.username, u.color, u.tag
         FROM comments c JOIN users u ON c.author_id = u.id
         WHERE c.article_id = ? ORDER BY c.created_at ASC`
    ).bind(article.id).all();

    const isAuthor = user && user.id === article.author_id;
    const isAdmin = user && user.admin;

    const content = `
    <div class="page-header"><h1>${htmlEscape(article.title)} ${article.article_type === 'problem' ? `<span style="background:#2c7be5;color:#fff;font-size:12px;padding:1px 10px;border-radius:3px;margin-left:6px;">题目讨论帖</span>` : ''} ${article.is_pinned ? `<span style="background:#f39c12;color:#fff;font-size:12px;padding:1px 10px;border-radius:3px;margin-left:6px;">${t('articlePinned')}</span>` : ''} ${article.is_locked ? `<span style="background:#e74c3c;color:#fff;font-size:12px;padding:1px 10px;border-radius:3px;margin-left:6px;"><i class="fas fa-lock"></i> ${t('articleLocked')}</span>` : ''}</h1></div>
    <div class="card">
      <div style="color:#999;margin-bottom:12px;font-size:14px;">
        ${renderUsernameLink(article.username, article.color, article.tag, article.author_id)}
        · ${formatTimeToChina(article.created_at)}
        ${problemUrl ? `· <a href="${problemUrl}" target="_blank" rel="noopener" style="color:#2c7be5;text-decoration:none;">${problemUrl}</a>` : ''}
      </div>
      <div class="markdown-body markdown-content">${htmlEscape(article.content)}</div>
      <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap;">
        ${(isAuthor || isAdmin) ? `
          <a href="/articles/${hexId}/edit" style="background:#3498db;color:#fff;padding:4px 14px;border-radius:4px;text-decoration:none;font-size:13px;"><i class="fas fa-edit"></i> ${t('edit')}</a>
        ` : ''}
        ${user && (user.id === article.author_id || (user.admin && user.id === 1)) ? `
          <form action="/api/articles/${article.id}" method="POST" style="display:inline;">
            <input type="hidden" name="_method" value="DELETE">
            <button type="submit" style="background:#e74c3c;color:#fff;padding:4px 14px;border:none;border-radius:4px;cursor:pointer;font-size:13px;"><i class="fas fa-trash-alt"></i> ${t('delete')}</button>
          </form>
        ` : ''}
      </div>
    </div>
    <div class="card">
      <h3 style="font-size:15px;font-weight:600;margin-bottom:10px;"><i class="fas fa-comments"></i> ${t('comments')}</h3>
      ${comments.results.map((c: any) => `
        <div style="padding:8px 0;border-bottom:1px solid #f5f5f5;">
          ${renderUsernameLink(c.username, c.color, c.tag, c.author_id)}
          <span style="font-size:13px;color:#999;margin-left:6px;">${formatTimeToChina(c.created_at)}</span>
          <div class="markdown-body markdown-content" style="margin-top:4px;">${htmlEscape(c.content)}</div>
          ${user && !article.is_locked ? `<button onclick="replyTo(${c.id})" style="background:none;border:none;color:#8E44AD;cursor:pointer;font-size:12px;"><i class="fas fa-reply"></i> ${t('reply')}</button>` : ''}
          ${user && (user.id === c.author_id || user.admin) ? `
            <form action="/api/comments/${c.id}" method="POST" style="display:inline;">
              <input type="hidden" name="_method" value="DELETE">
              <button type="submit" style="background:none;border:none;color:#e74c3c;cursor:pointer;font-size:12px;"><i class="fas fa-trash-alt"></i> ${t('delete')}</button>
            </form>
          ` : ''}
        </div>
      `).join('')}
      ${comments.results.length === 0 ? `<div style="color:#999;padding:12px 0;text-align:center;">${t('noComments')}</div>` : ''}
      ${user && !article.is_locked ? `
        <form action="/api/comments" method="POST" style="margin-top:12px;">
          <input type="hidden" name="article_id" value="${article.id}">
          <textarea name="content" placeholder="${t('commentPlaceholder')}" rows="2" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;resize:vertical;font-size:14px;"></textarea>
          <button type="submit" style="margin-top:6px;background:#8E44AD;color:#fff;padding:6px 18px;border:none;border-radius:4px;cursor:pointer;">${t('comments')}</button>
        </form>
        <div id="reply-box" style="display:none;margin-top:10px;">
          <form action="/api/comments" method="POST">
            <input type="hidden" name="article_id" value="${article.id}">
            <input type="hidden" name="parent_id" id="reply-parent-id" value="0">
            <textarea name="content" placeholder="${t('replyTo')}..." rows="2" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;resize:vertical;font-size:14px;"></textarea>
            <button type="submit" style="margin-top:6px;background:#8E44AD;color:#fff;padding:6px 18px;border:none;border-radius:4px;cursor:pointer;">${t('reply')}</button>
          </form>
        </div>
        <script>
          function replyTo(id) {
            document.getElementById('reply-parent-id').value = id;
            document.getElementById('reply-box').style.display = 'block';
          }
        </script>
      ` : article.is_locked ? `
        <div style="margin-top:12px;padding:12px;background:#fdf2f2;border:1px solid #f5c6c6;border-radius:6px;text-align:center;color:#c0392b;font-size:14px;">
          <i class="fas fa-lock"></i> ${t('lockedCannotComment')}
        </div>
      ` : ''}
    </div>
  `;
    return await getLayout(env, user, t('articleList'), content, '', req);
}

export async function renderArticleEdit(env: Env, req: Request, path: string) {
    const t = getTranslator(req);
    const user = await getSessionUser(env, req);
    if (!user) return t('loginRequired');

    const hexId = path.split('/')[2];
    const db = env.DB;

    let unreadCount = 0;
    if (user) {
        const countResult = await db.prepare('SELECT COUNT(*) as cnt FROM messages WHERE to_user_id = ? AND is_read = 0')
            .bind(user.id).first();
        unreadCount = countResult ? countResult.cnt : 0;
    }

    const article = await db.prepare('SELECT * FROM articles WHERE hex_id = ?').bind(hexId).first();
    if (!article) return t('articleNotFound');
    if (user.id !== article.author_id && !user.admin) return t('permissionDenied');

    const problemOptions = await (await import('../utils/problem')).fetchProblemList();
    const isProblemPost = article.article_type === 'problem' || article.problem_id;

    const content = `
    <div class="page-header"><h1><i class="fas fa-edit"></i> ${t('editArticle')}</h1></div>
    <div class="card" style="max-width:800px;">
      <form action="/api/articles/${article.id}" method="POST">
        <input type="hidden" name="_method" value="PUT">
        ${isProblemPost ? '<input type="hidden" name="problem" value="true">' : ''}
        ${isProblemPost ? `
          <div style="margin-bottom:14px;">
            <label style="display:block;font-weight:500;margin-bottom:4px;font-size:14px;">选择题目</label>
            <select name="problem_id" required style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:4px;font-size:14px;">
              <option value="">请选择题目</option>
              ${problemOptions.map((problem) => `<option value="${problem.id}" ${String(article.problem_id || '') === String(problem.id) ? 'selected' : ''}>${problem.title || problem.name || problem.id}</option>`).join('')}
            </select>
          </div>
        ` : ''}
        <div style="margin-bottom:14px;">
          <label style="display:block;font-weight:500;margin-bottom:4px;font-size:14px;">${t('articleTitle')}</label>
          <input name="title" value="${htmlEscape(article.title)}" required style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:4px;font-size:14px;">
        </div>
        <div style="margin-bottom:14px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <label style="font-weight:500;font-size:14px;">${t('articleContent')}</label>
            <div style="display:flex;gap:4px;">
              <button type="button" id="mdEditBtn" onclick="toggleMdPreview('articleMd','edit')" style="padding:3px 12px;border:1px solid #8E44AD;background:#8E44AD;color:#fff;border-radius:4px;font-size:12px;cursor:pointer;">${t('editTab')}</button>
              <button type="button" id="mdPreviewBtn" onclick="toggleMdPreview('articleMd','preview')" style="padding:3px 12px;border:1px solid #ddd;background:#fff;color:#666;border-radius:4px;font-size:12px;cursor:pointer;">${t('previewTab')}</button>
            </div>
          </div>
          <textarea id="articleMd" name="content" rows="8" required style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:4px;font-size:14px;resize:vertical;font-family:monospace;">${htmlEscape(article.content)}</textarea>
          <div id="articleMdPreview" class="markdown-body md-preview-box" style="display:none;width:100%;padding:12px;border:1px solid #eee;border-radius:4px;min-height:200px;background:#fafbfc;"></div>
        </div>
        <button type="submit" style="background:#8E44AD;color:#fff;padding:8px 24px;border:none;border-radius:4px;font-size:14px;font-weight:500;cursor:pointer;">${t('saveChanges')}</button>
        <a href="/articles/${hexId}" style="margin-left:10px;color:#999;text-decoration:none;">${t('cancel')}</a>
      </form>
    </div>
    <script>
    function toggleMdPreview(textareaId, mode) {
      var ta = document.getElementById(textareaId);
      var pv = document.getElementById(textareaId + 'Preview');
      var editBtn = document.getElementById('mdEditBtn');
      var previewBtn = document.getElementById('mdPreviewBtn');
      if (mode === 'preview') {
        ta.style.display = 'none';
        pv.style.display = 'block';
        editBtn.style.background = '#fff'; editBtn.style.color = '#666'; editBtn.style.borderColor = '#ddd';
        previewBtn.style.background = '#8E44AD'; previewBtn.style.color = '#fff'; previewBtn.style.borderColor = '#8E44AD';
        if (typeof marked !== 'undefined') {
          marked.setOptions({ breaks: true, gfm: true, sanitize: false, headerIds: false, mangle: false });
          pv.innerHTML = marked.parse(ta.value || '');
          if (typeof typesetMath === 'function') typesetMath(pv);
        } else {
          pv.textContent = ta.value || '';
        }
      } else {
        ta.style.display = 'block';
        pv.style.display = 'none';
        editBtn.style.background = '#8E44AD'; editBtn.style.color = '#fff'; editBtn.style.borderColor = '#8E44AD';
        previewBtn.style.background = '#fff'; previewBtn.style.color = '#666'; previewBtn.style.borderColor = '#ddd';
      }
    }
    </script>
  `;
    return await getLayout(env, user, t('editArticle'), content, '', req);
}