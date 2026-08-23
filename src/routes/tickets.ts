import { getSessionUser, generateHex, jsonRes } from '../utils/auth';
import { getLayout } from '../utils/layout';
import { renderUsernameLink, htmlEscape } from '../utils/html';
import { formatTimeToChina, getChinaTime, getHitokoto } from '../utils/time';
import { getUserColor, getTicketStatus } from '../utils/constants';
export async function renderTicketList(env, req) {
    const user = await getSessionUser(env, req);
    const db = env.DB;

    let unreadCount = 0;
    if (user) {
        const countResult = await db.prepare('SELECT COUNT(*) as cnt FROM messages WHERE to_user_id = ? AND is_read = 0')
            .bind(user.id).first();
        unreadCount = countResult ? countResult.cnt : 0;
    }

    const tickets = await db.prepare(
        `SELECT t.*, u.username, u.color, u.tag, a.username as assignee_name
		 FROM tickets t
						JOIN users u ON t.author_id = u.id
			      LEFT JOIN users a ON t.assignee_id = a.id
		 ORDER BY t.created_at DESC`
    ).all();

    const content = `
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
      <div><h1><i class="fas fa-ticket-alt"></i> 工单列表</h1></div>
      <a href="/ticket/new" style="background:#8E44AD;color:#fff;padding:6px 16px;border-radius:4px;text-decoration:none;font-size:14px;"><i class="fas fa-plus"></i> 创建工单</a>
    </div>
    <div class="card">
      ${tickets.results.map(t => {
        const statusInfo = getTicketStatus(t.status);
        return `
          <div style="padding:10px 0;border-bottom:1px solid #f5f5f5;">
            <a href="/ticket/${t.id}" style="font-size:16px;font-weight:500;color:#333;text-decoration:none;">${htmlEscape(t.title)}</a>
            <span style="background:${statusInfo.color};color:#fff;padding:2px 10px;border-radius:3px;font-size:11px;margin-left:4px;">
              <i class="fas ${statusInfo.icon}"></i> ${statusInfo.label}
            </span>
            <div style="color:#999;font-size:13px;margin-top:2px;">
              ${renderUsernameLink(t.username, t.color, t.tag, t.author_id)}
              ${t.assignee_name ? `· 指派：${htmlEscape(t.assignee_name)}` : '· 未指派'}
              · ${formatTimeToChina(t.created_at)}
            </div>
          </div>
        `;
    }).join('')}
    </div>
  `;
    return await getLayout(env, user, '工单列表', content);
}

