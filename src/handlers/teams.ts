import { getSessionUser, jsonRes } from '../utils/auth';
import type { Env } from '../env.d';
import { checkViolation, violationErrorPage } from '../utils/violation';
import { getTranslator } from '../utils/i18n';
import { hasAdminPermission } from '../utils/adminPermissions';

const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
const joinModes = new Set(['application', 'free', 'closed']);
const validRoles = new Set(['owner', 'admin', 'member']);
const normalizeJoinMode = (value: unknown) => joinModes.has(String(value)) ? String(value) : 'application';
const normalizeRole = (value: unknown) => validRoles.has(String(value)) ? String(value) : 'member';
const isSuper = (user: any) => !!user?.admin && (user.id === 1 || String(user.admin_roles || '').includes('super'));

export async function handleTeams(request: Request, env: Env, path: string) {
  const user = await getSessionUser(env, request);

  const privatePostPath = path.match(/^\/api\/teams\/(\d+)\/posts(?:\/(\d+)(?:\/(comments|like))?)?$/);
  if (privatePostPath) {
    const teamId = Number(privatePostPath[1]);
    if (!user) return jsonRes({ error: '团队帖子仅对已审核成员开放。' }, 403);
    const member = await env.DB.prepare(
      "SELECT m.role FROM team_members m JOIN teams t ON t.id=m.team_id WHERE m.team_id=? AND m.user_id=? AND m.status='approved' AND t.status='active'"
    ).bind(teamId, user.id).first<{ role: string }>();
    if (!member) return jsonRes({ error: '团队帖子仅对已审核成员开放。' }, 403);

    const postId = Number(privatePostPath[2] || 0);
    if (postId) {
      const exists = await env.DB.prepare(
        'SELECT id FROM team_posts WHERE id=? AND team_id=? AND is_announcement=0'
      ).bind(postId, teamId).first();
      if (!exists) return jsonRes({ error: '团队帖子不存在。' }, 404);
    }

    if (privatePostPath[3] === 'like' && request.method !== 'POST') {
      return jsonRes({ error: '请求方法不支持。' }, 405);
    }
    if (privatePostPath[3] === 'like' && request.method === 'POST' && postId) {
      const existing = await env.DB.prepare(
        'SELECT post_id FROM team_post_likes WHERE post_id=? AND user_id=?'
      ).bind(postId, user.id).first();
      if (existing) {
        await env.DB.prepare('DELETE FROM team_post_likes WHERE post_id=? AND user_id=?').bind(postId, user.id).run();
      } else {
        await env.DB.prepare('INSERT INTO team_post_likes (post_id,user_id) VALUES (?,?)').bind(postId, user.id).run();
      }
      const count = await env.DB.prepare('SELECT COUNT(*) AS total FROM team_post_likes WHERE post_id=?')
        .bind(postId).first<{ total: number }>();
      return jsonRes({ liked: !existing, count: Number(count?.total || 0) });
    }

    if (privatePostPath[3] === 'comments' && postId) {
      if (request.method === 'GET') {
        const comments = await env.DB.prepare(`
          SELECT c.*,u.username,u.color,u.tag
          FROM team_post_comments c JOIN users u ON u.id=c.author_id
          WHERE c.post_id=? ORDER BY c.created_at,c.id LIMIT 200
        `).bind(postId).all<any>();
        return jsonRes({ comments: comments.results || [] });
      }
      if (request.method !== 'POST') return jsonRes({ error: '请求方法不支持。' }, 405);
      if (!user.speak) return jsonRes({ error: '当前账号无法发布评论。' }, 403);
      const form = await request.formData();
      const content = String(form.get('content') || '').trim();
      if (!content || content.length > 5000) return jsonRes({ error: '评论不能为空且最多 5000 个字符。' }, 400);
      const violation = await checkViolation(content);
      if (violation.violated) return violationErrorPage(violation, getTranslator(request));
      const rawParentId = Number(form.get('parent_id') || 0);
      const parentId = Number.isSafeInteger(rawParentId) && rawParentId > 0 ? rawParentId : 0;
      if (parentId) {
        const parent = await env.DB.prepare(
          'SELECT id FROM team_post_comments WHERE id=? AND post_id=?'
        ).bind(parentId, postId).first();
        if (!parent) return jsonRes({ error: '回复目标不属于该帖子。' }, 400);
      }
      await env.DB.prepare(
        'INSERT INTO team_post_comments (post_id,author_id,content,parent_id) VALUES (?,?,?,?)'
      ).bind(postId, user.id, content, parentId).run();
      return new Response(null, { status: 302, headers: { Location: `/team/${teamId}/posts/${postId}#comments` } });
    }

    if (privatePostPath[3]) return jsonRes({ error: '请求路径不存在。' }, 404);
    if (request.method === 'GET' && postId) {
      const post = await env.DB.prepare(`
        SELECT p.id,p.title,p.content,p.created_at,u.id AS author_id,u.username,u.color,u.tag,
               (SELECT COUNT(*) FROM team_post_comments c WHERE c.post_id=p.id) AS comment_count,
               (SELECT COUNT(*) FROM team_post_likes l WHERE l.post_id=p.id) AS like_count,
               EXISTS(SELECT 1 FROM team_post_likes l WHERE l.post_id=p.id AND l.user_id=?) AS liked
        FROM team_posts p JOIN users u ON u.id=p.author_id
        WHERE p.id=? AND p.team_id=? AND p.is_announcement=0
      `).bind(user.id, postId, teamId).first<any>();
      return jsonRes({ post });
    }
    if (request.method === 'GET') {
      const posts = await env.DB.prepare(`
        SELECT p.id,p.title,p.content,p.created_at,u.id AS author_id,u.username,u.color,u.tag,
               (SELECT COUNT(*) FROM team_post_comments c WHERE c.post_id=p.id) AS comment_count,
               (SELECT COUNT(*) FROM team_post_likes l WHERE l.post_id=p.id) AS like_count,
               EXISTS(SELECT 1 FROM team_post_likes l WHERE l.post_id=p.id AND l.user_id=?) AS liked
        FROM team_posts p JOIN users u ON u.id=p.author_id
        WHERE p.team_id=? AND p.is_announcement=0
        ORDER BY p.created_at DESC,p.id DESC LIMIT 50
      `).bind(user.id, teamId).all<any>();
      return jsonRes({ posts: posts.results || [] });
    }
    if (postId) return jsonRes({ error: '请求方法不支持。' }, 405);
    if (request.method === 'POST') {
      if (!user.speak) return jsonRes({ error: '当前账号无法发布团队帖子。' }, 403);
      const form = await request.formData();
      const title = String(form.get('title') || '').trim();
      const content = String(form.get('content') || '').trim();
      if (!title || !content) return jsonRes({ error: '标题和内容均不能为空。' }, 400);
      if (title.length > 120 || content.length > 20000) {
        return jsonRes({ error: '标题最多 120 个字符，内容最多 20000 个字符。' }, 400);
      }
      const announcement = form.get('announcement') === '1' || form.get('announcement') === 'on';
      if (announcement && !['owner', 'admin'].includes(member.role)) {
        return jsonRes({ error: '只有团队管理员可以发布公告。' }, 403);
      }
      const violation = await checkViolation(`${title}\n${content}`);
      if (violation.violated) return violationErrorPage(violation, getTranslator(request));
      const result = await env.DB.prepare(
        'INSERT INTO team_posts (team_id,author_id,title,content,is_announcement) VALUES (?,?,?,?,?)'
      ).bind(teamId, user.id, title, content, announcement ? 1 : 0).run();
      const createdPostId = Number(result.meta?.last_row_id || 0);
      if (!createdPostId) throw new Error('Team post insert completed without returning an ID.');
      return new Response(null, {
        status: 302,
        headers: { Location: announcement ? `/team/${teamId}#announcements` : `/team/${teamId}/posts/${createdPostId}` },
      });
    }
    return jsonRes({ error: '请求方法不支持。' }, 405);
  }

  if (path === '/api/teams/requests' && request.method === 'GET') {
    if (!isSuper(user) && !hasAdminPermission(user, 'admin.reviews.handle')) return jsonRes({ error: '无权限' }, 403);
    const rows = await env.DB.prepare("SELECT r.*, u.username FROM team_creation_requests r JOIN users u ON u.id=r.requester_id WHERE r.status='pending' ORDER BY r.created_at").all();
    return jsonRes(rows.results);
  }

  const review = path.match(/^\/api\/teams\/requests\/(\d+)\/(approve|reject)$/);
  if (review && request.method === 'POST') {
    if (!isSuper(user) && !hasAdminPermission(user, 'admin.reviews.handle')) return jsonRes({ error: '无权限' }, 403);
    const requestId = Number(review[1]);
    const pending = await env.DB.prepare("SELECT * FROM team_creation_requests WHERE id=? AND status='pending'").bind(requestId).first<any>();
    if (!pending) return jsonRes({ error: '申请不存在' }, 404);
    if (review[2] === 'reject') {
      await env.DB.prepare("UPDATE team_creation_requests SET status='rejected', reviewed_by=? WHERE id=?").bind(user.id, requestId).run();
      return jsonRes({ ok: true });
    }
    const created = await env.DB.prepare('INSERT INTO teams (name,slug,description,level,join_mode,owner_id,competition_quota) VALUES (?,?,?,?,?,?,?)')
      .bind(pending.name, slugify(pending.name), pending.description || '', pending.level === '高级' ? '高级' : '普通', normalizeJoinMode(pending.join_mode), pending.requester_id, pending.level === '高级' ? 0 : 3).run();
    const teamId = Number(created.meta?.last_row_id);
    await env.DB.prepare("INSERT INTO team_members (team_id,user_id,role,status) VALUES (?,?,?,'approved')").bind(teamId, pending.requester_id, 'owner').run();
    await env.DB.prepare("UPDATE team_creation_requests SET status='approved', reviewed_by=? WHERE id=?").bind(user.id, requestId).run();
    return jsonRes({ ok: true, team_id: teamId });
  }

  if (path === '/api/teams' && request.method === 'GET') {
    const rows = await env.DB.prepare("SELECT t.*,u.username AS owner_name,(SELECT COUNT(*) FROM team_members m WHERE m.team_id=t.id AND m.status='approved') AS member_count FROM teams t JOIN users u ON u.id=t.owner_id WHERE t.status='active' ORDER BY t.created_at DESC").all();
    return jsonRes(rows.results);
  }

  if (path === '/api/teams' && request.method === 'POST') {
    if (!user) return jsonRes({ error: '请先登录' }, 403);
    const form = await request.formData();
    const name = String(form.get('name') || '').trim();
    const description = String(form.get('description') || '').trim().slice(0, 500);
    const level = form.get('level') === '高级' ? '高级' : '普通';
    const joinMode = normalizeJoinMode(form.get('join_mode'));
    if (!name) return jsonRes({ error: '团队名称不能为空' }, 400);
    if (await env.DB.prepare('SELECT id FROM teams WHERE name=?').bind(name).first()) return jsonRes({ error: '团队名称已存在' }, 409);
    if (level === '高级') {
      const codeValue = String(form.get('upgrade_code') || '').trim().toUpperCase();
      const code = await env.DB.prepare("SELECT * FROM team_upgrade_codes WHERE code=? AND enabled=1").bind(codeValue).first<any>();
      if (!code || (Number(code.max_uses) > 0 && Number(code.used_count) >= Number(code.max_uses)) || (code.expires_at && String(code.expires_at) < new Date().toISOString())) return jsonRes({ error: '高级团队兑换码无效、已用尽或已过期' }, 400);
      await env.DB.prepare('UPDATE team_upgrade_codes SET used_count=used_count+1 WHERE code=?').bind(codeValue).run();
    }
    if (!isSuper(user)) {
      await env.DB.prepare('INSERT INTO team_creation_requests (requester_id,name,description,level,join_mode) VALUES (?,?,?,?,?)').bind(user.id, name, description, level, joinMode).run();
      return new Response(null, { status: 302, headers: { Location: '/team/new?submitted=1' } });
    }
    const result = await env.DB.prepare('INSERT INTO teams (name,slug,description,level,join_mode,owner_id,competition_quota) VALUES (?,?,?,?,?,?,?)').bind(name, slugify(name), description, level, joinMode, user.id, level === '高级' ? 0 : 3).run();
    const teamId = Number(result.meta?.last_row_id);
    await env.DB.prepare("INSERT INTO team_members (team_id,user_id,role,status) VALUES (?,?,?,'approved')").bind(teamId, user.id, 'owner').run();
    return new Response(null, { status: 302, headers: { Location: `/team/${teamId}` } });
  }

  const join = path.match(/^\/api\/teams\/(\d+)\/join$/);
  if (join && request.method === 'POST') {
    if (!user) return jsonRes({ error: '请先登录' }, 403);
    const team = await env.DB.prepare('SELECT join_mode FROM teams WHERE id=? AND status=?').bind(Number(join[1]), 'active').first<any>();
    if (!team) return jsonRes({ error: '团队不存在' }, 404);
    if (team.join_mode === 'closed') return jsonRes({ error: '该团队不开放加入' }, 403);
    const form = await request.formData();
    const reason = String(form.get('reason') || '').trim().slice(0, 300);
    const status = team.join_mode === 'free' ? 'approved' : 'pending';
    await env.DB.prepare('INSERT INTO team_members (team_id,user_id,role,status,reason) VALUES (?,?,?, ?, ?) ON CONFLICT(team_id,user_id) DO UPDATE SET status=excluded.status, reason=excluded.reason').bind(Number(join[1]), user.id, 'member', status, reason).run();
    return jsonRes({ ok: true, status });
  }

  const announcement = path.match(/^\/api\/teams\/(\d+)\/announcement$/);
  if (announcement && request.method === 'POST') {
    if (!user) return jsonRes({ error: '请先登录' }, 403);
    const teamId = Number(announcement[1]);
    const member = await env.DB.prepare("SELECT role,status FROM team_members WHERE team_id=? AND user_id=?").bind(teamId, user.id).first<any>();
    if (!member || member.status !== 'approved' || !['owner', 'admin'].includes(member.role)) return jsonRes({ error: '无权限' }, 403);
    const form = await request.formData();
    const content = String(form.get('content') || '').trim();
    const existing = await env.DB.prepare('SELECT id FROM team_posts WHERE team_id=? AND is_announcement=1 ORDER BY created_at DESC LIMIT 1').bind(teamId).first<any>();
    if (existing) {
      await env.DB.prepare('UPDATE team_posts SET content=?, created_at=datetime("now") WHERE id=?').bind(content, existing.id).run();
    } else {
      await env.DB.prepare('INSERT INTO team_posts (team_id, author_id, title, content, is_announcement) VALUES (?, ?, ?, ?, 1)').bind(teamId, user.id, '团队公告', content, ).run();
    }
    return new Response(null, { status: 302, headers: { Location: `/team/${teamId}/settings` } });
  }

  const approval = path.match(/^\/api\/teams\/(\d+)\/members\/(\d+)\/(approve|reject)$/);
  if (approval && request.method === 'POST') {
    if (!user) return jsonRes({ error: '请先登录' }, 403);
    const member = await env.DB.prepare("SELECT role FROM team_members WHERE team_id=? AND user_id=? AND status='approved'").bind(Number(approval[1]), user.id).first<any>();
    if (!member || !['owner', 'admin'].includes(member.role)) return jsonRes({ error: '无权限' }, 403);
    await env.DB.prepare('UPDATE team_members SET status=? WHERE team_id=? AND user_id=?').bind(approval[3] === 'approve' ? 'approved' : 'rejected', Number(approval[1]), Number(approval[2])).run();
    return new Response(null, { status: 302, headers: { Location: `/team/${approval[1]}/settings` } });
  }

  const roleUpdate = path.match(/^\/api\/teams\/(\d+)\/members\/(\d+)\/role$/);
  if (roleUpdate && request.method === 'POST') {
    if (!user) return jsonRes({ error: '请先登录' }, 403);
    const teamId = Number(roleUpdate[1]);
    const targetUserId = Number(roleUpdate[2]);
    const currentMember = await env.DB.prepare("SELECT role FROM team_members WHERE team_id=? AND user_id=? AND status='approved'").bind(teamId, user.id).first<any>();
    if (!currentMember || currentMember.role !== 'owner') return jsonRes({ error: '只有队长可以管理成员角色' }, 403);
    const form = await request.formData();
    const nextRole = normalizeRole(form.get('role'));
    if (targetUserId === user.id && nextRole !== 'owner') return jsonRes({ error: '队长不能降级' }, 400);
    await env.DB.prepare('UPDATE team_members SET role=? WHERE team_id=? AND user_id=?').bind(nextRole, teamId, targetUserId).run();
    return new Response(null, { status: 302, headers: { Location: `/team/${teamId}/settings` } });
  }

  const competition = path.match(/^\/api\/teams\/(\d+)\/competitions$/);
  if (competition && request.method === 'POST') {
    if (!user) return jsonRes({ error: '请先登录' }, 403);
    const teamId = Number(competition[1]);
    const member = await env.DB.prepare("SELECT t.level, m.role FROM teams t JOIN team_members m ON m.team_id=t.id WHERE t.id=? AND m.user_id=? AND m.status='approved'").bind(teamId, user.id).first<any>();
    if (!member || !['owner', 'admin'].includes(member.role)) return jsonRes({ error: '仅团队管理员可以提交比赛申请' }, 403);
    const form = await request.formData();
    const competitionId = String(form.get('competition_id') || '').trim();
    const isPublic = form.get('is_public') ? 1 : 0;
    if (!competitionId) return jsonRes({ error: '请填写 OJ 比赛编号' }, 400);
    if (member.level === '普通') {
      const count = await env.DB.prepare("SELECT COUNT(*) AS total FROM team_competition_requests WHERE team_id=? AND created_at >= date('now','start of month')").bind(teamId).first<any>();
      if (Number(count?.total || 0) >= 3) return jsonRes({ error: '普通团队本月比赛次数已达 3 次' }, 429);
      if (isPublic) {
        const publicCount = await env.DB.prepare("SELECT COUNT(*) AS total FROM team_competition_requests WHERE team_id=? AND is_public=1 AND created_at >= date('now','start of month')").bind(teamId).first<any>();
        if (Number(publicCount?.total || 0) >= 1) return jsonRes({ error: '普通团队本月公开赛次数已达 1 次' }, 429);
      }
    }
    await env.DB.prepare('INSERT INTO team_competition_requests (team_id,requester_id,competition_id,is_public) VALUES (?,?,?,?)').bind(teamId, user.id, competitionId, isPublic).run();
    return jsonRes({ ok: true, status: 'pending' });
  }

  return jsonRes({ error: 'API not found' }, 404);
}
