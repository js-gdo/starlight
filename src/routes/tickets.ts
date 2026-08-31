// @ts-nocheck
import { getSessionUser } from '../utils/auth';
import { getLayout } from '../utils/layout';
import { renderUsernameLink, htmlEscape } from '../utils/html';
import { formatTimeToChina } from '../utils/time';
import { getTicketStatus } from '../utils/constants';
import { getTranslator } from '../utils/i18n';
import type { Env } from '../env.d';

export async function renderTicketList(env: Env, req: Request) {
    const t = getTranslator(req);
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

    // 预翻译字符串
    const ticketListLabel = t('ticketList');
    const newTicketLabel = t('newTicket');
    const ticketAssigneeLabel = t('ticketAssignee');
    const ticketUnassignedLabel = t('ticketUnassigned');

    const itemsHtml = tickets.results.map((ticket: any) => {
        const statusInfo = getTicketStatus(ticket.status);
        const assigneeText = ticket.assignee_name
            ? ticketAssigneeLabel + '：' + htmlEscape(ticket.assignee_name)
            : ticketUnassignedLabel;
        return `
            <div style="padding:10px 0;border-bottom:1px solid #f5f5f5;">
                <a href="/ticket/${ticket.id}" style="font-size:16px;font-weight:500;color:#333;text-decoration:none;">${htmlEscape(ticket.title)}</a>
                <span style="background:${statusInfo.color};color:#fff;padding:2px 10px;border-radius:3px;font-size:11px;margin-left:4px;">
                    <i class="fas ${statusInfo.icon}"></i> ${statusInfo.label}
                </span>
                <div style="color:#999;font-size:13px;margin-top:2px;">
                    ${renderUsernameLink(ticket.username, ticket.color, ticket.tag, ticket.author_id)}
                    ${assigneeText}
                    · ${formatTimeToChina(ticket.created_at)}
                </div>
            </div>
        `;
    }).join('');

    const noTicketsHtml = tickets.results.length === 0
        ? `<div style="color:#999;padding:20px 0;text-align:center;">${t('noTickets')}</div>`
        : '';

    const content = `
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
        <div><h1><i class="fas fa-ticket-alt"></i> ${ticketListLabel}</h1></div>
        <a href="/ticket/new" style="background:#8E44AD;color:#fff;padding:6px 16px;border-radius:4px;text-decoration:none;font-size:14px;"><i class="fas fa-plus"></i> ${newTicketLabel}</a>
    </div>
    <div class="card">
        ${itemsHtml}
        ${noTicketsHtml}
    </div>
    `;
    return await getLayout(env, user, ticketListLabel, content, '', req);
}