export async function renderTicketNew(env, req) {
    const user = await getSessionUser(env, req);
    if (!user) return '请先登录';

    const db = env.DB;
    let unreadCount = 0;
    if (user) {
        const countResult = await db.prepare('SELECT COUNT(*) as cnt FROM messages WHERE to_user_id = ? AND is_read = 0')
            .bind(user.id).first();
        unreadCount = countResult ? countResult.cnt : 0;
    }

    const content = `
    <div class="page-header"><h1><i class="fas fa-plus-circle"></i> 创建工单</h1></div>
    <div class="card" style="max-width:800px;">
      <form action="/api/tickets" method="POST">
        <div style="margin-bottom:14px;">
          <label style="display:block;font-weight:500;margin-bottom:4px;font-size:14px;">标题</label>
          <input name="title" placeholder="请输入工单标题" required style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:4px;font-size:14px;">
        </div>
        <div style="margin-bottom:14px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <label style="font-weight:500;font-size:14px;">详细描述（支持 Markdown）</label>
            <div style="display:flex;gap:4px;">
              <button type="button" id="mdEditBtn" onclick="toggleMdPreview('ticketMd','edit')" style="padding:3px 12px;border:1px solid #8E44AD;background:#8E44AD;color:#fff;border-radius:4px;font-size:12px;cursor:pointer;">编辑</button>
              <button type="button" id="mdPreviewBtn" onclick="toggleMdPreview('ticketMd','preview')" style="padding:3px 12px;border:1px solid #ddd;background:#fff;color:#666;border-radius:4px;font-size:12px;cursor:pointer;">预览</button>
            </div>
          </div>
          <textarea id="ticketMd" name="content" placeholder="详细描述您的问题" rows="6" required style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:4px;font-size:14px;resize:vertical;font-family:monospace;"></textarea>
          <div id="ticketMdPreview" class="markdown-body md-preview-box" style="display:none;width:100%;padding:12px;border:1px solid #eee;border-radius:4px;min-height:150px;background:#fafbfc;"></div>
        </div>
        <button type="submit" style="background:#8E44AD;color:#fff;padding:8px 24px;border:none;border-radius:4px;font-size:14px;font-weight:500;cursor:pointer;">提交</button>
        <a href="/ticket/list" style="margin-left:10px;color:#999;text-decoration:none;">取消</a>
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
    return await getLayout(env, user, '创建工单', content);
}

export async function renderTicketDetail(env, req, path) {
    const user = await getSessionUser(env, req);
    const db = env.DB;
    const id = parseInt(path.split('/')[2]);

    let unreadCount = 0;
    if (user) {
        const countResult = await db.prepare('SELECT COUNT(*) as cnt FROM messages WHERE to_user_id = ? AND is_read = 0')
            .bind(user.id).first();
        unreadCount = countResult ? countResult.cnt : 0;
    }

    const ticket = await db.prepare(
        `SELECT t.*, u.username, u.color, u.tag, a.username as assignee_name
		 FROM tickets t JOIN users u ON t.author_id = u.id
		                LEFT JOIN users a ON t.assignee_id = a.id
		 WHERE t.id = ?`
    ).bind(id).first();
    if (!ticket) return '工单不存在';
    const replies = await db.prepare(
        `SELECT r.*, u.username, u.color, u.tag FROM ticket_replies r JOIN users u ON r.author_id = u.id WHERE r.ticket_id = ? ORDER BY r.created_at ASC`
    ).bind(id).all();
    const admins = await db.prepare('SELECT * FROM users WHERE admin = 1').all();

    const isAuthor = user && user.id === ticket.author_id;
    const isAdmin = user && user.admin;
    const statusInfo = getTicketStatus(ticket.status);

    const content = `
    <div class="page-header"><h1><i class="fas fa-ticket-alt"></i> 工单 #${id}</h1></div>
    <div class="card">
      <h2 style="font-size:18px;">${htmlEscape(ticket.title)}</h2>
      <div style="margin:6px 0;">
        状态：<span style="background:${statusInfo.color};color:#fff;padding:2px 12px;border-radius:3px;font-size:13px;">
          <i class="fas ${statusInfo.icon}"></i> ${statusInfo.label}
        </span>
        ${isAdmin ? `
          <form action="/api/tickets/${ticket.id}/status" method="POST" style="display:inline;margin-left:8px;">
            <select name="status" style="padding:4px 8px;border:1px solid #ddd;border-radius:4px;font-size:13px;">
              <option value="pending" ${ticket.status === 'pending' ? 'selected' : ''}>待处理</option>
              <option value="completed" ${ticket.status === 'completed' ? 'selected' : ''}>已完成</option>
              <option value="closed" ${ticket.status === 'closed' ? 'selected' : ''}>已关闭</option>
              <option value="suspended" ${ticket.status === 'suspended' ? 'selected' : ''}>挂起</option>
              <option value="waiting" ${ticket.status === 'waiting' ? 'selected' : ''}>待补充</option>
            </select>
            <button type="submit" style="background:#8E44AD;color:#fff;padding:4px 14px;border:none;border-radius:4px;cursor:pointer;font-size:13px;">更新状态</button>
          </form>
        ` : ''}
      </div>
      <div style="color:#999;font-size:14px;">
        ${renderUsernameLink(ticket.username, ticket.color, ticket.tag, ticket.author_id)}
        ${ticket.assignee_name ? `· 指派：${htmlEscape(ticket.assignee_name)}` : '· 未指派'}
        · ${formatTimeToChina(ticket.created_at)}
      </div>
      <div class="markdown-body markdown-content" style="margin-top:10px;">${htmlEscape(ticket.content)}</div>
      <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap;">
        ${(isAuthor || isAdmin) ? `
          <a href="/ticket/${id}/edit" style="background:#3498db;color:#fff;padding:4px 14px;border-radius:4px;text-decoration:none;font-size:13px;"><i class="fas fa-edit"></i> 编辑</a>
        ` : ''}
        ${isAdmin ? `
          <form action="/api/tickets/${ticket.id}" method="POST" style="display:flex;gap:6px;align-items:center;">
            <select name="assignee_id" style="padding:4px 8px;border:1px solid #ddd;border-radius:4px;">
              <option value="0">不指派</option>
              ${admins.results.map(a => `<option value="${a.id}" ${a.id == ticket.assignee_id ? 'selected' : ''}>${htmlEscape(a.username)}</option>`).join('')}
            </select>
            <button type="submit" style="background:#8E44AD;color:#fff;padding:4px 14px;border:none;border-radius:4px;cursor:pointer;">指派</button>
          </form>
          <form action="/api/admin/ticket/${ticket.id}/delete" method="POST" style="display:inline;">
            <button type="submit" style="background:#e74c3c;color:#fff;padding:4px 14px;border:none;border-radius:4px;cursor:pointer;"><i class="fas fa-trash-alt"></i> 删除</button>
          </form>
        ` : ''}
      </div>
    </div>
    <div class="card">
      <h3 style="font-size:15px;font-weight:600;margin-bottom:10px;"><i class="fas fa-reply-all"></i> 回复</h3>
      ${replies.results.map(r => `
        <div style="padding:8px 0;border-bottom:1px solid #f5f5f5;">
          ${renderUsernameLink(r.username, r.color, r.tag, r.author_id)}
          <span style="font-size:13px;color:#999;margin-left:6px;">${formatTimeToChina(r.created_at)}</span>
          <div class="markdown-body markdown-content" style="margin-top:4px;">${htmlEscape(r.content)}</div>
        </div>
      `).join('')}
      ${user ? `
        <form action="/api/tickets/${ticket.id}/replies" method="POST" style="margin-top:12px;">
          <textarea name="content" placeholder="回复..." rows="2" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;resize:vertical;font-size:14px;"></textarea>
          <button type="submit" style="margin-top:6px;background:#8E44AD;color:#fff;padding:6px 18px;border:none;border-radius:4px;cursor:pointer;">回复</button>
        </form>
      ` : ''}
    </div>
  `;
    return await getLayout(env, user, '工单详情', content);
}

export async function renderTicketEdit(env, req, path) {
    const user = await getSessionUser(env, req);
    if (!user) return '请先登录';
    const id = parseInt(path.split('/')[2]);
    const db = env.DB;

    let unreadCount = 0;
    if (user) {
        const countResult = await db.prepare('SELECT COUNT(*) as cnt FROM messages WHERE to_user_id = ? AND is_read = 0')
            .bind(user.id).first();
        unreadCount = countResult ? countResult.cnt : 0;
    }

    const ticket = await db.prepare('SELECT * FROM tickets WHERE id = ?').bind(id).first();
    if (!ticket) return '工单不存在';
    if (user.id !== ticket.author_id && !user.admin) return '无权限编辑此工单';

    const content = `
    <div class="page-header"><h1><i class="fas fa-edit"></i> 编辑工单</h1></div>
    <div class="card" style="max-width:800px;">
      <form action="/api/tickets/${ticket.id}" method="POST">
        <input type="hidden" name="_method" value="PUT">
        <div style="margin-bottom:14px;">
          <label style="display:block;font-weight:500;margin-bottom:4px;font-size:14px;">标题</label>
          <input name="title" value="${htmlEscape(ticket.title)}" required style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:4px;font-size:14px;">
        </div>
        <div style="margin-bottom:14px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <label style="font-weight:500;font-size:14px;">详细描述（支持 Markdown）</label>
            <div style="display:flex;gap:4px;">
              <button type="button" id="mdEditBtn" onclick="toggleMdPreview('ticketMd','edit')" style="padding:3px 12px;border:1px solid #8E44AD;background:#8E44AD;color:#fff;border-radius:4px;font-size:12px;cursor:pointer;">编辑</button>
              <button type="button" id="mdPreviewBtn" onclick="toggleMdPreview('ticketMd','preview')" style="padding:3px 12px;border:1px solid #ddd;background:#fff;color:#666;border-radius:4px;font-size:12px;cursor:pointer;">预览</button>
            </div>
          </div>
          <textarea id="ticketMd" name="content" rows="6" required style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:4px;font-size:14px;resize:vertical;font-family:monospace;">${htmlEscape(ticket.content)}</textarea>
          <div id="ticketMdPreview" class="markdown-body md-preview-box" style="display:none;width:100%;padding:12px;border:1px solid #eee;border-radius:4px;min-height:150px;background:#fafbfc;"></div>
        </div>
        <button type="submit" style="background:#8E44AD;color:#fff;padding:8px 24px;border:none;border-radius:4px;font-size:14px;font-weight:500;cursor:pointer;">保存修改</button>
        <a href="/ticket/${id}" style="margin-left:10px;color:#999;text-decoration:none;">取消</a>
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
    return await getLayout(env, user, '编辑工单', content);
}