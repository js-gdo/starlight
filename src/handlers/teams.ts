import { getSessionUser, jsonRes } from '../utils/auth';
import type { Env } from '../env.d';

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
async function isSuper(user: any) { return !!user?.admin && (user.id === 1 || String(user.admin_roles || '').includes('super')); }

export async function handleTeams(request: Request, env: Env, path: string) {
  const user = await getSessionUser(env, request);
  if (path === '/api/teams/requests' && request.method === 'GET') {
    if (!(await isSuper(user))) return jsonRes({ error: '无权限' }, 403);
    const rows = await env.DB.prepare("SELECT r.*,u.username FROM team_creation_requests r JOIN users u ON u.id=r.requester_id WHERE r.status='pending' ORDER BY r.created_at").all();
    return jsonRes(rows.results);
  }
  const review = path.match(/^\/api\/teams\/requests\/(\d+)\/(approve|reject)$/);
  if (review && request.method === 'POST') {
    if (!(await isSuper(user))) return jsonRes({ error: '无权限' }, 403);
    const requestId = Number(review[1]);
    const pending = await env.DB.prepare("SELECT * FROM team_creation_requests WHERE id=? AND status='pending'").bind(requestId).first<any>();
    if (!pending) return jsonRes({ error: '申请不存在' }, 404);
    if (review[2] === 'reject') {
      await env.DB.prepare("UPDATE team_creation_requests SET status='rejected',reviewed_by=? WHERE id=?").bind(user.id, requestId).run();
      return jsonRes({ ok: true });
    }
    const slug = slugify(pending.name);
    const created = await env.DB.prepare('INSERT INTO teams (name,slug,description,level,owner_id,competition_quota) VALUES (?,?,?,?,?,?)')
      .bind(pending.name, slug, pending.description, pending.level, pending.requester_id, pending.level === '高级' ? 5 : 1).run();
    const teamId = Number(created.meta?.last_row_id);
    await env.DB.prepare("INSERT INTO team_members (team_id,user_id,role,status) VALUES (?,?,?,'approved')").bind(teamId, pending.requester_id, 'owner').run();
    await env.DB.prepare("UPDATE team_creation_requests SET status='approved',reviewed_by=? WHERE id=?").bind(user.id, requestId).run();
    return jsonRes({ ok: true, team_id: teamId });
  }
  if (path === '/api/teams' && request.method === 'GET') {
    const rows = await env.DB.prepare("SELECT t.*,u.username AS owner_name,(SELECT COUNT(*) FROM team_members m WHERE m.team_id=t.id AND m.status='approved') AS member_count FROM teams t JOIN users u ON u.id=t.owner_id WHERE t.status='active' ORDER BY t.created_at DESC").all();
    return jsonRes(rows.results);
  }
  if (path === '/api/teams' && request.method === 'POST') {
    if (!user) return jsonRes({ error: '请先登录' }, 403);
    const f = await request.formData(); const name=String(f.get('name')||'').trim(); const description=String(f.get('description')||'').trim(); const requestedLevel=f.get('level')==='高级'?'高级':'普通';
    let level = requestedLevel;
    const upgradeCode = String(f.get('upgrade_code') || '').trim().toUpperCase();
    if (level === '高级') {
      const code = await env.DB.prepare("SELECT * FROM team_upgrade_codes WHERE code=? AND enabled=1").bind(upgradeCode).first<any>();
      if (!code || (Number(code.max_uses) > 0 && Number(code.used_count) >= Number(code.max_uses)) || (code.expires_at && String(code.expires_at) < new Date().toISOString())) return jsonRes({error:'高级团队兑换码无效、已用尽或已过期'},400);
      await env.DB.prepare('UPDATE team_upgrade_codes SET used_count=used_count+1 WHERE code=?').bind(upgradeCode).run();
    }
    if (!name) return jsonRes({ error:'团队名称不能为空' },400);
    if (await env.DB.prepare('SELECT id FROM teams WHERE name=?').bind(name).first()) return jsonRes({error:'团队名称已存在'},409);
    if (!(await isSuper(user))) { await env.DB.prepare('INSERT INTO team_creation_requests (requester_id,name,description,level) VALUES (?,?,?,?)').bind(user.id,name,description,level).run(); return new Response(null,{status:302,headers:{Location:'/team/new?submitted=1'}}); }
    const result=await env.DB.prepare('INSERT INTO teams (name,slug,description,level,owner_id,competition_quota) VALUES (?,?,?,?,?,?)').bind(name,slugify(name),description,level,user.id,level==='高级'?0:3).run();
    const id=Number(result.meta?.last_row_id); await env.DB.prepare("INSERT INTO team_members (team_id,user_id,role,status) VALUES (?,?,?,'approved')").bind(id,user.id,'owner').run();
    return new Response(null,{status:302,headers:{Location:`/team/${id}`}});
  }
  const join=path.match(/^\/api\/teams\/(\d+)\/join$/); if(join && request.method==='POST'){ if(!user)return jsonRes({error:'请先登录'},403); const id=Number(join[1]); await env.DB.prepare("INSERT OR IGNORE INTO team_members (team_id,user_id,status) VALUES (?,?,'pending')").bind(id,user.id).run(); return jsonRes({ok:true,status:'pending'}); }
  const post=path.match(/^\/api\/teams\/(\d+)\/posts$/); if(post && request.method==='POST'){ if(!user)return jsonRes({error:'请先登录'},403); const id=Number(post[1]); const m=await env.DB.prepare("SELECT role,status FROM team_members WHERE team_id=? AND user_id=?").bind(id,user.id).first<any>(); if(!m||m.status!=='approved'||!['owner','admin'].includes(m.role))return jsonRes({error:'无权限'},403); const f=await request.formData(); await env.DB.prepare('INSERT INTO team_posts (team_id,author_id,title,content,is_announcement) VALUES (?,?,?,?,?)').bind(id,user.id,String(f.get('title')||''),String(f.get('content')||''),f.get('announcement')?'1':'0').run(); return new Response(null,{status:302,headers:{Location:`/team/${id}`}});
  }
  const approve=path.match(/^\/api\/teams\/(\d+)\/members\/(\d+)\/(approve|reject)$/); if(approve&&request.method==='POST'){ if(!user)return jsonRes({error:'请先登录'},403); const id=Number(approve[1]),uid=Number(approve[2]); const m=await env.DB.prepare("SELECT role FROM team_members WHERE team_id=? AND user_id=?").bind(id,user.id).first<any>(); if(!m||!['owner','admin'].includes(m.role))return jsonRes({error:'无权限'},403); await env.DB.prepare('UPDATE team_members SET status=? WHERE team_id=? AND user_id=?').bind(approve[3]==='approve'?'approved':'rejected',id,uid).run(); return jsonRes({ok:true}); }
  const comp=path.match(/^\/api\/teams\/(\d+)\/competitions$/); if(comp&&request.method==='POST'){ if(!user)return jsonRes({error:'请先登录'},403); const id=Number(comp[1]); const m=await env.DB.prepare("SELECT t.level,m.role FROM teams t JOIN team_members m ON m.team_id=t.id WHERE t.id=? AND m.user_id=? AND m.status='approved'").bind(id,user.id).first<any>(); if(!m)return jsonRes({error:'不是团队成员'},403); const f=await request.formData(); const competitionId=String(f.get('competition_id')||'').trim(); const isPublic=f.get('is_public') ? 1 : 0; if(!competitionId)return jsonRes({error:'请填写 OJ 比赛编号'},400); if(m.level==='普通'){ const count=await env.DB.prepare("SELECT COUNT(*) AS count FROM team_competition_requests WHERE team_id=? AND created_at >= date('now','start of month')").bind(id).first<any>(); if(Number(count?.count||0)>=3)return jsonRes({error:'普通团队本月比赛次数已达 3 次'},429); if(isPublic){const publicCount=await env.DB.prepare("SELECT COUNT(*) AS count FROM team_competition_requests WHERE team_id=? AND is_public=1 AND created_at >= date('now','start of month')").bind(id).first<any>(); if(Number(publicCount?.count||0)>=1)return jsonRes({error:'普通团队本月公开赛次数已达 1 次'},429);}} await env.DB.prepare('INSERT INTO team_competition_requests (team_id,requester_id,competition_id,is_public) VALUES (?,?,?,?)').bind(id,user.id,competitionId,isPublic).run(); return jsonRes({ok:true,is_public:isPublic}); }
  if(path === '/api/teams/competitions/public' && request.method === 'GET'){ const rows=await env.DB.prepare("SELECT r.*,t.name AS team_name FROM team_competition_requests r JOIN teams t ON t.id=r.team_id WHERE r.is_public=1 AND r.status='approved' ORDER BY r.created_at DESC LIMIT 50").all(); return jsonRes(rows.results); }
  return jsonRes({error:'Not found'},404);
}
