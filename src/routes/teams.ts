import { getSessionUser } from '../utils/auth';
import { getLayout } from '../utils/layout';
import { htmlEscape, renderUsernameLink } from '../utils/html';
import type { Env } from '../env.d';

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
  const posts = await env.DB.prepare("SELECT p.*,u.username,u.color,u.tag FROM team_posts p JOIN users u ON u.id=p.author_id WHERE p.team_id=? ORDER BY p.created_at DESC LIMIT 50").bind(id).all<any>();
  const canPost = member?.status === 'approved' && ['owner', 'admin'].includes(member.role);
  const canManage = canPost;
  const joinLabels: Record<string, string> = { application: '申请加入', free: '自由加入', closed: '不开放加入' };
  const joinUi = user && !member ? team.join_mode === 'free'
    ? `<form method="POST" action="/api/teams/${id}/join"><button>立即加入</button></form>`
    : team.join_mode === 'application'
      ? `<form method="POST" action="/api/teams/${id}/join"><label>申请理由（可选）<textarea name="reason" maxlength="300" rows="3" placeholder="简单介绍你为什么想加入"></textarea></label><button>提交加入申请</button></form>`
      : '<p>该团队暂不开放加入。</p>' : member?.status === 'pending' ? '<p>加入申请审核中。</p>' : member?.status === 'rejected' ? '<p>加入申请未通过。</p>' : '';
  const content = `<div class="page-header"><h1>${htmlEscape(team.name)} <small>${htmlEscape(team.level)}团队</small></h1></div>
  <div class="card"><p class="markdown-content">${htmlEscape(team.description || '暂无团队简介。')}</p><p>队长：${htmlEscape(team.owner_name)} · 加入方式：${joinLabels[team.join_mode] || joinLabels.application}</p>${joinUi}</div>
  <div class="card"><h2>团队公告与动态</h2>${canPost ? `<form method="POST" action="/api/teams/${id}/posts"><input name="title" placeholder="标题" required><textarea name="content" required></textarea><label><input type="checkbox" name="announcement"> 公告</label><button>发布</button></form>` : ''}${(posts.results || []).map((post: any) => `<article><h3>${post.is_announcement ? '📢 ' : ''}${htmlEscape(post.title)}</h3><div class="markdown-content">${htmlEscape(post.content)}</div><small>${renderUsernameLink(post.username,post.color,post.tag,post.author_id)} · ${htmlEscape(post.created_at)}</small></article>`).join('') || '<p>暂无内容。</p>'}</div>
  <div class="card"><h2>成员 (${members.results.length})</h2>${members.results.map((m: any) => `<p>${renderUsernameLink(m.username,m.color,m.tag,m.user_id)} <small>${htmlEscape(m.role)}</small></p>`).join('')}</div>
  ${canManage ? `<div class="card"><h2>团队比赛申请</h2><form method="POST" action="/api/teams/${id}/competitions"><label>OJ 比赛编号<input name="competition_id" required placeholder="已创建的比赛 ID"></label><label><input type="checkbox" name="is_public">申请转为公开赛</label><button>提交申请</button></form></div>` : ''}`;
  return getLayout(env, user, team.name, content, '', req);
}

export async function renderTeamRequests(env: Env, req: Request) {
  const user = await getSessionUser(env, req);
  if (!user || user.id !== 1) return getLayout(env, user, '团队审核', '<div class="card">仅 superuser 可访问团队审核队列。</div>', '', req);
  const rows = await env.DB.prepare("SELECT r.*,u.username FROM team_creation_requests r JOIN users u ON u.id=r.requester_id ORDER BY r.created_at DESC").all<any>();
  const content = `<div class="page-header"><h1>团队创建审核</h1></div><div class="card">${(rows.results || []).map((row: any) => `<div style="padding:12px 0;border-bottom:1px solid #eee"><strong>${htmlEscape(row.name)}</strong><p>${htmlEscape(row.description || '')}</p><small>申请人：${htmlEscape(row.username)} · ${htmlEscape(row.level)} · ${htmlEscape(row.join_mode || 'application')} · ${htmlEscape(row.status)}</small>${row.status === 'pending' ? `<form method="POST" action="/api/teams/requests/${row.id}/approve" style="display:inline;margin-left:12px"><button>通过</button></form><form method="POST" action="/api/teams/requests/${row.id}/reject" style="display:inline;margin-left:6px"><button>拒绝</button></form>` : ''}</div>`).join('') || '<p>暂无申请。</p>'}</div>`;
  return getLayout(env, user, '团队审核', content, '', req);
}
