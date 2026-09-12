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
        const messageType = new URL(req.url).searchParams.get('type');
        const typeFilter = messageType ? ' AND m.type = ?' : '';
        const messages = await db.prepare(
        `SELECT m.*, u.username as from_name, u.color as from_color, u.tag as from_tag
         FROM messages m
         LEFT JOIN users u ON m.from_user_id = u.id
            WHERE m.to_user_id = ? AND m.type != 'pm_chat'${typeFilter}
         ORDER BY m.created_at DESC`
        ).bind(...(messageType ? [user.id, messageType] : [user.id])).all();

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

    await db.prepare('UPDATE messages SET is_read = 1 WHERE to_user_id = ? AND is_read = 0 AND type != \'pm_chat\'')
        .bind(user.id).run();

    const content = `
        <div class="page-header"><h1><i class="fas fa-bell"></i> ${t('notifications')}</h1><p style="margin-top:4px;">${t('notificationType')}</p><div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;"><a href="/messages" style="color:#8E44AD;">全部</a><a href="/messages?type=report" style="color:#8E44AD;">举报</a><a href="/messages?type=permission_change" style="color:#8E44AD;">权限</a><a href="/messages?type=report_result" style="color:#8E44AD;">举报结果</a><button onclick="markAllRead()" style="border:1px solid #ddd;background:#fff;padding:3px 8px;border-radius:4px;cursor:pointer;">全部已读</button></div></div>
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
                </div>
            `).join('')}
        </div>
        <script>
            async function markAllRead() {
                await fetch('/api/messages/read-all', { method: 'POST' });
                location.reload();
            }
        </script>
    `;
    return await getLayout(env, user, t('notifications'), content, '', req);
}