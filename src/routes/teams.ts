import { getSessionUser } from '../utils/auth';
import { getLayout } from '../utils/layout';
import { htmlEscape, renderUsernameLink } from '../utils/html';
import type { Env } from '../env.d';

const TEAM_ROLE_LABELS: Record<string, string> = { owner: '队长', admin: '管理员', member: '成员' };
const TEAM_ANNOUNCEMENT_TITLE = '团队公告';
const TEAM_DYNAMIC_TITLE = '团队动态';

function renderRoleLabel(role: string | undefined): string {
  return TEAM_ROLE_LABELS[String(role || 'member')] || '成员';
}

export async function renderTeamList(env: Env, req: Request) {
  const user = await getSessionUser(env, req);
  const rows = await env.DB.prepare(`
    SELECT t.*, u.username AS owner_name,
           (SELECT COUNT(*) FROM team_members tm WHERE tm.team_id = t.id AND tm.status = 'approved') AS member_count
    FROM teams t
    JOIN users u ON u.id = t.owner_id
    WHERE t.status = 'active'
    ORDER BY t.created_at DESC
  `).all<any>();
  const content = `
    <div class="page-header">
      <h1><i class="fas fa-users"></i> 团队</h1>
      <p style="margin-top:4px;">查看所有团队、成员和公告，创建属于你的团队。</p>
    </div>
    <div class="card" style="margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
      <strong>团队列表</strong>
      <a href="/team/new" style="color:#8E44AD;text-decoration:none;">+ 创建团队</a>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;">
      ${(rows.results || []).map((team: any) => `
        <div class="card" style="display:flex;flex-direction:column;gap:10px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
            <div>
              <h2 style="margin:0;font-size:18px;"><a href="/team/${team.id}" style="color:#8E44AD;text-decoration:none;">${htmlEscape(team.name)}</a></h2>
              <div class="oj-muted">队长：${htmlEscape(team.owner_name || '未知')}</div>
            </div>
            <span style="padding:4px 8px;border-radius:999px;background:#f2eafa;color:#73419b;font-size:12px;font-weight:700;">${htmlEscape(team.level || '普通')}</span>
          </div>
          <p style="margin:0;color:#555;line-height:1.6;min-height:48px;">${htmlEscape(team.description || '暂无团队简介。')}</p>
          <div style="display:flex;gap:12px;flex-wrap:wrap;color:#666;font-size:13px;">
            <span>成员 ${Number(team.member_count || 0)}</span>
            <span>加入方式 ${team.join_mode === 'free' ? '自由加入' : team.join_mode === 'closed' ? '不开放加入' : '申请加入'}</span>
          </div>
        </div>
      `).join('') || '<div class="card">暂无团队，快来创建第一个团队吧。</div>'}
    </div>
  `;
  return getLayout(env, user, '团队', content, '', req);
}

export async function renderTeamNew(env: Env, req: Request) {
  const user = await getSessionUser(env, req);
  const isSuper = !!user?.admin && (user.id === 1 || String(user.admin_roles || '').includes('super'));
  const submitted = new URL(req.url).searchParams.get('submitted') === '1';
  const content = `<div class="page-header"><h1><i class="fas fa-users"></i> 创建团队</h1><p>创建专属空间，管理团队成员、公告和 OJ 比赛。</p></div>
  ${submitted ? '<div class="card team-notice team-notice-success">团队创建申请已提交，请等待 superuser 审核。</div>' : ''}
  <div class="card team-create-card"><div class="team-create-intro"><strong>${isSuper ? '你可以直接创建团队。' : '团队创建申请需要审核。'}</strong><span>${isSuper ? '创建后你将自动成为团队队长。' : '审核通过后，你将自动成为团队队长。'}</span></div>
  ${!user ? `<div class="team-notice">登录后即可提交申请。<br><a href="/login?redirect=${encodeURIComponent('/team/new')}">前往登录</a></div>` : `<form method="POST" action="/api/teams" class="team-create-form">
    <label>团队名称<input name="name" required maxlength="40" placeholder="例如：星光算法社"></label>
    <label>团队简介<textarea name="description" maxlength="500" rows="4" placeholder="介绍团队方向或招募计划"></textarea></label>
    <label>团队等级<select name="level" id="teamLevel"><option value="普通">普通团队：每月最多 3 次比赛、1 次公开赛</option><option value="高级">高级团队：比赛和公开赛不限</option></select></label>
    <label>加入方式<select name="join_mode"><option value="application">申请加入（可填写理由）</option><option value="free">自由加入</option><option value="closed">不开放加入</option></select></label>
    <label id="teamUpgradeCodeField" hidden>高级团队兑换码<input name="upgrade_code" maxlength="64" autocomplete="off"></label>
    <button type="submit">提交${isSuper ? '创建' : '审核申请'}</button></form>
    <script>(function(){var level=document.getElementById('teamLevel'),field=document.getElementById('teamUpgradeCodeField');function sync(){field.hidden=level.value!=='高级';}level.addEventListener('change',sync);sync();}());</script>`}</div>
  <style>.team-create-card{max-width:720px}.team-create-intro{display:grid;gap:5px;margin-bottom:18px;padding:14px 16px;border-left:4px solid #8E44AD;background:#faf7fd}.team-create-form{display:grid;gap:14px}.team-create-form label{display:grid;gap:7px;color:#555;font-size:13px;font-weight:600}.team-create-form input,.team-create-form textarea,.team-create-form select{box-sizing:border-box;width:100%;padding:10px;border:1px solid #d9d3df;border-radius:7px;font:inherit;font-weight:400}.team-create-form button{justify-self:start;border:0;border-radius:7px;padding:10px 18px;background:#8E44AD;color:#fff;cursor:pointer}.team-notice{padding:14px;border-radius:7px;background:#f8f9fa}.team-notice-success{margin-bottom:16px;background:#effaf3;color:#18794e}</style>`;
  return getLayout(env, user, '创建团队', content, '', req);
}

