import { getSessionUser } from '../utils/auth';
import { getLayout } from '../utils/layout';
import { renderUsernameLink, htmlEscape } from '../utils/html';
import { formatTimeToChina } from '../utils/time';
import { getUserColor, getTicketStatus } from '../utils/constants';
import type { Env } from '../env.d';

export async function renderBackend(env: Env, req: Request) {
    const user = await getSessionUser(env, req);
    if (!user || !user.admin) return '无权限';
    const db = env.DB;

    const users = await db.prepare('SELECT * FROM users ORDER BY id').all();
    const articles = await db.prepare('SELECT * FROM articles ORDER BY id DESC').all();
    const tickets = await db.prepare('SELECT * FROM tickets ORDER BY id DESC').all();
    const banners = await db.prepare('SELECT * FROM banners ORDER BY sort_order ASC, id ASC').all();

    const content = `
  <style>
    /* 表格滚动 */
    .table-wrap { overflow-x: auto; }
    .admin-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      background: #fff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .admin-table th {
      background: #f8f6fa;
      color: #4a3f5e;
      font-weight: 600;
      padding: 10px 12px;
      text-align: left;
      border-bottom: 2px solid #e8e3ed;
    }
    .admin-table td {
      padding: 10px 12px;
      border-bottom: 1px solid #f0edf3;
      vertical-align: middle;
    }
    .admin-table tr:last-child td { border-bottom: none; }
    .admin-table tr:hover td { background: #faf8fc; }

    .user-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      align-items: center;
    }
    .user-actions select, .user-actions input {
      font-size: 12px;
      padding: 4px 6px;
      border-radius: 4px;
      border: 1px solid #ddd;
      background: #fff;
      transition: 0.15s;
    }
    .user-actions select:focus, .user-actions input:focus {
      border-color: #8E44AD;
      outline: none;
      box-shadow: 0 0 0 2px rgba(142,68,173,0.15);
    }
    .field-group {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      align-items: center;
    }
    .field-group.hidden { display: none; }

    /* 按钮通用样式 */
    .btn-sm {
      padding: 4px 12px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 500;
      font-size: 13px;
      transition: 0.15s;
      color: #fff; /* 默认白色文字 */
    }
    .btn-sm:hover { opacity: 0.85; }
    .btn-primary { background: #8E44AD; color: #fff; }
    .btn-danger { background: #e74c3c; color: #fff; }
    .btn-success { background: #27ae60; color: #fff; }
    .btn-warning { background: #f39c12; color: #fff; }
    .btn-outline {
      background: transparent;
      color: #555;
      border: 1px solid #ddd;
    }

    /* 卡片 */
    .card {
      background: #fff;
      border-radius: 8px;
      padding: 16px 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
      margin-bottom: 16px;
    }
    .card:last-child { margin-bottom: 0; }
    .section-title {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .section-title i { color: #8E44AD; }

    .article-item, .ticket-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 0;
      border-bottom: 1px solid #f0edf3;
      flex-wrap: wrap;
      gap: 6px;
    }
    .article-item:last-child, .ticket-item:last-child { border-bottom: none; }
    .article-item .title, .ticket-item .title {
      font-size: 14px;
      color: #333;
    }
    .article-item .meta, .ticket-item .meta {
      color: #999;
      font-size: 12px;
    }
    .action-group {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
    }

    /* 轮播图 */
    .banner-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 0;
      border-bottom: 1px solid #f0edf3;
    }
    .banner-item:last-child { border-bottom: none; }
    .banner-thumb {
      width: 80px;
      height: 45px;
      object-fit: cover;
      border-radius: 4px;
      background: #eee;
      flex-shrink: 0;
    }
    .banner-info {
      flex: 1;
      min-width: 0;
      font-size: 13px;
    }
    .banner-info .url { word-break: break-all; color: #333; }
    .banner-info .meta { color: #999; font-size: 12px; margin-top: 2px; }

    .add-banner-form {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      background: #f8f6fa;
      padding: 14px 16px;
      border-radius: 8px;
      margin-bottom: 16px;
      align-items: center;
    }
    .add-banner-form input {
      flex: 1;
      min-width: 150px;
      padding: 6px 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 13px;
    }
    .add-banner-form input:focus {
      border-color: #8E44AD;
      outline: none;
    }
    .add-banner-form button {
      background: #8E44AD;
      color: #fff;
      border: none;
      padding: 6px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      white-space: nowrap;
    }
    .add-banner-form button:hover { background: #7d3c98; }
  </style>

  <div class="page-header"><h1><i class="fas fa-cog"></i> 后台管理</h1></div>

  <!-- 用户管理 -->
  <div class="card">
    <div class="section-title"><i class="fas fa-users"></i> 用户管理</div>
    <div class="table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>用户名</th>
            <th>权限</th>
            <th>颜色</th>
            <th>牌子</th>
            <th>禁言</th>
            <th>最近登录</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          ${users.results.map((u: any) => `
            <tr>
              <td>${u.id}</td>
              <td>${renderUsernameLink(u.username, u.color, u.tag, u.id)}</td>
              <td style="font-size:12px;">use:${u.use} speak:${u.speak} admin:${u.admin}</td>
              <td>
                <span style="display:inline-block;width:12px;height:12px;border-radius:2px;background:${getUserColor(u.color)};vertical-align:middle;margin-right:4px;"></span>
                ${({ purple: '紫名', red: '红名', orange: '橙名', green: '绿名', blue: '蓝名', gray: '灰名' })[u.color] || u.color}
              </td>
              <td>${u.tag || '无'}</td>
              <td><span style="color:${u.violation_count > 0 ? '#e74c3c' : '#999'};font-weight:600;">${u.violation_count || 0}</span></td>
              <td style="font-size:12px;color:#666;line-height:1.5;">
                ${u.last_ip ? `<div><i class="fas fa-network-wired" style="color:#8E44AD;"></i> ${htmlEscape(u.last_ip)}</div>` : '<div style="color:#bbb;">无记录</div>'}
                ${u.last_login_at ? `<div style="color:#999;">${formatTimeToChina(u.last_login_at)}</div>` : ''}
              </td>
              <td>
                <form action="/api/admin/user/${u.id}" method="POST" class="user-actions">
                  <!-- mode 选择 -->
                  <select name="mode" onchange="toggleFields(this)" style="width:auto;">
                    <option value="profile" selected>更改资料</option>
                    <option value="permission">更改权限</option>
                  </select>

                  <!-- 资料字段（默认显示） -->
                  <span class="field-group profile-fields">
                    <select name="color" style="width:auto;">
                      <option value="purple" ${u.color === 'purple' ? 'selected' : ''}>紫名</option>
                      <option value="red" ${u.color === 'red' ? 'selected' : ''}>红名</option>
                      <option value="orange" ${u.color === 'orange' ? 'selected' : ''}>橙名</option>
                      <option value="green" ${u.color === 'green' ? 'selected' : ''}>绿名</option>
                      <option value="blue" ${u.color === 'blue' ? 'selected' : ''}>蓝名</option>
                      <option value="gray" ${u.color === 'gray' ? 'selected' : ''}>灰名</option>
                    </select>
                    <input type="text" name="tag" placeholder="牌子（可选）" value="${u.tag || ''}" style="width:70px;">
                  </span>

                  <!-- 权限字段（默认隐藏） -->
                  <span class="field-group permission-fields hidden">
                    <select name="permission" style="width:auto;">
                      <option value="">选择权限</option>
                      <option value="use">进入主站</option>
                      <option value="speak">自由发言</option>
                      <option value="admin">管理员</option>
                    </select>
                    <select name="action" style="width:auto;">
                      <option value="">授予/撤销</option>
                      <option value="grant">授予</option>
                      <option value="revoke">撤销</option>
                    </select>
                    <input type="text" name="reason" placeholder="原因（可选）" style="width:80px;">
                  </span>

                  <!-- 执行按钮 -->
                  <button type="submit" class="btn-sm btn-primary" style="font-size:13px; color:#fff;">执行</button>
                </form>
                <!-- 删除按钮 -->
                <form action="/api/admin/user/${u.id}/delete" method="POST" style="display:inline;margin-top:4px;">
                  <button type="submit" class="btn-sm btn-danger" style="font-size:13px; color:#fff;">删除</button>
                </form>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <!-- 帖子管理 -->
  <div class="card">
    <div class="section-title"><i class="fas fa-file-alt"></i> 帖子管理</div>
    ${articles.results.map((a: any) => `
      <div class="article-item">
        <div>
          <span class="title">${htmlEscape(a.title)}</span>
          <span class="meta">· ${formatTimeToChina(a.created_at)}</span>
        </div>
        <div class="action-group">
          <form action="/api/admin/article/${a.id}/delete" method="POST" style="display:inline;">
            <button type="submit" class="btn-sm btn-danger">删除</button>
          </form>
          <form action="/api/admin/article/${a.id}/pin" method="POST" style="display:inline;">
            <button type="submit" class="btn-sm ${a.is_pinned ? 'btn-outline' : 'btn-primary'}">${a.is_pinned ? '取消置顶' : '置顶'}</button>
          </form>
          <form action="/api/admin/article/${a.id}/lock" method="POST" style="display:inline;">
            <button type="submit" class="btn-sm ${a.is_locked ? 'btn-success' : 'btn-warning'}">${a.is_locked ? '解锁' : '锁定'}</button>
          </form>
        </div>
      </div>
    `).join('')}
  </div>

  <!-- 工单管理 -->
  <div class="card">
    <div class="section-title"><i class="fas fa-ticket-alt"></i> 工单管理</div>
    ${tickets.results.map((t: any) => {
        const statusInfo = getTicketStatus(t.status);
        return `
        <div class="ticket-item">
          <div>
            <span class="title">#${t.id} ${htmlEscape(t.title)}</span>
            <span class="meta">
              <i class="fas ${statusInfo.icon}"></i> ${statusInfo.label} · ${formatTimeToChina(t.created_at)}
            </span>
          </div>
          <div class="action-group">
            <form action="/api/admin/ticket/${t.id}/delete" method="POST" style="display:inline;">
              <button type="submit" class="btn-sm btn-danger">删除</button>
            </form>
          </div>
        </div>
      `;
    }).join('')}
  </div>

  <!-- 轮播图管理 -->
  <div class="card">
    <div class="section-title"><i class="fas fa-images"></i> 轮播图管理</div>
    <form action="/api/admin/banner/add" method="POST" class="add-banner-form">
      <input type="url" name="image_url" placeholder="图片URL（16:9）" required>
      <input type="url" name="link_url" placeholder="跳转链接（可选）">
      <input type="number" name="sort_order" placeholder="排序" value="0" style="width:80px;">
      <button type="submit"><i class="fas fa-plus"></i> 添加</button>
    </form>
    ${banners.results.length === 0 ? '<div style="color:#999;padding:12px 0;text-align:center;">暂无轮播图</div>' : ''}
    ${banners.results.map((b: any) => `
      <div class="banner-item">
        <img src="${htmlEscape(b.image_url)}" class="banner-thumb" onerror="this.style.display='none'">
        <div class="banner-info">
          <div class="url">${htmlEscape(b.image_url)}</div>
          <div class="meta">
            ${b.link_url ? `<i class="fas fa-link"></i> ${htmlEscape(b.link_url)}` : '<i class="fas fa-link-slash"></i> 无跳转'}
            &nbsp;·&nbsp; 排序: ${b.sort_order}
          </div>
        </div>
        <form action="/api/admin/banner/${b.id}/delete" method="POST">
          <button type="submit" class="btn-sm btn-danger"><i class="fas fa-trash-alt"></i> 删除</button>
        </form>
      </div>
    `).join('')}
  </div>

  <script>
    function toggleFields(select) {
      const row = select.closest('tr');
      const profileGroup = row.querySelector('.profile-fields');
      const permissionGroup = row.querySelector('.permission-fields');
      if (select.value === 'profile') {
        profileGroup.classList.remove('hidden');
        permissionGroup.classList.add('hidden');
      } else {
        profileGroup.classList.add('hidden');
        permissionGroup.classList.remove('hidden');
      }
    }
  </script>
  `;

    return await getLayout(env, user, '后台管理', content);
}