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
    <nav class="team-tabs" style="display:flex;gap:10px;flex-wrap:wrap;margin:0 0 16px;">
      <a href="#overview" class="team-tab">概览</a>
      <a href="#announcements" class="team-tab">公告</a>
      <a href="#members" class="team-tab">成员</a>
      ${canManage ? '<a href="#settings" class="team-tab">设置</a>' : ''}
    </nav>
    <section id="overview" class="card" style="margin-bottom:16px;">
      <p class="markdown-content">${htmlEscape(team.description || '暂无团队简介。')}</p>
      <p>队长：${htmlEscape(team.owner_name)} · 加入方式：${joinLabels[team.join_mode] || joinLabels.application}</p>
      ${joinUi}
      ${isOwner || isAdmin ? `<p><a href="/team/${id}/settings" style="color:#8E44AD;text-decoration:none;">进入团队设置</a></p>` : ''}
    </section>
    <section id="announcements" class="card" style="margin-bottom:16px;">
      <h2>团队公告</h2>
      ${canPost ? `<form method="POST" action="/api/teams/${id}/posts"><input type="hidden" name="title" value="${TEAM_ANNOUNCEMENT_TITLE}"><textarea name="content" rows="4" required placeholder="发布公告内容…"></textarea><label style="display:flex;align-items:center;gap:8px;margin-top:8px;"><input type="checkbox" name="announcement" checked> 设为公告</label><button type="submit" style="margin-top:10px;">发布</button></form>` : ''}
      ${(posts.results || []).filter((post: any) => post.is_announcement === 1 || post.title === TEAM_ANNOUNCEMENT_TITLE).slice(0, 5).map((post: any) => `<article style="padding:12px 0;border-bottom:1px solid #eee;"><h3>${htmlEscape(post.title || TEAM_ANNOUNCEMENT_TITLE)}</h3><div class="markdown-content">${htmlEscape(post.content)}</div><small>${renderUsernameLink(post.username,post.color,post.tag,post.author_id)} · ${htmlEscape(post.created_at)}</small></article>`).join('') || '<p>暂无公告。</p>'}
    </section>
    <section id="members" class="card" style="margin-bottom:16px;">
      <h2>成员 (${members.results.length})</h2>
      ${members.results.map((m: any) => `<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid #eee;"><div>${renderUsernameLink(m.username,m.color,m.tag,m.user_id)}</div><span style="padding:3px 8px;border-radius:999px;background:#f2eafa;color:#73419b;font-size:12px;">${renderRoleLabel(m.role)}</span></div>`).join('') || '<p>暂无成员。</p>'}
      ${pending.results.length ? `<div style="margin-top:16px;"><h3>待审核</h3>${pending.results.map((m: any) => `<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid #eee;"><div>${renderUsernameLink(m.username,m.color,m.tag,m.user_id)}${m.reason ? `<div style="font-size:12px;color:#666;">${htmlEscape(m.reason)}</div>` : ''}</div><div style="display:flex;gap:6px;flex-wrap:wrap;"><form method="POST" action="/api/teams/${id}/members/${m.user_id}/approve" style="display:inline"><button type="submit">通过</button></form><form method="POST" action="/api/teams/${id}/members/${m.user_id}/reject" style="display:inline"><button type="submit">拒绝</button></form></div></div>`).join('')}</div>` : ''}
    </section>
    ${canManage ? `<section id="settings" class="card"><h2>团队设置</h2><p><a href="/team/${id}/settings" style="color:#8E44AD;text-decoration:none;">管理成员、审核申请和公告</a></p></section>` : ''}
  `;
  return getLayout(env, user, team.name, content + `<style>.team-tabs a{color:#8E44AD;text-decoration:none;padding:7px 12px;border-radius:999px;background:#f7f0ff}.team-tabs a:hover{background:#eee6ff}.team-tab{font-size:13px;font-weight:600}</style>`, '', req);
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