export async function renderTeam(env: Env, req: Request, path: string) {
  const id = Number(path.split('/')[2]);
  const user = await getSessionUser(env, req);
  const team = await env.DB.prepare('SELECT t.*,u.username AS owner_name FROM teams t JOIN users u ON u.id=t.owner_id WHERE t.id=? AND t.status=?').bind(id, 'active').first<any>();
  if (!team) return getLayout(env, user, '团队不存在', '<div class="card">团队不存在或已被移除。</div>', '', req);
  const member = user ? await env.DB.prepare('SELECT * FROM team_members WHERE team_id=? AND user_id=?').bind(id, user.id).first<any>() : null;
  const members = await env.DB.prepare("SELECT tm.*,u.username,u.color,u.tag FROM team_members tm JOIN users u ON u.id=tm.user_id WHERE tm.team_id=? AND tm.status='approved' ORDER BY tm.role DESC,tm.created_at").bind(id).all<any>();
  const pending = await env.DB.prepare("SELECT tm.*,u.username,u.color,u.tag FROM team_members tm JOIN users u ON u.id=tm.user_id WHERE tm.team_id=? AND tm.status='pending' ORDER BY tm.created_at DESC").bind(id).all<any>();
  const posts = await env.DB.prepare("SELECT p.*,u.username,u.color,u.tag FROM team_posts p JOIN users u ON u.id=p.author_id WHERE p.team_id=? ORDER BY p.created_at DESC LIMIT 50").bind(id).all<any>();
  const isOwner = member?.role === 'owner';
  const isAdmin = !!member && ['owner', 'admin'].includes(member.role);
  const canPost = member?.status === 'approved' && isAdmin;
  const canManage = canPost;
  const joinLabels: Record<string, string> = { application: '申请加入', free: '自由加入', closed: '不开放加入' };
  const joinUi = user && !member ? team.join_mode === 'free'
    ? `<form method="POST" action="/api/teams/${id}/join"><button>立即加入</button></form>`
    : team.join_mode === 'application'
      ? `<form method="POST" action="/api/teams/${id}/join"><label>申请理由（可选）<textarea name="reason" maxlength="300" rows="3" placeholder="简单介绍你为什么想加入"></textarea></label><button>提交加入申请</button></form>`
      : '<p>该团队暂不开放加入。</p>' : member?.status === 'pending' ? '<p>加入申请审核中。</p>' : member?.status === 'rejected' ? '<p>加入申请未通过。</p>' : '';
  const content = `
    <div class="page-header"><h1>${htmlEscape(team.name)} <small>${htmlEscape(team.level)}团队</small></h1></div>
    <div class="team-shell">
      <section class="team-hero card">
        <div class="team-hero-top">
          <div>
            <div class="team-eyebrow">团队主页</div>
            <h2 style="margin:0; font-size:28px;">${htmlEscape(team.name)}</h2>
          </div>
          <span class="team-level-badge">${htmlEscape(team.level || '普通')}</span>
        </div>
        <div class="team-meta-grid">
          <div><span>队长</span><strong>${htmlEscape(team.owner_name)}</strong></div>
          <div><span>成员</span><strong>${members.results.length}</strong></div>
          <div><span>加入方式</span><strong>${joinLabels[team.join_mode] || joinLabels.application}</strong></div>
        </div>
        <div class="team-intro">${htmlEscape(team.description || '暂无团队简介。')}</div>
        ${joinUi}
        ${isOwner || isAdmin ? `<p style="margin:0;"><a href="/team/${id}/settings" class="team-link">进入团队设置</a></p>` : ''}
      </section>

      <nav class="team-tabs" style="display:flex;gap:10px;flex-wrap:wrap;margin:16px 0;">
        <a href="#announcements" class="team-tab is-active">公告</a>
        <a href="#overview" class="team-tab">概览</a>
        <a href="#members" class="team-tab">成员</a>
        ${canManage ? '<a href="#settings" class="team-tab">设置</a>' : ''}
      </nav>

      <section id="announcements" class="card team-panel" style="margin-bottom:16px;">
        <h2>团队公告</h2>
        ${canPost ? `<form method="POST" action="/api/teams/${id}/posts" class="team-compose"><input type="hidden" name="title" value="${TEAM_ANNOUNCEMENT_TITLE}"><textarea name="content" rows="4" required placeholder="发布公告内容…"></textarea><label class="team-check"><input type="checkbox" name="announcement" checked> 设为公告</label><button type="submit">发布</button></form>` : ''}
        ${(posts.results || []).filter((post: any) => post.is_announcement === 1 || post.title === TEAM_ANNOUNCEMENT_TITLE).slice(0, 5).map((post: any) => `<article class="team-post"><h3>${htmlEscape(post.title || TEAM_ANNOUNCEMENT_TITLE)}</h3><div class="markdown-content">${htmlEscape(post.content)}</div><small>${renderUsernameLink(post.username, post.color, post.tag, post.author_id)} · ${htmlEscape(post.created_at)}</small></article>`).join('') || '<p>暂无公告。</p>'}
      </section>

      <section id="overview" class="card team-panel" style="margin-bottom:16px; display:none;">
        <h2>团队概览</h2>
        <div class="team-overview-grid">
          <div class="team-overview-card"><span>简介</span><p>${htmlEscape(team.description || '暂无团队简介。')}</p></div>
          <div class="team-overview-card"><span>定位</span><p>${htmlEscape(team.level || '普通')}团队 · ${joinLabels[team.join_mode] || joinLabels.application}</p></div>
        </div>
      </section>

      <section id="members" class="card team-panel" style="margin-bottom:16px; display:none;">
        <h2>成员 (${members.results.length})</h2>
        ${members.results.map((m: any) => `<div class="team-member-row"><div>${renderUsernameLink(m.username,m.color,m.tag,m.user_id)}</div><span class="team-role-badge">${renderRoleLabel(m.role)}</span></div>`).join('') || '<p>暂无成员。</p>'}
        ${pending.results.length ? `<div style="margin-top:16px;"><h3>待审核</h3>${pending.results.map((m: any) => `<div class="team-member-row"><div>${renderUsernameLink(m.username,m.color,m.tag,m.user_id)}${m.reason ? `<div style="font-size:12px;color:#666;">${htmlEscape(m.reason)}</div>` : ''}</div><div style="display:flex;gap:6px;flex-wrap:wrap;"><form method="POST" action="/api/teams/${id}/members/${m.user_id}/approve" style="display:inline"><button type="submit">通过</button></form><form method="POST" action="/api/teams/${id}/members/${m.user_id}/reject" style="display:inline"><button type="submit">拒绝</button></form></div></div>`).join('')}</div>` : ''}
      </section>
      ${canManage ? `<section id="settings" class="card team-panel" style="display:none;"><h2>团队设置</h2><p><a href="/team/${id}/settings" class="team-link">管理成员、审核申请和公告</a></p></section>` : ''}
    </div>
  `;
  return getLayout(env, user, team.name, content + `
    <style>
      .team-shell { display:grid; gap:16px; }
      .team-hero { padding:22px; background:linear-gradient(135deg,#faf7ff,#f5f7ff); }
      .team-hero-top { display:flex; justify-content:space-between; align-items:flex-start; gap:10px; }
      .team-eyebrow { font-size:12px; color:#8E44AD; letter-spacing:0.08em; text-transform:uppercase; font-weight:700; margin-bottom:8px; }
      .team-level-badge { padding:5px 10px; border-radius:999px; background:#efe4ff; color:#6c3bbf; font-weight:700; font-size:12px; }
      .team-meta-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(120px,1fr)); gap:12px; margin-top:18px; }
      .team-meta-grid div { padding:10px 12px; border:1px solid #ece7f9; border-radius:10px; background:rgba(255,255,255,0.5); display:flex; flex-direction:column; gap:6px; }
      .team-meta-grid span { font-size:12px; color:#666; }
      .team-meta-grid strong { font-size:15px; }
      .team-intro { margin-top:16px; padding:14px 16px; border-radius:12px; background:rgba(255,255,255,0.7); border:1px solid #efe7ff; color:#484a57; line-height:1.7; }
      .team-link { color:#8E44AD; text-decoration:none; }
      .team-tabs a { color:#8E44AD; text-decoration:none; padding:8px 14px; border-radius:999px; background:#f7f0ff; font-size:13px; font-weight:600; }
      .team-tabs a.is-active, .team-tabs a:hover { background:#eee6ff; box-shadow:inset 0 0 0 1px rgba(142,68,173,0.15); }
      .team-panel { padding:18px 20px; }
      .team-compose { display:grid; gap:10px; margin-top:12px; }
      .team-compose textarea { width:100%; box-sizing:border-box; resize:vertical; padding:10px 12px; border:1px solid #ddd; border-radius:10px; }
      .team-check { display:flex; align-items:center; gap:8px; color:#555; font-size:13px; }
      .team-compose button, .team-member-row button, .team-post button { background:#8E44AD; color:white; border:none; border-radius:8px; padding:8px 12px; cursor:pointer; }
      .team-member-row { display:flex; justify-content:space-between; align-items:center; gap:12px; padding:10px 0; border-bottom:1px solid #eee; }
      .team-role-badge { padding:4px 10px; border-radius:999px; background:#f2eafa; color:#73419b; font-size:12px; font-weight:600; }
      .team-post { padding:12px 0; border-bottom:1px solid #eee; }
      .team-post h3 { margin:0 0 8px; font-size:16px; }
      .team-overview-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:12px; }
      .team-overview-card { padding:12px; border-radius:10px; background:#faf9ff; border:1px solid #efe8ff; }
      .team-overview-card span { font-size:12px; color:#7a6a9c; text-transform:uppercase; letter-spacing:0.08em; }
      .team-overview-card p { margin:8px 0 0; line-height:1.6; }
      @media (max-width:640px){ .team-hero-top { flex-direction:column; } .team-member-row { flex-direction:column; align-items:flex-start; } }
    </style>
    <script>
      (function(){
        var active = location.hash && document.querySelector(location.hash);
        if (!active) {
          location.hash = '#announcements';
          active = document.querySelector('#announcements');
        }
        document.querySelectorAll('.team-tab').forEach(function(tab){
          tab.classList.toggle('is-active', tab.getAttribute('href') === location.hash || (location.hash === '' && tab.getAttribute('href') === '#announcements'));
        });
        document.querySelectorAll('.team-panel').forEach(function(panel){
          panel.style.display = panel.id === (location.hash || '#announcements').replace('#', '') ? 'block' : 'none';
        });
        document.querySelectorAll('.team-tab').forEach(function(tab){
          tab.addEventListener('click', function(){
            var nextHash = tab.getAttribute('href');
            setTimeout(function(){
              document.querySelectorAll('.team-panel').forEach(function(panel){
                panel.style.display = panel.id === nextHash.replace('#', '') ? 'block' : 'none';
              });
              document.querySelectorAll('.team-tab').forEach(function(item){
                item.classList.toggle('is-active', item.getAttribute('href') === nextHash);
              });
            }, 0);
          });
        });
      })();
    </script>`, '', req);
}

