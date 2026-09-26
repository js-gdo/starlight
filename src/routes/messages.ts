import { getSessionUser } from '../utils/auth';
import { getLayout } from '../utils/layout';
import { renderUsernameLink, htmlEscape, renderAtMentions, extractAtMentionTokens } from '../utils/html';
import { formatTimeToChina } from '../utils/time';
import { getTranslator } from '../utils/i18n';
import type { Env } from '../env.d';

export async function renderMessages(env: Env, req: Request) {
    const t = getTranslator(req);
    const user = await getSessionUser(env, req);
    if (!user) return t('loginRequired');

    const db = env.DB;
    const url = new URL(req.url);
    const messageType = url.searchParams.get('type');
    const unreadOnly = url.searchParams.get('unread') === '1';
    const filters = ["m.type != 'pm_chat'"];
    const bindValues: Array<string | number> = [user.id];
    if (messageType) {
        filters.push('m.type = ?');
        bindValues.push(messageType);
    }
    if (unreadOnly) filters.push('m.is_read = 0');
    const messages = await db.prepare(
        `SELECT m.*, u.username as from_name, u.color as from_color, u.tag as from_tag,
            a.hex_id as related_article_hex, t.id as related_ticket_id
         FROM messages m
         LEFT JOIN users u ON m.from_user_id = u.id
         LEFT JOIN articles a ON m.type = 'comment' AND a.id = m.related_id
         LEFT JOIN tickets t ON m.type IN ('ticket_status', 'ticket_reply', 'ticket_assign') AND t.id = m.related_id
            WHERE m.to_user_id = ? AND ${filters.join(' AND ')}
         ORDER BY m.created_at DESC`
    ).bind(...bindValues).all();

    const mentionTokens = Array.from(new Set(messages.results.flatMap((m: any) => extractAtMentionTokens(m.content || ''))));
    const mentionMap = new Map<string, any>();
    if (mentionTokens.length > 0) {
        const numericTokens = mentionTokens.filter((token) => /^\d+$/.test(token));
        const usernameTokens = mentionTokens.filter((token) => !/^\d+$/.test(token));
        if (numericTokens.length > 0) {
            const ids = numericTokens.map((token) => parseInt(token, 10));
            const idRows = await db.prepare(`SELECT id, username, color, tag FROM users WHERE id IN (${ids.map(() => '?').join(',')})`)
                .bind(...ids).all();
            for (const row of idRows.results) mentionMap.set(String(row.id), row);
        }
        if (usernameTokens.length > 0) {
            const nameRows = await db.prepare(`SELECT id, username, color, tag FROM users WHERE username IN (${usernameTokens.map(() => '?').join(',')})`)
                .bind(...usernameTokens).all();
            for (const row of nameRows.results) mentionMap.set(String(row.username).toLowerCase(), row);
        }
    }

    const typeHref = (type: string) => {
        const params = new URLSearchParams();
        if (unreadOnly) params.set('unread', '1');
        if (type) params.set('type', type);
        return `/messages${params.size ? `?${params}` : ''}`;
    };
    const getNotificationHref = (message: any): string | null => {
        const relatedId = Number(message.related_id);
        if (Number(message.related_ticket_id) === relatedId && relatedId > 0) {
            return `/ticket/${relatedId}`;
        }
        if (message.type === 'comment' && message.related_article_hex) {
            return `/articles/${encodeURIComponent(String(message.related_article_hex))}#comments`;
        }
        if (message.type === 'private' && Number(message.from_user_id) > 0) {
            return `/pm/${Number(message.from_user_id)}`;
        }
        if (message.type === 'permission_change') return '/settings';
        if (message.type === 'report' && user.admin) return '/backend#security-center';
        return null;
    };

    const content = `
        <div class="page-header"><h1><i class="fas fa-bell"></i> ${t('notifications')}</h1><p style="margin-top:4px;">${t('notificationType')}</p><div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;"><a href="${typeHref('')}" style="color:#8E44AD;">${t('all')}</a><a href="${typeHref('report')}" style="color:#8E44AD;">举报</a><a href="${typeHref('permission_change')}" style="color:#8E44AD;">权限</a><a href="${typeHref('report_result')}" style="color:#8E44AD;">举报结果</a><a href="${unreadOnly ? typeHref(messageType || '') : `/messages?${new URLSearchParams({ ...(messageType ? { type: messageType } : {}), unread: '1' })}`}" style="color:#8E44AD;border-bottom:${unreadOnly ? '2px solid #8E44AD' : 'none'};">${unreadOnly ? t('all') : t('unread')}</a><button onclick="markAllRead()" style="border:1px solid #ddd;background:#fff;padding:3px 8px;border-radius:4px;cursor:pointer;">${t('markAllNotificationsRead')}</button></div></div>
        <div class="card">
            ${messages.results.length === 0 ? `<div style="color:#999;padding:20px 0;text-align:center;">${t('noNotifications')}</div>` : ''}
            ${messages.results.map((m: any) => `
                <div style="padding:10px 0;border-bottom:1px solid #f5f5f5;">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <div>
                            ${m.from_user_id ? renderUsernameLink(m.from_name, m.from_color, m.from_tag, m.from_user_id) : t('systemMessage')}
                            <span style="font-size:12px;color:#999;margin-left:8px;">${formatTimeToChina(m.created_at)}</span>
                            ${m.is_read ? `<span style="font-size:11px;color:#999;margin-left:6px;">${t('read')}</span>` : `<span style="font-size:11px;color:#e74c3c;margin-left:6px;">${t('unread')}</span>`}
                        </div>
                        <span style="font-size:11px;color:#8E44AD;">${m.type}</span>
                    </div>
                    <div style="margin-top:4px;font-size:14px;color:#333;">${renderAtMentions(m.content || '', (token) => {
                        if (/^\d+$/.test(token)) return mentionMap.get(token) || null;
                        return mentionMap.get(token.toLowerCase()) || null;
                    })}</div>
                    ${getNotificationHref(m) ? `<a href="${getNotificationHref(m)}" onclick="openNotification(event, this, ${Number(m.id)})" style="display:inline-block;margin-top:6px;color:#8E44AD;font-size:13px;text-decoration:none;">${t('openNotification')} <i class="fas fa-arrow-right"></i></a>` : ''}
                </div>
            `).join('')}
        </div>
        <script>
            async function openNotification(event, link, messageId) {
                event.preventDefault();
                try {
                    await fetch('/api/messages/read', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message_id: messageId })
                    });
                } catch { }
                window.location.href = link.href;
            }

            async function markAllRead() {
                await fetch('/api/messages/read-all', { method: 'POST' });
                location.reload();
            }
        </script>
    `;
    return await getLayout(env, user, t('notifications'), content, '', req);
}