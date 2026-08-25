import { getSessionUser, generateHex, jsonRes } from '../utils/auth';
import { getLayout } from '../utils/layout';
import { renderUsernameLink, htmlEscape } from '../utils/html';
import { formatTimeToChina, getChinaTime, getHitokoto } from '../utils/time';
import { getUserColor, getTicketStatus } from '../utils/constants';
export async function renderBackend(env, req) {
    const user = await getSessionUser(env, req);
    if (!user || !user.admin) return '无权限';
    const db = env.DB;

    let unreadCount = 0;
    if (user) {
        const countResult = await db.prepare('SELECT COUNT(*) as cnt FROM messages WHERE to_user_id = ? AND is_read = 0')
            .bind(user.id).first();
        unreadCount = countResult ? countResult.cnt : 0;
    }

    const users = await db.prepare('SELECT * FROM users ORDER BY id').all();
    const articles = await db.prepare('SELECT * FROM articles ORDER BY id DESC').all();
    const tickets = await db.prepare('SELECT * FROM tickets ORDER BY id DESC').all();
    const banners = await db.prepare('SELECT * FROM banners ORDER BY sort_order ASC, id ASC').all();

    const content = `
    <div class="page-header"><h1><i class="fas fa-cog"></i> 后台管理</h1></div>

    <div class="card" style="overflow-x:auto;">
      <h2 style="font-size:16px;font-weight:600;margin-bottom:12px;"><i class="fas fa-users"></i> 用户管理</h2>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="border-bottom:2px solid #f0f0f0;">
            <th style="text-align:left;padding:6px;">ID</th>
            <th style="text-align:left;padding:6px;">用户名</th>
            <th style="text-align:left;padding:6px;">权限</th>
            <th style="text-align:left;padding:6px;">颜色</th>
            <th style="text-align:left;padding:6px;">牌子</th>
            <th style="text-align:left;padding:6px;">禁言</th>
            <th style="text-align:left;padding:6px;">最近登录</th>
            <th style="text-align:left;padding:6px;">操作</th>
          </tr>
        </thead>
        <tbody>
          ${users.results.map(u => `
            <tr style="border-bottom:1px solid #f5f5f5;">
              <td style="padding:6px;">${u.id}</td>
              <td style="padding:6px;">${renderUsernameLink(u.username, u.color, u.tag, u.id)}</td>
              <td style="padding:6px;font-size:12px;">use:${u.use} speak:${u.speak} admin:${u.admin}</td>
              <td style="padding:6px;"><span style="display:inline-block;width:12px;height:12px;border-radius:2px;background:${getUserColor(u.color)};vertical-align:middle;margin-right:4px;"></span>${({ purple: '紫名', red: '红名', orange: '橙名', green: '绿名', blue: '蓝名', gray: '灰名' })[u.color] || u.color}</td>
              <td style="padding:6px;">${u.tag || '无'}</td>
              <td style="padding:6px;"><span style="color:${u.violation_count > 0 ? '#e74c3c' : '#999'};font-weight:600;">${u.violation_count || 0}</span></td>
              <td style="padding:6px;font-size:12px;color:#666;line-height:1.5;">
                ${u.last_ip ? `<div><i class="fas fa-network-wired" style="color:#8E44AD;"></i> ${htmlEscape(u.last_ip)}</div>` : '<div style="color:#bbb;">无记录</div>'}
                ${u.last_login_at ? `<div style="color:#999;">${formatTimeToChina(u.last_login_at)}</div>` : ''}
              </td>
              <td style="padding:6px;">
                <form action="/api/admin/user/${u.id}" method="POST" style="display:flex;gap:4px;flex-wrap:wrap;align-items:center;">
                  <select name="mode" style="padding:3px 6px;border:1px solid #ddd;border-radius:3px;font-size:12px;">
                    <option value="profile">更改资料</option>
                    <option value="permission">更改权限</option>
                  </select>
                  <select name="color" style="padding:3px 6px;border:1px solid #ddd;border-radius:3px;font-size:12px;">
                    <option value="purple" ${u.color === 'purple' ? 'selected' : ''}>紫名</option>
                    <option value="red" ${u.color === 'red' ? 'selected' : ''}>红名</option>
                    <option value="orange" ${u.color === 'orange' ? 'selected' : ''}>橙名</option>
                    <option value="green" ${u.color === 'green' ? 'selected' : ''}>绿名</option>
                    <option value="blue" ${u.color === 'blue' ? 'selected' : ''}>蓝名</option>
                    <option value="gray" ${u.color === 'gray' ? 'selected' : ''}>灰名</option>
                  </select>
                  <input type="text" name="tag" placeholder="牌子（可选）" value="${u.tag || ''}" style="width:60px;padding:3px 6px;border:1px solid #ddd;border-radius:3px;font-size:12px;">
                  <select name="permission" style="padding:3px 6px;border:1px solid #ddd;border-radius:3px;font-size:12px;">
                    <option value="">-- 权限 --</option>
                    <option value="use">进入网站</option>
                    <option value="speak">发言</option>
                    <option value="admin">管理员</option>
                  </select>
                  <select name="action" style="padding:3px 6px;border:1px solid #ddd;border-radius:3px;font-size:12px;">
                    <option value="">-- 操作 --</option>
                    <option value="grant">授予</option>
                    <option value="revoke">取消</option>
                  </select>
                  <input type="text" name="reason" placeholder="原因（可选）" style="width:80px;padding:3px 6px;border:1px solid #ddd;border-radius:3px;font-size:12px;">
                  <button type="submit" style="background:#8E44AD;color:#fff;padding:3px 10px;border:none;border-radius:3px;cursor:pointer;font-size:12px;">执行</button>
                </form>
                <form action="/api/admin/user/${u.id}/delete" method="POST" style="display:inline;">
                  <button type="submit" style="background:#e74c3c;color:#fff;padding:3px 10px;border:none;border-radius:3px;cursor:pointer;font-size:12px;margin-top:3px;">删除</button>
                </form>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="card">
      <h2 style="font-size:16px;font-weight:600;margin-bottom:12px;"><i class="fas fa-file-alt"></i> 帖子管理</h2>
      ${articles.results.map(a => `
        <div style="padding:6px 0;border-bottom:1px solid #f5f5f5;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">
          <span style="font-size:14px;">${htmlEscape(a.title)} <span style="color:#999;font-size:12px;">· ${formatTimeToChina(a.created_at)}</span></span>
          <div style="display:flex;gap:4px;">
            <form action="/api/admin/article/${a.id}/delete" method="POST" style="display:inline;">
              <button type="submit" style="background:#e74c3c;color:#fff;padding:2px 10px;border:none;border-radius:3px;cursor:pointer;font-size:12px;">删除</button>
            </form>
            <form action="/api/admin/article/${a.id}/pin" method="POST" style="display:inline;">
              <button type="submit" style="background:#8E44AD;color:#fff;padding:2px 10px;border:none;border-radius:3px;cursor:pointer;font-size:12px;">${a.is_pinned ? '取消置顶' : '置顶'}</button>
            </form>
            <form action="/api/admin/article/${a.id}/lock" method="POST" style="display:inline;">
              <button type="submit" style="background:${a.is_locked ? '#27ae60' : '#7f8c8d'};color:#fff;padding:2px 10px;border:none;border-radius:3px;cursor:pointer;font-size:12px;">${a.is_locked ? '解锁' : '锁定'}</button>
            </form>
          </div>
        </div>
      `).join('')}
    </div>

    <div class="card">
      <h2 style="font-size:16px;font-weight:600;margin-bottom:12px;"><i class="fas fa-ticket-alt"></i> 工单管理</h2>
      ${tickets.results.map(t => {
        const statusInfo = getTicketStatus(t.status);
        return `
          <div style="padding:6px 0;border-bottom:1px solid #f5f5f5;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">
            <span style="font-size:14px;">#${t.id} ${htmlEscape(t.title)} <span style="color:#999;font-size:12px;">
              <i class="fas ${statusInfo.icon}"></i> ${statusInfo.label} · ${formatTimeToChina(t.created_at)}
            </span></span>
            <div style="display:flex;gap:4px;">
              <form action="/api/admin/ticket/${t.id}/delete" method="POST" style="display:inline;">
                <button type="submit" style="background:#e74c3c;color:#fff;padding:2px 10px;border:none;border-radius:3px;cursor:pointer;font-size:12px;">删除</button>
              </form>
            </div>
          </div>
        `;
    }).join('')}
    </div>
    <div class="card">
      <h2 style="font-size:16px;font-weight:600;margin-bottom:12px;"><i class="fas fa-images"></i> 轮播图管理</h2>
      <form action="/api/admin/banner/add" method="POST" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;padding:12px;background:#f8f9fa;border-radius:6px;">
        <input type="url" name="image_url" placeholder="图片URL (16:9)" required style="flex:1;min-width:200px;padding:6px 10px;border:1px solid #ddd;border-radius:4px;font-size:13px;">
        <input type="url" name="link_url" placeholder="跳转链接 (可选)" style="flex:1;min-width:160px;padding:6px 10px;border:1px solid #ddd;border-radius:4px;font-size:13px;">
        <input type="number" name="sort_order" placeholder="排序" value="0" style="width:70px;padding:6px 10px;border:1px solid #ddd;border-radius:4px;font-size:13px;">
        <button type="submit" style="background:#8E44AD;color:#fff;padding:6px 16px;border:none;border-radius:4px;cursor:pointer;font-size:13px;"><i class="fas fa-plus"></i> 添加</button>
      </form>
      ${banners.results.length === 0 ? '<div style="color:#999;padding:12px 0;text-align:center;">暂无轮播图</div>' : ''}
      ${banners.results.map(b => `
        <div style="padding:10px 0;border-bottom:1px solid #f5f5f5;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
          <div style="display:flex;align-items:center;gap:12px;flex:1;min-width:200px;">
            <img src="${htmlEscape(b.image_url)}" style="width:80px;height:45px;object-fit:cover;border-radius:4px;background:#eee;" onerror="this.style.display='none';">
            <div style="font-size:13px;">
              <div style="color:#333;word-break:break-all;">${htmlEscape(b.image_url)}</div>
              <div style="color:#999;font-size:12px;margin-top:2px;">
                ${b.link_url ? `<i class="fas fa-link"></i> ${htmlEscape(b.link_url)}` : '<i class="fas fa-link-slash"></i> 无跳转'}
                &nbsp;·&nbsp; 排序: ${b.sort_order}
              </div>
            </div>
          </div>
          <form action="/api/admin/banner/${b.id}/delete" method="POST" style="display:inline;">
            <button type="submit" style="background:#e74c3c;color:#fff;padding:4px 12px;border:none;border-radius:4px;cursor:pointer;font-size:12px;"><i class="fas fa-trash-alt"></i> 删除</button>
          </form>
        </div>
      `).join('')}
    </div>
  `;
    return await getLayout(env, user, '后台管理', content, '', req);
}