export async function renderTeamSettings(env: Env, req: Request, path: string) {
  const id = Number(path.split('/')[2]);
  const user = await getSessionUser(env, req);
  const team = await env.DB.prepare('SELECT * FROM teams WHERE id=? AND status=?').bind(id, 'active').first<any>();
  if (!team) return getLayout(env, user, '团队不存在', '<div class="card">团队不存在或已被移除。</div>', '', req);
  if (!user) return getLayout(env, user, '团队设置', '<div class="card">请先登录。</div>', '', req);
  const member = await env.DB.prepare('SELECT * FROM team_members WHERE team_id=? AND user_id=?').bind(id, user.id).first<any>();
  const isOwner = member?.role === 'owner';
  const isAdmin = !!member && ['owner', 'admin'].includes(member.role);
  if (!isOwner && !isAdmin) return getLayout(env, user, '团队设置', '<div class="card">只有团队管理员可以访问团队设置。</div>', '', req);
  const pending = await env.DB.prepare("SELECT tm.*,u.username,u.color,u.tag FROM team_members tm JOIN users u ON u.id=tm.user_id WHERE tm.team_id=? AND tm.status='pending' ORDER BY tm.created_at DESC").bind(id).all<any>();
  const members = await env.DB.prepare("SELECT tm.*,u.username,u.color,u.tag FROM team_members tm JOIN users u ON u.id=tm.user_id WHERE tm.team_id=? AND tm.status='approved' ORDER BY tm.role DESC,tm.created_at").bind(id).all<any>();
  const announcement = await env.DB.prepare("SELECT * FROM team_posts WHERE team_id=? AND is_announcement=1 ORDER BY created_at DESC LIMIT 1").bind(id).first<any>();
  const content = `
    <div class="page-header"><h1><i class="fas fa-sliders-h"></i> 团队设置</h1><p style="margin-top:4px;">管理成员、审批加入申请，并更新团队公告。</p></div>
    <div class="card" style="margin-bottom:16px;">
      <h2>团队公告</h2>
      <form method="POST" action="/api/teams/${id}/announcement">
        <textarea name="content" rows="6" style="width:100%;box-sizing:border-box;resize:vertical;padding:10px;border:1px solid #ddd;border-radius:6px;">${htmlEscape(announcement?.content || '')}</textarea>
        <div style="margin-top:10px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
          <span class="oj-muted">公告标题固定为“团队公告”</span>
          <button type="submit">保存公告</button>
        </div>
      </form>
    </div>
    <div class="card" style="margin-bottom:16px;">
      <h2>待审核成员</h2>
      ${pending.results.length ? pending.results.map((m: any) => `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #eee;flex-wrap:wrap;">
          <div>
            ${renderUsernameLink(m.username,m.color,m.tag,m.user_id)}
            ${m.reason ? `<div style="font-size:12px;color:#666;margin-top:4px;">申请理由：${htmlEscape(m.reason)}</div>` : ''}
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <form method="POST" action="/api/teams/${id}/members/${m.user_id}/approve" style="display:inline"><button type="submit">通过</button></form>
            <form method="POST" action="/api/teams/${id}/members/${m.user_id}/reject" style="display:inline"><button type="submit">拒绝</button></form>
          </div>
        </div>
      `).join('') : '<p class="oj-muted">暂无待审核成员。</p>'}
    </div>
    <div class="card">
      <h2>成员管理</h2>
      ${members.results.map((m: any) => `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #eee;flex-wrap:wrap;">
          <div>${renderUsernameLink(m.username,m.color,m.tag,m.user_id)}</div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span style="padding:3px 8px;border-radius:999px;background:#f2eafa;color:#73419b;font-size:12px;">${renderRoleLabel(m.role)}</span>
            ${isOwner && m.user_id !== user.id ? `
              <form method="POST" action="/api/teams/${id}/members/${m.user_id}/role" style="display:flex;align-items:center;gap:6px;">
                <select name="role" style="padding:6px 8px;border:1px solid #ddd;border-radius:4px;">
                  <option value="member" ${m.role === 'member' ? 'selected' : ''}>成员</option>
                  <option value="admin" ${m.role === 'admin' ? 'selected' : ''}>管理员</option>
                </select>
                <button type="submit">保存</button>
              </form>
            ` : ''}
          </div>
        </div>
      `).join('') || '<p class="oj-muted">暂无成员。</p>'}
    </div>
  `;
  return getLayout(env, user, '团队设置', content, '', req);
}

