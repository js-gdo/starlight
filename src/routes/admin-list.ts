import { getSessionUser } from '../utils/auth';
import { getLayout } from '../utils/layout';
import { htmlEscape, renderAvatar, renderUsernameLink } from '../utils/html';
import { ADMIN_ROLE_KEYS, ADMIN_ROLE_LABELS, parseAdminRoles } from '../utils/adminRoles';
import type { Env } from '../env.d';

export async function renderAdminList(env: Env, req: Request) {
    const user = await getSessionUser(env, req);
    const rows = await env.DB.prepare(
        `SELECT id, username, color, tag, avatar_url, bio, admin_roles
         FROM users WHERE admin = 1 ORDER BY id ASC`
    ).all<any>();
    const admins = rows.results || [];
    const roleOptions = ADMIN_ROLE_KEYS.map(role => `
        <label style="display:inline-flex;align-items:center;gap:5px;font-size:12px;color:#555;">
            <input type="checkbox" name="role" value="${role}"> ${ADMIN_ROLE_LABELS[role]}
        </label>
    `).join('');

    const content = `
      <style>
        .admin-list-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:14px; }
        .admin-list-card { background:#fff; border:1px solid #eee; border-radius:10px; padding:16px; }
        .admin-list-head { display:flex; align-items:center; gap:10px; }
        .admin-role-pill { display:inline-block; padding:4px 8px; border-radius:999px; background:#f3e8ff; color:#6b21a8; font-size:11px; }
        .admin-role-form { margin-top:14px; padding-top:12px; border-top:1px solid #eee; }
        .admin-role-form select, .admin-role-form input[type=text] { width:100%; box-sizing:border-box; padding:8px 10px; border:1px solid #ddd; border-radius:5px; }
        .admin-role-options { display:flex; flex-wrap:wrap; gap:8px; margin:8px 0; }
        .admin-role-actions { display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; }
        .admin-role-actions button { border:0; border-radius:5px; padding:8px 12px; background:#8E44AD; color:#fff; cursor:pointer; }
        .admin-warning { color:#9a6700; background:#fff8dc; border:1px solid #f0d98c; border-radius:6px; padding:10px; font-size:12px; margin-bottom:14px; }
      </style>
      <div class="page-header"><h1><i class="fas fa-user-shield"></i> 管理员列表</h1></div>
      <div class="card" style="margin-bottom:16px;">
        <div style="color:#666;font-size:13px;">本站管理员可以身兼数职。管理员分类会显示在个人主页，UID 1 的 superuser 负责分配分类。</div>
      </div>
      ${admins.length ? `<div class="admin-list-grid">${admins.map((admin: any) => {
          const roles = parseAdminRoles(admin.admin_roles);
          return `<div class="admin-list-card">
            <div class="admin-list-head">${renderAvatar(admin, 42)}<div><div>${renderUsernameLink(admin.username, admin.color, admin.tag, admin.id)}</div><div style="font-size:11px;color:#999;">UID: ${admin.id}</div></div></div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:12px;">${roles.map(role => `<span class="admin-role-pill">${ADMIN_ROLE_LABELS[role]}</span>`).join('')}</div>
            ${admin.bio ? `<div style="margin-top:10px;color:#777;font-size:12px;">${htmlEscape(admin.bio)}</div>` : ''}
            ${user?.id === 1 ? `<form class="admin-role-form" action="/api/admin/roles" method="POST">
              <input type="hidden" name="user_id" value="${admin.id}">
              <div style="font-size:12px;font-weight:600;color:#444;">为该管理员设置分类</div>
              <div class="admin-role-options">${ADMIN_ROLE_KEYS.map(role => `<label style="display:inline-flex;align-items:center;gap:5px;font-size:12px;color:#555;"><input type="checkbox" name="role" value="${role}" ${roles.includes(role) ? 'checked' : ''}> ${ADMIN_ROLE_LABELS[role]}</label>`).join('')}</div>
              <input type="text" name="reason" required maxlength="500" placeholder="填写修改理由">
              <button type="submit" style="margin-top:8px;">保存该管理员分类</button>
            </form>` : ''}
          </div>`;
      }).join('')}</div>` : '<div class="card" style="color:#999;text-align:center;">暂无管理员</div>'}
      ${user?.id === 1 && admins.length > 0 ? `<div class="card" style="margin-top:16px;">
        <h3 style="font-size:15px;margin-bottom:10px;"><i class="fas fa-layer-group"></i> 批量修改管理员分类</h3>
        <div class="admin-warning">superuser 批量修改必须填写理由；可多选管理员，也可以身兼多个分类。</div>
        <form class="admin-role-form" action="/api/admin/roles" method="POST" style="border-top:0;padding-top:0;">
          <div style="display:grid;gap:8px;">
            ${admins.map((admin: any) => `<label style="display:flex;align-items:center;gap:8px;font-size:13px;"><input type="checkbox" name="user_id" value="${admin.id}"> ${htmlEscape(String(admin.username))}（UID ${admin.id}）</label>`).join('')}
          </div>
          <div class="admin-role-options">${roleOptions}</div>
          <input type="text" name="reason" required maxlength="500" placeholder="必须填写批量修改理由">
          <button type="submit" style="margin-top:10px;">批量保存分类</button>
        </form>
      </div>` : ''}
    `;

    return await getLayout(env, user, '管理员列表', content, '', req);
}
