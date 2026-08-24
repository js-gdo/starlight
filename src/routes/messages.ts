import { getSessionUser } from '../utils/auth';
import { getLayout } from '../utils/layout';
import { renderUsernameLink, htmlEscape } from '../utils/html';
import { formatTimeToChina } from '../utils/time';
export async function renderMessages(env, req) {
    const user = await getSessionUser(env, req);
    if (!user) return '请先登录';
    const db = env.DB;
    const messages = await db.prepare(
        `SELECT m.*, u.username as from_name, u.color as from_color, u.tag as from_tag
		 FROM messages m
						LEFT JOIN users u ON m.from_user_id = u.id
		 WHERE m.to_user_id = ? AND m.type != 'pm_chat'
		 ORDER BY m.created_at DESC`
    ).bind(user.id).all();

    await db.prepare('UPDATE messages SET is_read = 1 WHERE to_user_id = ? AND is_read = 0 AND type != \'pm_chat\'')
        .bind(user.id).run();

    const content = `
    <div class="page-header"><h1><i class="fas fa-bell"></i> 系统通知</h1><p style="margin-top:4px;">工单状态变更、帖子回复、权限变动等系统消息</p></div>
    <div class="card">
      ${messages.results.length === 0 ? '<div style="color:#999;padding:20px 0;text-align:center;">暂无系统通知</div>' : ''}
      ${messages.results.map(m => `
        <div style="padding:10px 0;border-bottom:1px solid #f5f5f5;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div>
              ${m.from_user_id ? renderUsernameLink(m.from_name, m.from_color, m.from_tag, m.from_user_id) : '系统'}
              <span style="font-size:12px;color:#999;margin-left:8px;">${formatTimeToChina(m.created_at)}</span>
              ${m.is_read ? '<span style="font-size:11px;color:#999;margin-left:6px;">已读</span>' : '<span style="font-size:11px;color:#e74c3c;margin-left:6px;">未读</span>'}
            </div>
            <span style="font-size:11px;color:#8E44AD;">${m.type}</span>
          </div>
          <div style="margin-top:4px;font-size:14px;color:#333;">${htmlEscape(m.content)}</div>
        </div>
      `).join('')}
    </div>
  `;
    const unreadCount = 0;
    return await getLayout(env, user, '消息', content);
}