export async function renderTeamRequests(env: Env, req: Request) {
  const user = await getSessionUser(env, req);
  if (!user || user.id !== 1) return getLayout(env, user, '团队审核', '<div class="card">仅 superuser 可访问团队审核队列。</div>', '', req);
  const rows = await env.DB.prepare("SELECT r.*,u.username FROM team_creation_requests r JOIN users u ON u.id=r.requester_id ORDER BY r.created_at DESC").all<any>();
  const content = `<div class="page-header"><h1>团队创建审核</h1></div><div class="card">${(rows.results || []).map((row: any) => `<div style="padding:12px 0;border-bottom:1px solid #eee"><strong>${htmlEscape(row.name)}</strong><p>${htmlEscape(row.description || '')}</p><small>申请人：${htmlEscape(row.username)} · ${htmlEscape(row.level)} · ${htmlEscape(row.join_mode || 'application')} · ${htmlEscape(row.status)}</small>${row.status === 'pending' ? `<form method="POST" action="/api/teams/requests/${row.id}/approve" style="display:inline;margin-left:12px"><button>通过</button></form><form method="POST" action="/api/teams/requests/${row.id}/reject" style="display:inline;margin-left:6px"><button>拒绝</button></form>` : ''}</div>`).join('') || '<p>暂无申请。</p>'}</div>`;
  return getLayout(env, user, '团队审核', content, '', req);
}
