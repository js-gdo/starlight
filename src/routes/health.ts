import { getSessionUser } from '../utils/auth';
import { getLayout } from '../utils/layout';
import { htmlEscape } from '../utils/html';
import { getChinaDateString } from '../utils/time';
import type { Env } from '../env.d';

export async function renderHealth(env: Env, req: Request) {
    const user = await getSessionUser(env, req);
    const db = env.DB;
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const chinaDate = getChinaDateString();
    const chinaStart = new Date(`${chinaDate}T00:00:00+08:00`).toISOString();
    const nextChinaDate = new Date(new Date(`${chinaDate}T00:00:00+08:00`).getTime() + 24 * 60 * 60 * 1000).toISOString();

    const [online, users, articles, comments, tickets, newUsers, newArticles, newComments, newTickets, announcements] = await Promise.all([
        db.prepare('SELECT COUNT(*) AS total FROM users WHERE use = 1 AND last_active_at >= ?').bind(fiveMinutesAgo).first<any>(),
        db.prepare('SELECT COUNT(*) AS total FROM users WHERE use = 1').first<any>(),
        db.prepare('SELECT COUNT(*) AS total FROM articles').first<any>(),
        db.prepare('SELECT COUNT(*) AS total FROM comments').first<any>(),
        db.prepare('SELECT COUNT(*) AS total FROM tickets').first<any>(),
        db.prepare("SELECT COUNT(*) AS total FROM users WHERE datetime(created_at) >= datetime(?) AND datetime(created_at) < datetime(?)").bind(chinaStart, nextChinaDate).first<any>(),
        db.prepare("SELECT COUNT(*) AS total FROM articles WHERE datetime(created_at) >= datetime(?) AND datetime(created_at) < datetime(?)").bind(chinaStart, nextChinaDate).first<any>(),
        db.prepare("SELECT COUNT(*) AS total FROM comments WHERE datetime(created_at) >= datetime(?) AND datetime(created_at) < datetime(?)").bind(chinaStart, nextChinaDate).first<any>(),
        db.prepare("SELECT COUNT(*) AS total FROM tickets WHERE datetime(created_at) >= datetime(?) AND datetime(created_at) < datetime(?)").bind(chinaStart, nextChinaDate).first<any>(),
        db.prepare("SELECT COUNT(*) AS total FROM announcements WHERE enabled = 1").first<any>(),
    ]);

    const metric = (label: string, value: unknown, note: string) => `
      <div class="health-metric"><div class="health-metric-label">${label}</div><div class="health-metric-value">${Number(value || 0)}</div><div class="health-metric-note">${note}</div></div>`;
    const content = `
      <style>
        .health-hero { padding:24px; border-radius:12px; color:#fff; background:linear-gradient(135deg,#263238,#455a64); margin-bottom:16px; }
        .health-hero h1 { margin:0 0 8px; font-size:28px; }
        .health-hero p { margin:0; color:#d7e0e3; font-size:13px; }
        .health-status { display:inline-flex; align-items:center; gap:8px; margin-top:16px; padding:7px 11px; border:1px solid rgba(255,255,255,.25); border-radius:999px; font-size:12px; }
        .health-status i { color:#6ee7b7; }
        .health-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:12px; }
        .health-metric { background:#fff; border:1px solid #edf0f1; border-radius:10px; padding:16px; }
        .health-metric-label { color:#60717a; font-size:12px; }
        .health-metric-value { color:#263238; font-size:28px; font-weight:800; margin-top:8px; }
        .health-metric-note { color:#94a1a7; font-size:11px; margin-top:4px; }
        .health-section { margin-top:16px; }
        .health-section h2 { font-size:16px; color:#37474f; margin:0 0 10px; }
        .health-footnote { color:#87949a; font-size:12px; line-height:1.7; }
        .health-refresh { border:0; border-radius:6px; padding:9px 13px; background:#455a64; color:#fff; cursor:pointer; }
      </style>
      <div class="health-hero">
        <h1><i class="fas fa-heart-pulse"></i> 服务脉搏</h1>
        <p>公开查看 StarLight 当前运行状态与社区活跃度。</p>
        <div class="health-status"><i class="fas fa-circle"></i> 服务运行正常 · ${htmlEscape(chinaDate)} 东八区</div>
      </div>
      <div class="health-section"><h2>实时访问</h2><div class="health-grid">
        ${metric('当前在线', online?.total, '最近 5 分钟活跃用户')}
        ${metric('注册用户', users?.total, '正常状态用户')}
        ${metric('启用公告', announcements?.total, '当前可见公告')}
      </div></div>
      <div class="health-section"><h2>今日新增</h2><div class="health-grid">
        ${metric('新用户', newUsers?.total, 'UTC+8 自然日')}
        ${metric('新帖子', newArticles?.total, 'UTC+8 自然日')}
        ${metric('新评论', newComments?.total, 'UTC+8 自然日')}
        ${metric('新工单', newTickets?.total, 'UTC+8 自然日')}
      </div></div>
      <div class="health-section"><h2>社区总量</h2><div class="health-grid">
        ${metric('帖子总数', articles?.total, '全部公开内容')}
        ${metric('评论总数', comments?.total, '全部评论')}
        ${metric('工单总数', tickets?.total, '全部工单')}
      </div></div>
      <div class="health-section" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;"><button class="health-refresh" type="button" onclick="location.reload()"><i class="fas fa-rotate"></i> 刷新状态</button><span class="health-footnote">数据按东八区自然日统计。机器接口：<a href="/api/health">/api/health</a></span></div>
    `;
    return await getLayout(env, user, '服务脉搏', content, '', req);
}
