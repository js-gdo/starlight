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
    const requestedType = url.searchParams.get('type') || 'all';
    const typeParam = ['all', 'normal', 'problem', 'following', 'saved'].includes(requestedType) ? requestedType : 'all';
    const problemIdParam = url.searchParams.get('id') || '';
    const requestedCategory = url.searchParams.get('category') || 'all';
    const categoryNames: Record<string, string> = { leisure: '休闲·娱乐', culture: '学习·文化', technology: '科技·工程', programming: '编程算法·理论', life: '生活·游记', announcement: '公告', other: '其他' };
    const categoryParam = requestedCategory === 'all' || Object.hasOwn(categoryNames, requestedCategory) ? requestedCategory : 'all';
    const requestedPage = Number.parseInt(url.searchParams.get('page') || '1', 10);
    const pageSize = 20;

    const conditions: string[] = [];
    const bindValues: Array<string | number> = [];
    if (typeParam === 'normal') {
        conditions.push('(a.article_type IS NULL OR a.article_type = ?)');
        bindValues.push('normal');
    } else if (typeParam === 'problem') {
        conditions.push('a.article_type = ?');
        bindValues.push('problem');
        if (problemIdParam) {
            conditions.push('a.problem_id = ?');
            bindValues.push(problemIdParam);
        }
    } else if (typeParam === 'following') {
        if (user) {
            conditions.push('EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = ? AND f.followee_id = a.author_id)');
            bindValues.push(user.id);
        } else {
            conditions.push('0 = 1');
        }
    } else if (typeParam === 'saved') {
        if (user) {
            conditions.push('EXISTS (SELECT 1 FROM article_bookmarks b WHERE b.user_id = ? AND b.article_id = a.id)');
            bindValues.push(user.id);
        } else {
            conditions.push('0 = 1');
        }
    }
    if (categoryParam !== 'all' && categoryNames[categoryParam]) {
        conditions.push('a.category = ?');
        bindValues.push(categoryParam);
    }
    const whereClause = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
    const totalRow = await db.prepare(
        `SELECT COUNT(*) AS total FROM articles a JOIN users u ON a.author_id = u.id${whereClause}`
    ).bind(...bindValues).first<{ total: number }>();
    const totalPages = Math.max(1, Math.ceil(Number(totalRow?.total || 0) / pageSize));
    const page = Number.isSafeInteger(requestedPage) && requestedPage > 0
        ? Math.min(requestedPage, totalPages)
        : 1;
    const articles = await db.prepare(
        `SELECT a.*, u.username, u.color, u.tag,
                ${user ? 'EXISTS (SELECT 1 FROM article_bookmarks b WHERE b.user_id = ? AND b.article_id = a.id)' : '0'} AS is_saved
         FROM articles a JOIN users u ON a.author_id = u.id${whereClause}
         ORDER BY a.is_pinned DESC, a.created_at DESC, a.id DESC LIMIT ? OFFSET ?`
    ).bind(...(user ? [user.id] : []), ...bindValues, pageSize, (page - 1) * pageSize).all();

    const filterLinks = [
        { value: 'all', label: '全部' },
        { value: 'normal', label: '普通帖子' },
        { value: 'problem', label: '题目讨论帖' },
        ...(user ? [{ value: 'following', label: '关注动态' }, { value: 'saved', label: '我的收藏' }] : []),
    ];
    const buildListUrl = (nextPage: number, nextType = typeParam, nextCategory = categoryParam) => {
        const params = new URLSearchParams();
        if (nextType !== 'all') params.set('type', nextType);
        if (nextType === 'problem' && problemIdParam) params.set('id', problemIdParam);
        if (nextCategory !== 'all') params.set('category', nextCategory);
        if (nextPage > 1) params.set('page', String(nextPage));
        return `/articles/list${params.size ? `?${params}` : ''}`;
    };
    const pagination = totalPages > 1 ? `
      <nav aria-label="文章分页" style="display:flex;justify-content:center;align-items:center;gap:10px;margin-top:16px;flex-wrap:wrap;">
        ${page > 1 ? `<a href="${buildListUrl(page - 1)}" style="padding:6px 12px;border:1px solid #ddd;border-radius:6px;color:#8E44AD;text-decoration:none;">上一页</a>` : ''}
        <span style="font-size:13px;color:#666;">第 ${page} / ${totalPages} 页 · 共 ${Number(totalRow?.total || 0)} 篇</span>
        ${page < totalPages ? `<a href="${buildListUrl(page + 1)}" style="padding:6px 12px;border:1px solid #ddd;border-radius:6px;color:#8E44AD;text-decoration:none;">下一页</a>` : ''}
      </nav>` : '';

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
            const href = buildListUrl(1, item.value, 'all');
            return `<a href="${href}" style="padding:6px 12px;border-radius:999px;text-decoration:none;font-size:13px;border:1px solid ${selected ? '#8E44AD' : '#ddd'};background:${selected ? '#8E44AD' : '#fff'};color:${selected ? '#fff' : '#333'};">${item.label}</a>`;
        }).join('')}
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;">
        ${[['all', '全部分类'], ...Object.entries(categoryNames)].map(([value, label]) => `<a href="${buildListUrl(1, typeParam, value)}" style="padding:5px 10px;border-radius:999px;text-decoration:none;font-size:12px;border:1px solid ${categoryParam === value ? '#3498db' : '#ddd'};background:${categoryParam === value ? '#3498db' : '#fff'};color:${categoryParam === value ? '#fff' : '#555'};">${label}</a>`).join('')}
      </div>
      ${typeParam === 'problem' ? `
        <form method="GET" action="/articles/list" style="margin-top:12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <input type="hidden" name="type" value="problem">
          ${categoryParam !== 'all' ? `<input type="hidden" name="category" value="${htmlEscape(categoryParam)}">` : ''}
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
          <span style="background:#eef5ff;color:#3578c5;font-size:10px;padding:2px 8px;border-radius:999px;margin-left:5px;">${categoryNames[a.category] || categoryNames.other}</span>
          ${a.article_type === 'problem' ? `<span style="background:#2c7be5;color:#fff;font-size:10px;padding:1px 8px;border-radius:3px;margin-left:4px;">题目讨论帖</span>` : ''}
          ${a.is_pinned ? `<span style="background:#f39c12;color:#fff;font-size:10px;padding:1px 8px;border-radius:3px;margin-left:4px;">${t('articlePinned')}</span>` : ''}
          ${a.is_locked ? `<span style="background:#e74c3c;color:#fff;font-size:10px;padding:1px 8px;border-radius:3px;margin-left:4px;"><i class="fas fa-lock"></i> ${t('articleLocked')}</span>` : ''}
          <div style="color:#999;font-size:13px;margin-top:2px;">
            ${renderUsernameLink(a.username, a.color, a.tag, a.author_id)}
            · ${formatTimeToChina(a.created_at)}
            ${a.is_saved ? ' · <span style="color:#8E44AD;"><i class="fas fa-bookmark"></i> 已收藏</span>' : ''}
          </div>
        </div>
      `).join('')}
      ${articles.results.length === 0 ? `<div style="color:#999;padding:20px 0;text-align:center;">${t('noArticles')}</div>` : ''}
      ${pagination}
    </div>
  `;
    return await getLayout(env, user, t('articleList'), content, '', req);
}

export async function renderArticleNew(env: Env, req: Request) {
    const t = getTranslator(req);
    const user = await getSessionUser(env, req);
    if (!user) return t('loginRequired');

    const url = new URL(req.url);
    const isProblemMode = url.searchParams.get('problem') === 'true';
    const problemOptions = await (await import('../utils/problem')).fetchProblemList();
    const categoryNames: Record<string, string> = { leisure: '休闲·娱乐', culture: '学习·文化', technology: '科技·工程', programming: '编程算法·理论', life: '生活·游记', announcement: '公告', other: '其他' };

    const content = `
    <div class="page-header"><h1><i class="fas fa-plus-circle"></i> ${isProblemMode ? '发布题目讨论帖' : t('newArticle')}</h1></div>
    <div class="card" style="max-width:800px;">
      <form action="/api/articles" method="POST">
        ${isProblemMode ? '<input type="hidden" name="problem" value="true">' : ''}
        ${!isProblemMode ? `<div style="margin-bottom:14px;"><label style="display:block;font-weight:500;margin-bottom:4px;font-size:14px;">帖子分类</label><select name="category" required style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:4px;font-size:14px;">${Object.entries(categoryNames).map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select></div>` : ''}
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
        <div id="draftStatus" role="status" style="display:inline-block;margin-left:10px;color:#777;font-size:12px;">草稿仅保存在此设备</div>
        <button id="clearDraft" type="button" style="margin-left:8px;background:none;border:0;color:#8E44AD;cursor:pointer;font-size:12px;">清除本机草稿</button>
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
        pv.textContent = ta.value || '';
        if (typeof window.renderMarkdownNodes === 'function') window.renderMarkdownNodes(pv);
      } else {
        ta.style.display = 'block';
        pv.style.display = 'none';
        editBtn.style.background = '#8E44AD'; editBtn.style.color = '#fff'; editBtn.style.borderColor = '#8E44AD';
        previewBtn.style.background = '#fff'; previewBtn.style.color = '#666'; previewBtn.style.borderColor = '#ddd';
      }
    }
    (function() {
      var form = document.querySelector('form[action="/api/articles"]');
      if (!form) return;
      var key = 'article-draft:${Number(user.id)}:${isProblemMode ? 'problem' : 'new'}';
      var status = document.getElementById('draftStatus');
      var fields = ['title', 'content', 'category', 'problem_id'];
      function readDraft() {
        try {
          var raw = localStorage.getItem(key);
          if (!raw) return;
          var draft = JSON.parse(raw);
          if (!draft || typeof draft.savedAt !== 'number' || Date.now() - draft.savedAt > 30 * 86400000) {
            localStorage.removeItem(key);
            return;
          }
          if (!confirm('发现本机保存的帖子草稿（' + new Date(draft.savedAt).toLocaleString() + '），是否恢复？')) return;
          fields.forEach(function(name) {
            var field = form.elements.namedItem(name);
            if (field && typeof draft[name] === 'string') field.value = draft[name];
          });
        } catch (error) {
          status.textContent = '读取草稿失败：浏览器存储不可用';
        }
      }
      function saveDraft() {
        try {
          var draft = { savedAt: Date.now() };
          fields.forEach(function(name) {
            var field = form.elements.namedItem(name);
            if (field) draft[name] = field.value;
          });
          localStorage.setItem(key, JSON.stringify(draft));
          status.textContent = '草稿已自动保存到此设备';
        } catch (error) {
          status.textContent = '保存草稿失败：浏览器存储不可用';
        }
      }
      readDraft();
      form.addEventListener('input', saveDraft);
      form.addEventListener('change', saveDraft);
      form.addEventListener('submit', function() {
        try {
          sessionStorage.setItem('article-draft-pending', key);
        } catch (error) {
          status.textContent = '无法记录草稿提交状态；发布后如草稿仍存在，请手动清除';
        }
      });
      document.getElementById('clearDraft').addEventListener('click', function() {
        try {
          localStorage.removeItem(key);
          status.textContent = '本机草稿已清除';
        } catch (error) {
          status.textContent = '清除草稿失败：浏览器存储不可用';
        }
      });
    })();
    </script>
  `;
    return await getLayout(env, user, t('newArticle'), content, '', req);
}

export async function renderArticleDetail(env: Env, req: Request, path: string) {
    const t = getTranslator(req);
    const user = await getSessionUser(env, req);
    const db = env.DB;
    const hexId = path.split('/')[2];

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
    const likeCount = await db.prepare('SELECT COUNT(*) AS total FROM article_likes WHERE article_id = ?').bind(article.id).first();
    const liked = user ? await db.prepare('SELECT article_id FROM article_likes WHERE article_id = ? AND user_id = ?').bind(article.id, user.id).first() : null;
    const bookmarked = user ? await db.prepare(
        'SELECT article_id FROM article_bookmarks WHERE article_id = ? AND user_id = ?'
    ).bind(article.id, user.id).first() : null;
    const categoryNames: Record<string, string> = { leisure: '休闲·娱乐', culture: '学习·文化', technology: '科技·工程', programming: '编程算法·理论', life: '生活·游记', announcement: '公告', other: '其他' };

    const isAuthor = user && user.id === article.author_id;
    const isAdmin = user && user.admin;

    const content = `
    <div class="page-header"><h1>${htmlEscape(article.title)} <span style="background:#eef5ff;color:#3578c5;font-size:12px;padding:3px 10px;border-radius:999px;margin-left:6px;">${categoryNames[article.category] || categoryNames.other}</span> ${article.article_type === 'problem' ? `<span style="background:#2c7be5;color:#fff;font-size:12px;padding:1px 10px;border-radius:3px;margin-left:6px;">题目讨论帖</span>` : ''} ${article.is_pinned ? `<span style="background:#f39c12;color:#fff;font-size:12px;padding:1px 10px;border-radius:3px;margin-left:6px;">${t('articlePinned')}</span>` : ''} ${article.is_locked ? `<span style="background:#e74c3c;color:#fff;font-size:12px;padding:1px 10px;border-radius:3px;margin-left:6px;"><i class="fas fa-lock"></i> ${t('articleLocked')}</span>` : ''}</h1></div>
    <div class="card">
      <div style="color:#999;margin-bottom:12px;font-size:14px;">
        ${renderUsernameLink(article.username, article.color, article.tag, article.author_id)}
        · ${formatTimeToChina(article.created_at)}
        ${problemUrl ? `· <a href="${problemUrl}" target="_blank" rel="noopener" style="color:#2c7be5;text-decoration:none;">${problemUrl}</a>` : ''}
      </div>
      <div class="markdown-body markdown-content">${htmlEscape(article.content)}</div>
      <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap;">
        <button id="shareArticleButton" type="button" onclick="copyArticleLink()" style="background:#fff;color:#555;padding:7px 16px;border:1px solid #ddd;border-radius:999px;cursor:pointer;"><i class="fas fa-share-alt"></i> ${t('shareClip')}</button>
        ${user ? `<button id="likeButton" onclick="toggleLike()" style="background:${liked ? '#e74c3c' : '#fff'};color:${liked ? '#fff' : '#e74c3c'};padding:7px 16px;border:1px solid #e74c3c;border-radius:999px;cursor:pointer;"><i class="fas fa-heart"></i> <span id="likeText">${liked ? '已点赞' : '点赞'}</span> <span id="likeCount">${Number(likeCount?.total || 0)}</span></button>` : `<span style="color:#999;font-size:13px;">登录后可以点赞</span>`}
        ${user ? `<button id="bookmarkButton" type="button" onclick="toggleBookmark()" style="background:${bookmarked ? '#8E44AD' : '#fff'};color:${bookmarked ? '#fff' : '#8E44AD'};padding:7px 16px;border:1px solid #8E44AD;border-radius:999px;cursor:pointer;"><i class="fas fa-bookmark"></i> <span id="bookmarkText">${bookmarked ? '已收藏' : '收藏'}</span></button>` : ''}
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
    <script>
      async function copyArticleLink() {
        const url = window.location.href;
        try {
          if (!navigator.clipboard || !window.isSecureContext) throw new Error('Clipboard API unavailable');
          await navigator.clipboard.writeText(url);
        } catch {
          const input = document.createElement('textarea');
          input.value = url;
          input.setAttribute('readonly', '');
          input.style.position = 'fixed';
          input.style.opacity = '0';
          document.body.appendChild(input);
          input.select();
          const copied = document.execCommand('copy');
          input.remove();
          if (!copied) {
            window.prompt('${t('shareClip')}', url);
            return;
          }
        }
        toast('${t('clipShareCopied')}');
      }
      async function toggleBookmark() {
        const button = document.getElementById('bookmarkButton');
        button.disabled = true;
        try {
          const response = await fetch('/api/articles/${Number(article.id)}/bookmark', { method: 'POST' });
          const data = await response.json();
          if (!response.ok) return toast(data.error || '收藏操作失败', 'error');
          document.getElementById('bookmarkText').textContent = data.bookmarked ? '已收藏' : '收藏';
          button.style.background = data.bookmarked ? '#8E44AD' : '#fff';
          button.style.color = data.bookmarked ? '#fff' : '#8E44AD';
        } catch (error) {
          toast('网络错误，收藏操作失败', 'error');
        } finally {
          button.disabled = false;
        }
      }
      (function() {
        try {
          const key = sessionStorage.getItem('article-draft-pending');
          if (!key) return;
          if (!key.startsWith('article-draft:${Number(user?.id || 0)}:')) {
            sessionStorage.removeItem('article-draft-pending');
            return;
          }
          localStorage.removeItem(key);
          sessionStorage.removeItem('article-draft-pending');
        } catch (error) {
          console.error('Failed to clear the submitted article draft', error);
        }
      })();
    </script>
    <div class="card">
      <h3 id="comments" style="font-size:15px;font-weight:600;margin-bottom:10px;"><i class="fas fa-comments"></i> ${t('comments')}</h3>
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
          async function toggleLike() {
            const response = await fetch('/api/articles/${article.id}/like', { method: 'POST' });
            const data = await response.json();
            if (!response.ok) return toast(data.error || '操作失败', 'error');
            document.getElementById('likeText').textContent = data.liked ? '已点赞' : '点赞';
            document.getElementById('likeCount').textContent = data.count;
            const button = document.getElementById('likeButton');
            button.style.background = data.liked ? '#e74c3c' : '#fff';
            button.style.color = data.liked ? '#fff' : '#e74c3c';
          }
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

    const article = await db.prepare('SELECT * FROM articles WHERE hex_id = ?').bind(hexId).first();
    if (!article) return t('articleNotFound');
    if (user.id !== article.author_id && !user.admin) return t('permissionDenied');

    const problemOptions = await (await import('../utils/problem')).fetchProblemList();
    const isProblemPost = article.article_type === 'problem' || article.problem_id;
    const categoryNames: Record<string, string> = { leisure: '休闲·娱乐', culture: '学习·文化', technology: '科技·工程', programming: '编程算法·理论', life: '生活·游记', announcement: '公告', other: '其他' };

    const content = `
    <div class="page-header"><h1><i class="fas fa-edit"></i> ${t('editArticle')}</h1></div>
    <div class="card" style="max-width:800px;">
      <form action="/api/articles/${article.id}" method="POST">
        <input type="hidden" name="_method" value="PUT">
        ${isProblemPost ? '<input type="hidden" name="problem" value="true">' : ''}
        ${!isProblemPost ? `<div style="margin-bottom:14px;"><label style="display:block;font-weight:500;margin-bottom:4px;font-size:14px;">帖子分类</label><select name="category" required style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:4px;font-size:14px;">${Object.entries(categoryNames).map(([value, label]) => `<option value="${value}" ${String(article.category || 'other') === value ? 'selected' : ''}>${label}</option>`).join('')}</select></div>` : ''}
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
        <div id="draftStatus" role="status" style="display:inline-block;margin-left:10px;color:#777;font-size:12px;">编辑草稿仅保存在此设备</div>
        <button id="clearDraft" type="button" style="margin-left:8px;background:none;border:0;color:#8E44AD;cursor:pointer;font-size:12px;">清除本机草稿</button>
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
        pv.textContent = ta.value || '';
        if (typeof window.renderMarkdownNodes === 'function') window.renderMarkdownNodes(pv);
      } else {
        ta.style.display = 'block';
        pv.style.display = 'none';
        editBtn.style.background = '#8E44AD'; editBtn.style.color = '#fff'; editBtn.style.borderColor = '#8E44AD';
        previewBtn.style.background = '#fff'; previewBtn.style.color = '#666'; previewBtn.style.borderColor = '#ddd';
      }
    }
    (function() {
      var form = document.querySelector('form[action="/api/articles/${Number(article.id)}"]');
      if (!form) return;
      var key = 'article-draft:${Number(user.id)}:${htmlEscape(String(article.hex_id))}';
      var status = document.getElementById('draftStatus');
      var fields = ['title', 'content', 'category', 'problem_id'];
      try {
        var raw = localStorage.getItem(key);
        if (raw) {
          var draft = JSON.parse(raw);
          if (draft && typeof draft.savedAt === 'number' && Date.now() - draft.savedAt <= 30 * 86400000 &&
              confirm('发现本机保存的编辑草稿（' + new Date(draft.savedAt).toLocaleString() + '），是否恢复？')) {
            fields.forEach(function(name) {
              var field = form.elements.namedItem(name);
              if (field && typeof draft[name] === 'string') field.value = draft[name];
            });
          } else if (!draft || Date.now() - Number(draft.savedAt || 0) > 30 * 86400000) {
            localStorage.removeItem(key);
          }
        }
      } catch (error) {
        status.textContent = '读取草稿失败：浏览器存储不可用';
      }
      function saveDraft() {
        try {
          var draft = { savedAt: Date.now() };
          fields.forEach(function(name) {
            var field = form.elements.namedItem(name);
            if (field) draft[name] = field.value;
          });
          localStorage.setItem(key, JSON.stringify(draft));
          status.textContent = '草稿已自动保存到此设备';
        } catch (error) {
          status.textContent = '保存草稿失败：浏览器存储不可用';
        }
      }
      form.addEventListener('input', saveDraft);
      form.addEventListener('change', saveDraft);
      form.addEventListener('submit', function() {
        try {
          sessionStorage.setItem('article-draft-pending', key);
        } catch (error) {
          status.textContent = '无法记录草稿提交状态；保存成功后如草稿仍存在，请手动清除';
        }
      });
      document.getElementById('clearDraft').addEventListener('click', function() {
        try {
          localStorage.removeItem(key);
          status.textContent = '本机草稿已清除';
        } catch (error) {
          status.textContent = '清除草稿失败：浏览器存储不可用';
        }
      });
    })();
    </script>
  `;
    return await getLayout(env, user, t('editArticle'), content, '', req);
}