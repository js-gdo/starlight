import { getSessionUser } from '../utils/auth';
import { getLayout } from '../utils/layout';
import { htmlEscape, renderUsernameLink } from '../utils/html';
import type { Env } from '../env.d';

export async function renderTeamNew(env: Env, req: Request) {
  const user = await getSessionUser(env, req);
  const isSuper = !!user?.admin && (user.id === 1 || String(user.admin_roles || '').includes('super'));
  const content = `<div class="page-header"><h1>创建团队</h1></div><div class="card">
    ${!user ? '<p>提交申请前请先登录。</p>' : ''}
    <p>${isSuper ? '超级管理员可直接创建团队，普通用户提交后进入审核队列。' : '团队创建申请将由超级管理员审核。'}</p>
    <form method="POST" action="/api/teams"><label>团队名称</label><input name="name" required maxlength="40">
    <label>简介</label><textarea name="description" maxlength="500"></textarea>
    <label>等级</label><select name="level"><option value="普通">普通团队：每月最多 3 次比赛、1 次公开赛</option><option value="高级">高级团队：比赛和公开赛不限</option></select>
    <label>高级团队兑换码（申请高级团队时必填）</label><input name="upgrade_code" maxlength="64" autocomplete="off">
    <button type="submit">提交</button></form></div>`;
  return getLayout(env, user, '创建团队', content, '', req);
}

export async function renderTeam(env: Env, req: Request, path: string) {
  const id = Number(path.split('/')[2]);
  const user = await getSessionUser(env, req);
  const team = await env.DB.prepare('SELECT t.*, u.username AS owner_name FROM teams t JOIN users u ON u.id=t.owner_id WHERE t.id=? AND t.status=?').bind(id, 'active').first<any>();
  if (!team) return '团队不存在';
  const member = user ? await env.DB.prepare("SELECT * FROM team_members WHERE team_id=? AND user_id=?").bind(id, user.id).first<any>() : null;
  const members = await env.DB.prepare("SELECT tm.*,u.username,u.color,u.tag FROM team_members tm JOIN users u ON u.id=tm.user_id WHERE tm.team_id=? AND tm.status='approved' ORDER BY tm.role DESC,tm.created_at").bind(id).all<any>();
  const posts = await env.DB.prepare("SELECT p.*,u.username,u.color,u.tag FROM team_posts p JOIN users u ON u.id=p.author_id WHERE p.team_id=? ORDER BY p.created_at DESC LIMIT 50").bind(id).all<any>();
  const canPost = member?.status === 'approved' && ['owner','admin'].includes(member.role);
  const content = `<div class="page-header"><h1>${htmlEscape(team.name)} <small>${htmlEscape(team.level)}团队</small></h1></div>
  <div class="card"><p class="markdown-content">${htmlEscape(team.description)}</p><p>队长：${htmlEscape(team.owner_name)} · ${team.level === '高级' ? '比赛与公开赛不限' : '每月最多 3 次比赛、1 次公开赛'}</p>
  ${user && !member ? `<form method="POST" action="/api/teams/${id}/join"><button>申请加入</button></form>` : member?.status === 'pending' ? '<p>入队申请审核中</p>' : ''}
  </div><div class="card"><h2>团队公告与动态</h2>${canPost ? `<form method="POST" action="/api/teams/${id}/posts"><input name="title" placeholder="标题" required><textarea name="content" required></textarea><label><input type="checkbox" name="announcement">公告</label><button>发布</button></form>` : ''}
  ${(posts.results||[]).map((p:any)=>`<article><h3>${p.is_announcement?'📢 ':''}${htmlEscape(p.title)}</h3><div class="markdown-content">${htmlEscape(p.content)}</div><small>${renderUsernameLink(p.username,p.color,p.tag,p.author_id)} · ${htmlEscape(p.created_at)}</small></article>`).join('') || '<p>暂无内容</p>'}</div>
  ${member?.status === 'approved' && ['owner','admin'].includes(member.role) ? `<div class="card"><h2>OJ 团队比赛</h2><form method="POST" action="/api/teams/${id}/competitions"><input name="competition_id" required placeholder="OJ 比赛编号"><label><input type="checkbox" name="is_public">申请转为公开赛</label><button>提交比赛申请</button></form></div>` : ''}
  <div class="card"><h2>成员 (${members.results.length})</h2>${members.results.map((m:any)=>`<p>${renderUsernameLink(m.username,m.color,m.tag,m.user_id)} <small>${m.role}</small></p>`).join('')}</div>`;
  return getLayout(env, user, team.name, content, '', req);
}

export async function renderTeamRequests(env: Env, req: Request) {
  const user = await getSessionUser(env, req);
  if (!user || user.id !== 1) return getLayout(env, user, '团队审核', '<div class="card">仅 superuser 可访问团队审核队列。</div>', '', req);
  const rows = await env.DB.prepare("SELECT r.*,u.username FROM team_creation_requests r JOIN users u ON u.id=r.requester_id ORDER BY r.created_at DESC").all<any>();
  const content = `<div class="page-header"><h1>团队创建审核</h1></div><div class="card">${(rows.results || []).map((row: any) => `<div style="padding:12px 0;border-bottom:1px solid #eee"><strong>${htmlEscape(row.name)}</strong><p>${htmlEscape(row.description || '')}</p><small>申请人：${htmlEscape(row.username)} · ${htmlEscape(row.level)} · ${htmlEscape(row.status)}</small>${row.status === 'pending' ? `<form method="POST" action="/api/teams/requests/${row.id}/approve" style="display:inline;margin-left:12px"><button>通过</button></form><form method="POST" action="/api/teams/requests/${row.id}/reject" style="display:inline;margin-left:6px"><button>拒绝</button></form>` : ''}</div>`).join('') || '<p>暂无申请。</p>'}</div>`;
  return getLayout(env, user, '团队审核', content, '', req);
}