export async function renderTicketNew(env: Env, req: Request) {
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

    const pageTitle = t('newTicket');
    const ticketTitleLabel = t('ticketTitle');
    const ticketContentLabel = t('ticketContent');
    const markdownSupportedLabel = t('markdownSupported');
    const editTabLabel = t('editTab');
    const previewTabLabel = t('previewTab');
    const submitLabel = t('submit');
    const cancelLabel = t('cancel');

    const content = `
    <div class="page-header"><h1><i class="fas fa-plus-circle"></i> ${pageTitle}</h1></div>
    <div class="card" style="max-width:800px;">
        <form action="/api/tickets" method="POST">
            <div style="margin-bottom:14px;">
                <label style="display:block;font-weight:500;margin-bottom:4px;font-size:14px;">${ticketTitleLabel}</label>
                <input name="title" placeholder="${ticketTitleLabel}" required style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:4px;font-size:14px;">
            </div>
            <div style="margin-bottom:14px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                    <label style="font-weight:500;font-size:14px;">${ticketContentLabel}</label>
                    <div style="display:flex;gap:4px;">
                        <button type="button" id="mdEditBtn" onclick="toggleMdPreview('ticketMd','edit')" style="padding:3px 12px;border:1px solid #8E44AD;background:#8E44AD;color:#fff;border-radius:4px;font-size:12px;cursor:pointer;">${editTabLabel}</button>
                        <button type="button" id="mdPreviewBtn" onclick="toggleMdPreview('ticketMd','preview')" style="padding:3px 12px;border:1px solid #ddd;background:#fff;color:#666;border-radius:4px;font-size:12px;cursor:pointer;">${previewTabLabel}</button>
                    </div>
                </div>
                <textarea id="ticketMd" name="content" placeholder="${markdownSupportedLabel}" rows="6" required style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:4px;font-size:14px;resize:vertical;font-family:monospace;"></textarea>
                <div id="ticketMdPreview" class="markdown-body md-preview-box" style="display:none;width:100%;padding:12px;border:1px solid #eee;border-radius:4px;min-height:150px;background:#fafbfc;"></div>
            </div>
            <button type="submit" style="background:#8E44AD;color:#fff;padding:8px 24px;border:none;border-radius:4px;font-size:14px;font-weight:500;cursor:pointer;">${submitLabel}</button>
            <a href="/ticket/list" style="margin-left:10px;color:#999;text-decoration:none;">${cancelLabel}</a>
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
    return await getLayout(env, user, pageTitle, content, '', req);
}

export async function renderTicketDetail(env: Env, req: Request, path: string) {
    const t = getTranslator(req);
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
    if (!ticket) return t('ticketNotFound');

    const replies = await db.prepare(
        `SELECT r.*, u.username, u.color, u.tag FROM ticket_replies r JOIN users u ON r.author_id = u.id WHERE r.ticket_id = ? ORDER BY r.created_at ASC`
    ).bind(id).all();

    const admins = await db.prepare('SELECT * FROM users WHERE admin = 1').all();

    const isAuthor = user && user.id === ticket.author_id;
    const isAdmin = user && user.admin;
    const statusInfo = getTicketStatus(ticket.status);

    // 预翻译
    const pageTitle = t('ticketDetail');
    const statusLabel = t('ticketStatus');
    const ticketAssigneeLabel = t('ticketAssignee');
    const ticketUnassignedLabel = t('ticketUnassigned');
    const editLabel = t('edit');
    const deleteLabel = t('delete');
    const assignLabel = t('assign');
    const noAssigneeLabel = t('noAssignee');
    const ticketReplyLabel = t('ticketReply');
    const replyPlaceholder = t('ticketReplyPlaceholder');
    const noTicketRepliesLabel = t('noTicketReplies');

    // 状态选项
    const statusOptions = [
        { value: 'pending', label: t('ticketStatusPending') },
        { value: 'completed', label: t('ticketStatusCompleted') },
        { value: 'closed', label: t('ticketStatusClosed') },
        { value: 'suspended', label: t('ticketStatusSuspended') },
        { value: 'waiting', label: t('ticketStatusWaiting') },
    ];

    const statusSelectHtml = isAdmin ? `
        <form action="/api/tickets/${ticket.id}/status" method="POST" style="display:inline;margin-left:8px;">
            <select name="status" style="padding:4px 8px;border:1px solid #ddd;border-radius:4px;font-size:13px;">
                ${statusOptions.map(opt => `<option value="${opt.value}" ${ticket.status === opt.value ? 'selected' : ''}>${opt.label}</option>`).join('')}
            </select>
            <button type="submit" style="background:#8E44AD;color:#fff;padding:4px 14px;border:none;border-radius:4px;cursor:pointer;font-size:13px;">${t('ticketStatusUpdated')}</button>
        </form>
    ` : '';

    const assigneeText = ticket.assignee_name
        ? ticketAssigneeLabel + '：' + htmlEscape(ticket.assignee_name)
        : ticketUnassignedLabel;

    const assignForm = isAdmin ? `
        <form action="/api/tickets/${ticket.id}" method="POST" style="display:flex;gap:6px;align-items:center;">
            <select name="assignee_id" style="padding:4px 8px;border:1px solid #ddd;border-radius:4px;">
                <option value="0">${noAssigneeLabel}</option>
                ${admins.results.map((a: any) => `<option value="${a.id}" ${a.id == ticket.assignee_id ? 'selected' : ''}>${htmlEscape(a.username)}</option>`).join('')}
            </select>
            <button type="submit" style="background:#8E44AD;color:#fff;padding:4px 14px;border:none;border-radius:4px;cursor:pointer;">${assignLabel}</button>
        </form>
        <form action="/api/admin/ticket/${ticket.id}/delete" method="POST" style="display:inline;">
            <button type="submit" style="background:#e74c3c;color:#fff;padding:4px 14px;border:none;border-radius:4px;cursor:pointer;"><i class="fas fa-trash-alt"></i> ${deleteLabel}</button>
        </form>
    ` : '';

    const editLink = (isAuthor || isAdmin) ? `
        <a href="/ticket/${id}/edit" style="background:#3498db;color:#fff;padding:4px 14px;border-radius:4px;text-decoration:none;font-size:13px;"><i class="fas fa-edit"></i> ${editLabel}</a>
    ` : '';

    const replyHtml = replies.results.map((r: any) => `
        <div style="padding:8px 0;border-bottom:1px solid #f5f5f5;">
            ${renderUsernameLink(r.username, r.color, r.tag, r.author_id)}
            <span style="font-size:13px;color:#999;margin-left:6px;">${formatTimeToChina(r.created_at)}</span>
            <div class="markdown-body markdown-content" style="margin-top:4px;">${htmlEscape(r.content)}</div>
        </div>
    `).join('');

    const noRepliesHtml = replies.results.length === 0
        ? `<div style="color:#999;padding:12px 0;text-align:center;">${noTicketRepliesLabel}</div>`
        : '';

    const replyForm = user ? `
        <form action="/api/tickets/${ticket.id}/replies" method="POST" style="margin-top:12px;">
            <textarea name="content" placeholder="${replyPlaceholder}" rows="2" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;resize:vertical;font-size:14px;"></textarea>
            <button type="submit" style="margin-top:6px;background:#8E44AD;color:#fff;padding:6px 18px;border:none;border-radius:4px;cursor:pointer;">${ticketReplyLabel}</button>
        </form>
    ` : '';

    const content = `
    <div class="page-header"><h1><i class="fas fa-ticket-alt"></i> ${pageTitle}</h1></div>
    <div class="card">
        <h2 style="font-size:18px;">${htmlEscape(ticket.title)}</h2>
        <div style="margin:6px 0;">
            ${statusLabel}：<span style="background:${statusInfo.color};color:#fff;padding:2px 12px;border-radius:3px;font-size:13px;">
                <i class="fas ${statusInfo.icon}"></i> ${statusInfo.label}
            </span>
            ${statusSelectHtml}
        </div>
        <div style="color:#999;font-size:14px;">
            ${renderUsernameLink(ticket.username, ticket.color, ticket.tag, ticket.author_id)}
            ${assigneeText}
            · ${formatTimeToChina(ticket.created_at)}
        </div>
        <div class="markdown-body markdown-content" style="margin-top:10px;">${htmlEscape(ticket.content)}</div>
        <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap;">
            ${editLink}
            ${assignForm}
        </div>
    </div>
    <div class="card">
        <h3 style="font-size:15px;font-weight:600;margin-bottom:10px;"><i class="fas fa-reply-all"></i> ${ticketReplyLabel}</h3>
        ${replyHtml}
        ${noRepliesHtml}
        ${replyForm}
    </div>
    `;
    return await getLayout(env, user, pageTitle, content, '', req);
}

export async function renderTicketEdit(env: Env, req: Request, path: string) {
    const t = getTranslator(req);
    const user = await getSessionUser(env, req);
    if (!user) return t('loginRequired');

    const id = parseInt(path.split('/')[2]);
    const db = env.DB;

    let unreadCount = 0;
    if (user) {
        const countResult = await db.prepare('SELECT COUNT(*) as cnt FROM messages WHERE to_user_id = ? AND is_read = 0')
            .bind(user.id).first();
        unreadCount = countResult ? countResult.cnt : 0;
    }

    const ticket = await db.prepare('SELECT * FROM tickets WHERE id = ?').bind(id).first();
    if (!ticket) return t('ticketNotFound');
    if (user.id !== ticket.author_id && !user.admin) return t('permissionDenied');

    const pageTitle = t('ticketEdit');
    const ticketTitleLabel = t('ticketTitle');
    const ticketContentLabel = t('ticketContent');
    const markdownSupportedLabel = t('markdownSupported');
    const editTabLabel = t('editTab');
    const previewTabLabel = t('previewTab');
    const saveChangesLabel = t('saveChanges');
    const cancelLabel = t('cancel');

    const content = `
    <div class="page-header"><h1><i class="fas fa-edit"></i> ${pageTitle}</h1></div>
    <div class="card" style="max-width:800px;">
        <form action="/api/tickets/${ticket.id}" method="POST">
            <input type="hidden" name="_method" value="PUT">
            <div style="margin-bottom:14px;">
                <label style="display:block;font-weight:500;margin-bottom:4px;font-size:14px;">${ticketTitleLabel}</label>
                <input name="title" value="${htmlEscape(ticket.title)}" required style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:4px;font-size:14px;">
            </div>
            <div style="margin-bottom:14px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                    <label style="font-weight:500;font-size:14px;">${ticketContentLabel}</label>
                    <div style="display:flex;gap:4px;">
                        <button type="button" id="mdEditBtn" onclick="toggleMdPreview('ticketMd','edit')" style="padding:3px 12px;border:1px solid #8E44AD;background:#8E44AD;color:#fff;border-radius:4px;font-size:12px;cursor:pointer;">${editTabLabel}</button>
                        <button type="button" id="mdPreviewBtn" onclick="toggleMdPreview('ticketMd','preview')" style="padding:3px 12px;border:1px solid #ddd;background:#fff;color:#666;border-radius:4px;font-size:12px;cursor:pointer;">${previewTabLabel}</button>
                    </div>
                </div>
                <textarea id="ticketMd" name="content" rows="6" required style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:4px;font-size:14px;resize:vertical;font-family:monospace;">${htmlEscape(ticket.content)}</textarea>
                <div id="ticketMdPreview" class="markdown-body md-preview-box" style="display:none;width:100%;padding:12px;border:1px solid #eee;border-radius:4px;min-height:150px;background:#fafbfc;"></div>
            </div>
            <button type="submit" style="background:#8E44AD;color:#fff;padding:8px 24px;border:none;border-radius:4px;font-size:14px;font-weight:500;cursor:pointer;">${saveChangesLabel}</button>
            <a href="/ticket/${id}" style="margin-left:10px;color:#999;text-decoration:none;">${cancelLabel}</a>
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
    return await getLayout(env, user, pageTitle, content, '', req);
}