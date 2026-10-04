import { getSessionUser } from '../utils/auth';
import { getLayout } from '../utils/layout';
import { htmlEscape, renderUsernameLink } from '../utils/html';
import { formatTimeToChina } from '../utils/time';
import { getUserColor, getTicketStatus } from '../utils/constants';
import type { Env } from '../env.d';
import {
    ADMIN_PERMISSION_NODES,
    getAdminSectionPermission,
    hasAdminPermission,
    parseAdminPermissions,
} from '../utils/adminPermissions';

type AdminSection = 'dashboard' | 'user' | 'content' | 'security' | 'reviews' | 'site' | 'permissions';

const sectionNames: Record<AdminSection, string> = {
    dashboard: '运营仪表盘',
    user: '用户管理',
    content: '内容管理',
    security: '内容安全',
    reviews: '审核队列',
    site: '站点管理',
    permissions: '权限节点',
};

const sectionPaths: Record<AdminSection, string> = {
    dashboard: '/backend',
    user: '/backend/user',
    content: '/backend/content',
    security: '/backend/security',
    reviews: '/backend/reviews',
    site: '/backend/site',
    permissions: '/backend/permissions',
};

const sectionIcons: Record<AdminSection, string> = {
    dashboard: 'fa-gauge-high',
    user: 'fa-users',
    content: 'fa-file-lines',
    security: 'fa-shield-halved',
    reviews: 'fa-inbox',
    site: 'fa-globe',
    permissions: 'fa-key',
};

const styles = `
.admin-console{--ac-ink:#202b30;--ac-muted:#65747b;--ac-line:#dce4e3;--ac-paper:#fff;--ac-bg:#f3f6f4;--ac-green:#177d67;--ac-green-soft:#e5f4ef;color:var(--ac-ink)}
.admin-console *{box-sizing:border-box}
.admin-top{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;padding:4px 0 18px;border-bottom:1px solid var(--ac-line)}
.admin-kicker{font-size:11px;font-weight:700;letter-spacing:1px;color:var(--ac-green);text-transform:uppercase}
.admin-top h1{font-size:25px;line-height:1.2;margin-top:5px;color:var(--ac-ink)}
.admin-top p{margin-top:6px;color:var(--ac-muted);font-size:13px}
.admin-who{font-size:12px;color:var(--ac-muted);white-space:nowrap}
.admin-nav{display:flex;gap:4px;overflow-x:auto;padding:12px 0;border-bottom:1px solid var(--ac-line);margin-bottom:18px}
.admin-nav a{display:inline-flex;align-items:center;gap:8px;padding:8px 10px;border-radius:5px;color:#536269;text-decoration:none;font-size:13px;white-space:nowrap}
.admin-nav a:hover{background:#e9efed;color:var(--ac-ink)}
.admin-nav a.active{background:var(--ac-green-soft);color:#126a56;font-weight:650}
.admin-body{display:grid;gap:14px}
.admin-panel{background:var(--ac-paper);border:1px solid var(--ac-line);border-radius:6px;padding:16px}
.admin-panel-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}
.admin-panel h2{font-size:15px;margin:0;color:var(--ac-ink)}
.admin-panel h2 i{color:var(--ac-green);margin-right:7px}
.admin-muted{font-size:12px;color:var(--ac-muted);line-height:1.6}
.admin-stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
.admin-stat{border:1px solid var(--ac-line);border-radius:5px;padding:13px;background:linear-gradient(145deg,#fff,#f7faf8)}
.admin-stat-label{font-size:12px;color:var(--ac-muted)}
.admin-stat-value{font-size:25px;font-weight:700;line-height:1.2;margin-top:7px;font-variant-numeric:tabular-nums}
.admin-stat-note{font-size:11px;color:#829097;margin-top:5px}
.admin-shortcuts{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:9px}
.admin-shortcut{display:flex;align-items:center;gap:12px;padding:13px;border:1px solid var(--ac-line);border-radius:5px;text-decoration:none;color:var(--ac-ink);background:#fff}
.admin-shortcut:hover{border-color:#83b9aa;background:#f7fbf9}
.admin-shortcut-icon{width:34px;height:34px;display:grid;place-items:center;border-radius:5px;background:var(--ac-green-soft);color:var(--ac-green);flex:none}
.admin-shortcut strong{display:block;font-size:13px}
.admin-shortcut small{display:block;color:var(--ac-muted);font-size:11px;margin-top:3px}
.admin-toolbar{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:12px}
.admin-search{min-width:min(100%,280px);padding:8px 10px;border:1px solid var(--ac-line);border-radius:4px;font:inherit;font-size:13px}
.admin-table-wrap{overflow:auto;border:1px solid var(--ac-line);border-radius:5px}
.admin-table{width:100%;min-width:740px;border-collapse:collapse;font-size:12px}
.admin-table th{position:sticky;top:0;background:#f3f7f5;color:#536269;text-align:left;font-size:11px;font-weight:700}
.admin-table th,.admin-table td{padding:10px;border-bottom:1px solid #e9eeec;vertical-align:top}
.admin-table tr:last-child td{border-bottom:0}
.admin-table tbody tr:hover{background:#fafcfb}
.admin-row-actions{display:flex;gap:7px;flex-wrap:wrap;align-items:center}
.admin-inline-form{display:flex;gap:5px;align-items:center;flex-wrap:wrap}
.admin-console input[type=text],.admin-console input[type=url],.admin-console input[type=number],.admin-console input[type=datetime-local],.admin-console select,.admin-console textarea{max-width:100%;padding:7px 9px;border:1px solid #ced9d6;border-radius:4px;background:#fff;color:var(--ac-ink);font:inherit;font-size:12px}
.admin-console input:focus,.admin-console select:focus,.admin-console textarea:focus{outline:2px solid #b3dbcf;border-color:#63a993}
.admin-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:31px;padding:6px 10px;border:1px solid #cbd6d2;border-radius:4px;background:#fff;color:#35434a;text-decoration:none;font:inherit;font-size:12px;cursor:pointer}
.admin-btn:hover{background:#f1f6f4}
.admin-btn.primary{border-color:var(--ac-green);background:var(--ac-green);color:#fff}
.admin-btn.danger{border-color:#e4b9b5;color:#a63830}
.admin-btn:disabled{opacity:.5;cursor:not-allowed}
.admin-chip{display:inline-flex;padding:3px 7px;border-radius:3px;background:#edf2f0;color:#4f625b;font-size:10px}
.admin-empty{padding:28px;text-align:center;color:var(--ac-muted);font-size:13px}
.admin-actions-cell{min-width:300px}
.admin-details{margin-top:8px;border-top:1px solid #edf1ef;padding-top:8px}
.admin-details summary{cursor:pointer;color:var(--ac-green);font-size:11px}
.admin-permission-form{min-width:430px;max-width:620px;padding:9px;border:1px solid var(--ac-line);border-radius:5px;background:#fbfcfb}
.admin-permission-groups{display:grid;grid-template-columns:repeat(2,minmax(150px,1fr));gap:9px;margin:8px 0}
.admin-permission-group{border:1px solid #e6ece9;border-radius:4px;padding:8px}
.admin-permission-group strong{font-size:11px}
.admin-permission-option{display:flex;align-items:flex-start;gap:6px;margin-top:6px;font-size:11px;color:#435159}
.admin-permission-option input{margin-top:2px}
.admin-notice{border-left:3px solid #d2a74d;padding:10px 12px;background:#fff9ea;color:#72591d;font-size:12px;line-height:1.6}
.admin-list{display:grid;gap:8px}
.admin-list-item{display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid #edf1ef;padding:9px 0;font-size:12px}
.admin-list-item:last-child{border-bottom:0}
@media(max-width:700px){.admin-top{align-items:flex-start;flex-direction:column}.admin-who{white-space:normal}.admin-panel{padding:12px}.admin-permission-groups{grid-template-columns:1fr}.admin-permission-form{min-width:340px}}
`;

function adminShell(user: any, section: AdminSection, body: string): string {
    const nav = (Object.keys(sectionNames) as AdminSection[])
        .filter(key => (key === 'dashboard' && hasAdminPermission(user, 'admin.dashboard.view')) || (key === 'content' && hasAny(user, ['admin.content.articles.view', 'admin.content.tickets.view'])) || hasAdminPermission(user, getAdminSectionPermission(key)) ||
            (key === 'security' && hasAdminPermission(user, 'admin.security.audit.view')) ||
            (key === 'site' && ['admin.site.banners.manage', 'admin.site.announcements.manage'].some(node => hasAdminPermission(user, node))) ||
            (key === 'permissions' && hasAdminPermission(user, 'admin.permissions.manage')))
        .map(key => `<a class="${section === key ? 'active' : ''}" href="${sectionPaths[key]}"><i class="fas ${sectionIcons[key]}"></i>${sectionNames[key]}</a>`)
        .join('');
    return `<div class="admin-console">
        <header class="admin-top"><div><div class="admin-kicker">STARLIGHT · OPERATIONS</div><h1>${sectionNames[section]}</h1><p>管理操作、待办事项与站点状态集中处理。</p></div><div class="admin-who"><i class="fas fa-user-shield"></i> ${renderUsernameLink(user.username, user.color, user.tag, user.id)} · UID ${user.id}</div></header>
        <nav class="admin-nav" aria-label="后台分区">${nav}</nav>
        <div class="admin-body">${body}</div>
    </div>`;
}

function panel(title: string, icon: string, body: string, aside = ''): string {
    return `<section class="admin-panel"><div class="admin-panel-head"><h2><i class="fas ${icon}"></i>${title}</h2>${aside}</div>${body}</section>`;
}

function hasAny(user: any, nodes: string[]): boolean {
    return nodes.some(node => hasAdminPermission(user, node));
}

function sectionForPath(path: string): AdminSection {
    const key = path.replace(/^\/backend\/?/, '').split('/')[0] as AdminSection;
    return key && key in sectionNames ? key : 'dashboard';
}

export async function renderBackendConsole(env: Env, req: Request): Promise<string | Response> {
    const user = await getSessionUser(env, req);
    if (!user || !user.admin) return new Response('无权访问', { status: 403 });

    const path = new URL(req.url).pathname;
    const section = sectionForPath(path);
    const accessible = section === 'security'
        ? hasAny(user, ['admin.security.reports.view', 'admin.security.audit.view'])
        : section === 'site'
            ? hasAny(user, ['admin.site.settings.edit', 'admin.site.banners.manage', 'admin.site.announcements.manage'])
            : section === 'content'
                ? hasAny(user, ['admin.content.articles.view', 'admin.content.tickets.view'])
                : hasAdminPermission(user, getAdminSectionPermission(section));
    if (!accessible) {
        return new Response(await getLayout(env, user, '无权访问', adminShell(user, section,
            panel('权限不足', 'fa-lock', '<p class="admin-muted">当前账号没有访问此分区的权限节点，请联系 UID 1 管理员。</p>')), styles, req), {
            status: 403,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
    }

    const db = env.DB;
    let body = '';
    if (section === 'dashboard') {
        const [users, articles, tickets, reports, activeUsers, newUsers, siteStatus] = await Promise.all([
            db.prepare('SELECT COUNT(*) AS total FROM users').first<any>(),
            db.prepare('SELECT COUNT(*) AS total FROM articles').first<any>(),
            db.prepare('SELECT COUNT(*) AS total FROM tickets').first<any>(),
            db.prepare("SELECT COUNT(*) AS total FROM reports WHERE status = 'pending'").first<any>(),
            db.prepare("SELECT COUNT(*) AS total FROM users WHERE last_active_at >= datetime('now', '-5 minutes')").first<any>(),
            db.prepare("SELECT COUNT(*) AS total FROM users WHERE date(created_at) = date('now')").first<any>(),
            db.prepare("SELECT setting_value FROM site_settings WHERE setting_key = 'site_status'").first<any>(),
        ]);
        const shortcuts = (Object.keys(sectionNames) as AdminSection[])
            .filter(key => key !== 'dashboard' && (key === 'security'
                ? hasAny(user, ['admin.security.reports.view', 'admin.security.audit.view'])
                : key === 'site'
                    ? hasAny(user, ['admin.site.settings.edit', 'admin.site.banners.manage', 'admin.site.announcements.manage'])
                    : key === 'content'
                        ? hasAny(user, ['admin.content.articles.view', 'admin.content.tickets.view'])
                        : hasAdminPermission(user, getAdminSectionPermission(key))))
            .map(key => `<a class="admin-shortcut" href="${sectionPaths[key]}"><span class="admin-shortcut-icon"><i class="fas ${sectionIcons[key]}"></i></span><span><strong>${sectionNames[key]}</strong><small>${key === 'user' ? '账号资料、权限与登录问题' : key === 'content' ? '文章与工单处理' : key === 'security' ? '举报处置和操作记录' : key === 'site' ? '站点状态、公告和导出' : key === 'permissions' ? '精确分配管理节点' : '待审核项目集中处理'}</small></span></a>`)
            .join('');
        body = panel('站点概况', 'fa-chart-simple', `<div class="admin-stat-grid">
            <div class="admin-stat"><div class="admin-stat-label">注册用户</div><div class="admin-stat-value">${Number(users?.total || 0)}</div><div class="admin-stat-note">今日新增 ${Number(newUsers?.total || 0)}</div></div>
            <div class="admin-stat"><div class="admin-stat-label">近 5 分钟活跃</div><div class="admin-stat-value">${Number(activeUsers?.total || 0)}</div><div class="admin-stat-note">当前活跃账号</div></div>
            <div class="admin-stat"><div class="admin-stat-label">文章</div><div class="admin-stat-value">${Number(articles?.total || 0)}</div><div class="admin-stat-note">站内文章总数</div></div>
            <div class="admin-stat"><div class="admin-stat-label">工单</div><div class="admin-stat-value">${Number(tickets?.total || 0)}</div><div class="admin-stat-note">站内工单总数</div></div>
            <div class="admin-stat"><div class="admin-stat-label">待处理举报</div><div class="admin-stat-value">${Number(reports?.total || 0)}</div><div class="admin-stat-note">站点状态：${htmlEscape(siteStatus?.setting_value || 'normal')}</div></div>
        </div>`);
        body += panel('快捷入口', 'fa-arrow-right', `<div class="admin-shortcuts">${shortcuts || '<p class="admin-muted">当前账号尚未获分配其他管理分区。</p>'}</div>`);
        if (hasAdminPermission(user, 'admin.dashboard.view')) {
            const [pendingTeams, pendingOj] = await Promise.all([
                db.prepare("SELECT COUNT(*) AS total FROM team_creation_requests WHERE status = 'pending'").first<any>(),
                db.prepare("SELECT COUNT(*) AS total FROM oj_proposals WHERE status = 'pending'").first<any>(),
            ]);
            body += panel('待审核', 'fa-inbox', `<div class="admin-list">
                ${user.id === 1 ? `<div class="admin-list-item"><span>团队创建申请</span><a class="admin-btn" href="/team/requests">查看 ${Number(pendingTeams?.total || 0)} 条 <i class="fas fa-arrow-up-right-from-square"></i></a></div><div class="admin-list-item"><span>OJ 投题</span><a class="admin-btn" href="/oj/proposals">查看 ${Number(pendingOj?.total || 0)} 条 <i class="fas fa-arrow-up-right-from-square"></i></a></div>` : '<div class="admin-muted">审核队列由 superuser 处理。</div>'}
            </div>`);
        }
    } else if (section === 'user') {
        if (!hasAdminPermission(user, 'admin.users.view')) {
            body = panel('权限不足', 'fa-lock', '<p class="admin-muted">需要 admin.users.view 节点。</p>');
        } else {
            const users = await db.prepare('SELECT id, username, color, tag, admin, admin_roles, admin_permissions, use, speak, last_ip, last_login_at, created_at FROM users ORDER BY id DESC LIMIT 500').all<any>();
            const rows = users.results.map((target: any) => {
                const actions: string[] = [];
                if (hasAdminPermission(user, 'admin.users.profile.edit')) actions.push(`<details class="admin-details"><summary>编辑资料</summary><form class="admin-inline-form" action="/api/admin/user/${target.id}" method="POST"><input type="hidden" name="mode" value="profile"><select name="color">${['purple','red','orange','yellow','green','cyan','blue','rainbow','gray'].map(color => `<option value="${color}" ${target.color === color ? 'selected' : ''}>${color}</option>`).join('')}</select><input name="tag" type="text" maxlength="30" value="${htmlEscape(target.tag || '')}" placeholder="标签"><button class="admin-btn primary" type="submit">保存</button></form></details>`);
                if (hasAdminPermission(user, 'admin.users.permissions.edit')) actions.push(`<details class="admin-details"><summary>调整站点权限</summary><form class="admin-inline-form" action="/api/admin/user/${target.id}" method="POST"><input type="hidden" name="mode" value="permission"><select name="permission" required><option value="">选择权限</option><option value="use">进入主站</option><option value="speak">自由发言</option><option value="admin">管理员</option></select><select name="action" required><option value="grant">授予</option><option value="revoke">撤销</option></select><input name="reason" type="text" maxlength="300" placeholder="处理原因"><button class="admin-btn primary" type="submit">执行</button></form></details>`);
                if (hasAdminPermission(user, 'admin.users.avatar.clear')) actions.push(`<form class="admin-inline-form" action="/api/admin/user/${target.id}/avatar/delete" method="POST" onsubmit="return confirm('确认清除此用户头像？')"><button class="admin-btn" type="submit">清除头像</button></form>`);
                if (hasAdminPermission(user, 'admin.users.delete') && target.id !== 1) actions.push(`<form class="admin-inline-form" action="/api/admin/user/${target.id}/delete" method="POST" onsubmit="return confirm('确定删除用户 ${htmlEscape(target.username)}？此操作不可撤销。')"><input name="reason" type="hidden" value="后台用户管理"><button class="admin-btn danger" type="submit">删除</button></form>`);
                const login = target.last_login_at ? `${formatTimeToChina(target.last_login_at)}<br><span class="admin-muted">${htmlEscape(target.last_ip || '未知 IP')}</span>` : '<span class="admin-muted">暂无登录记录</span>';
                return `<tr data-user-search="${htmlEscape(`${target.id} ${target.username}`.toLowerCase())}"><td>${target.id}</td><td>${renderUsernameLink(target.username, target.color, target.tag, target.id)}${target.admin ? '<br><span class="admin-chip">管理员</span>' : ''}</td><td><span class="admin-chip">${target.use ? '可登录' : '已停用'}</span> <span class="admin-chip">${target.speak ? '可发言' : '禁言'}</span></td><td>${login}</td><td>${formatTimeToChina(target.created_at)}</td><td class="admin-actions-cell"><div class="admin-row-actions">${actions.join('') || '<span class="admin-muted">只读</span>'}</div></td></tr>`;
            }).join('');
            body = panel('账号目录', 'fa-users', `<div class="admin-toolbar"><span class="admin-muted">显示最近 500 个账号</span><input class="admin-search" type="search" id="adminUserSearch" placeholder="按 UID 或用户名筛选" aria-label="搜索用户"></div><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>UID</th><th>账号</th><th>状态</th><th>最近登录</th><th>注册时间</th><th>操作</th></tr></thead><tbody>${rows || '<tr><td colspan="6" class="admin-empty">暂无账号</td></tr>'}</tbody></table></div><script>document.getElementById('adminUserSearch')?.addEventListener('input',function(){var q=this.value.trim().toLowerCase();document.querySelectorAll('[data-user-search]').forEach(function(row){row.hidden=!row.dataset.userSearch.includes(q)})})</script>`);
        }
    } else if (section === 'content') {
        const canArticles = hasAdminPermission(user, 'admin.content.articles.view');
        const canTickets = hasAdminPermission(user, 'admin.content.tickets.view');
        if (canArticles) {
            const articles = await db.prepare('SELECT a.id, a.hex_id, a.title, a.category, a.is_pinned, a.is_locked, a.created_at, u.username FROM articles a LEFT JOIN users u ON u.id = a.author_id ORDER BY a.id DESC LIMIT 100').all<any>();
            const rows = articles.results.map((article: any) => `<tr><td>${article.id}</td><td><a href="/articles/${encodeURIComponent(article.hex_id)}">${htmlEscape(article.title || '无标题')}</a><br><span class="admin-muted">${htmlEscape(article.username || '未知')} · ${formatTimeToChina(article.created_at)}</span></td><td>${htmlEscape(article.category || 'other')} ${article.is_pinned ? '<span class="admin-chip">置顶</span>' : ''} ${article.is_locked ? '<span class="admin-chip">已锁定</span>' : ''}</td><td><div class="admin-row-actions">${hasAdminPermission(user, 'admin.content.articles.edit') ? `<form class="admin-inline-form" action="/api/admin/article/${article.id}/category" method="POST"><select name="category">${['leisure','culture','technology','programming','life','announcement','other'].map(value => `<option value="${value}" ${article.category === value ? 'selected' : ''}>${value}</option>`).join('')}</select><button class="admin-btn" type="submit">分类</button></form>` : ''}${hasAdminPermission(user, 'admin.content.articles.moderate') ? `<form action="/api/admin/article/${article.id}/pin" method="POST"><button class="admin-btn" type="submit">${article.is_pinned ? '取消置顶' : '置顶'}</button></form><form action="/api/admin/article/${article.id}/lock" method="POST"><button class="admin-btn" type="submit">${article.is_locked ? '解锁' : '锁定'}</button></form>` : ''}${hasAdminPermission(user, 'admin.content.articles.delete') ? `<form action="/api/admin/article/${article.id}/delete" method="POST" onsubmit="return confirm('确认删除文章？')"><button class="admin-btn danger" type="submit">删除</button></form>` : ''}</div></td></tr>`).join('');
            body += panel('文章', 'fa-file-lines', `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>ID</th><th>标题与作者</th><th>状态</th><th>操作</th></tr></thead><tbody>${rows || '<tr><td colspan="4" class="admin-empty">暂无文章</td></tr>'}</tbody></table></div>`);
        }
        if (canTickets) {
            const tickets = await db.prepare('SELECT t.id, t.title, t.status, t.created_at, u.username FROM tickets t LEFT JOIN users u ON u.id = t.author_id ORDER BY t.id DESC LIMIT 100').all<any>();
            body += panel('工单', 'fa-ticket', `<div class="admin-list">${tickets.results.map((ticket: any) => {
                const status = getTicketStatus(ticket.status);
                return `<div class="admin-list-item"><span><a href="/ticket/${ticket.id}">#${ticket.id} ${htmlEscape(ticket.title)}</a><br><span class="admin-muted">${htmlEscape(ticket.username || '未知')} · ${formatTimeToChina(ticket.created_at)}</span></span><span class="admin-row-actions"><span class="admin-chip">${status.label}</span>${hasAdminPermission(user, 'admin.content.tickets.delete') ? `<form action="/api/admin/ticket/${ticket.id}/delete" method="POST" onsubmit="return confirm('确认删除工单？')"><button class="admin-btn danger" type="submit">删除</button></form>` : ''}</span></div>`;
            }).join('') || '<div class="admin-empty">暂无工单</div>'}</div>`);
        }
    } else if (section === 'security') {
        if (hasAdminPermission(user, 'admin.security.reports.view')) {
            const reports = await db.prepare("SELECT r.*, u.username AS reporter_name FROM reports r LEFT JOIN users u ON r.reporter_id = u.id WHERE r.status = 'pending' ORDER BY r.id DESC LIMIT 100").all<any>();
            body += panel('待处理举报', 'fa-flag', reports.results.map((report: any) => `<article class="admin-list-item"><div><strong>#${report.id} ${htmlEscape(report.target_type)} · ${report.target_id}</strong><div class="admin-muted">举报人 ${htmlEscape(report.reporter_name || '未知')} · ${formatTimeToChina(report.created_at)}</div><p>${htmlEscape(report.reason || '未填写原因')}</p><p class="admin-muted">证据：${htmlEscape(report.evidence || '无')}</p>${hasAdminPermission(user, 'admin.security.reports.resolve') ? `<form class="admin-inline-form" action="/api/reports/${report.id}/decision" method="POST"><input type="hidden" name="status" value="resolved"><input name="resolution" type="text" required placeholder="处理结论与理由"><button class="admin-btn primary" type="submit">确认违规</button></form><form action="/api/reports/${report.id}/decision" method="POST"><input type="hidden" name="status" value="dismissed"><input type="hidden" name="resolution" value="核实后驳回举报。"><button class="admin-btn" type="submit">驳回</button></form>` : '<span class="admin-chip">只读</span>'}</div></article>`).join('') || '<div class="admin-empty">暂无待处理举报</div>');
        }
        if (hasAdminPermission(user, 'admin.security.audit.view')) {
            const logs = await db.prepare('SELECT a.*, u.username AS admin_name FROM audit_logs a LEFT JOIN users u ON u.id = a.admin_id ORDER BY a.id DESC LIMIT 100').all<any>();
            body += panel('操作审计', 'fa-clipboard-list', `<div class="admin-list">${logs.results.map((log: any) => `<div class="admin-list-item"><span><strong>${htmlEscape(log.action)}</strong><br><span class="admin-muted">${htmlEscape(log.admin_name || '未知')} · ${formatTimeToChina(log.created_at)} · ${htmlEscape(log.target_type || '')} #${Number(log.target_id || 0)}</span></span><span class="admin-muted">${htmlEscape(log.details || '')}</span></div>`).join('') || '<div class="admin-empty">暂无审计记录</div>'}</div>`);
        }
    } else if (section === 'reviews') {
        const [pendingTeams, pendingOj, pendingTickets] = await Promise.all([
            db.prepare("SELECT COUNT(*) AS total FROM team_creation_requests WHERE status = 'pending'").first<any>(),
            db.prepare("SELECT COUNT(*) AS total FROM oj_proposals WHERE status = 'pending'").first<any>(),
            db.prepare("SELECT COUNT(*) AS total FROM tickets WHERE status = 'pending'").first<any>(),
        ]);
        body = panel('待办队列', 'fa-inbox', `<div class="admin-shortcuts"><a class="admin-shortcut" href="/backend/content"><span class="admin-shortcut-icon"><i class="fas fa-ticket"></i></span><span><strong>待处理工单</strong><small>${Number(pendingTickets?.total || 0)} 个 · 前往内容管理</small></span></a>${user.id === 1 ? `<a class="admin-shortcut" href="/team/requests"><span class="admin-shortcut-icon"><i class="fas fa-people-group"></i></span><span><strong>团队申请</strong><small>${Number(pendingTeams?.total || 0)} 个待审核</small></span></a><a class="admin-shortcut" href="/oj/proposals"><span class="admin-shortcut-icon"><i class="fas fa-code"></i></span><span><strong>OJ 投题</strong><small>${Number(pendingOj?.total || 0)} 个待审核</small></span></a>` : ''}</div>`);
    } else if (section === 'site') {
        if (hasAdminPermission(user, 'admin.site.settings.edit')) {
            const status = await db.prepare("SELECT setting_value FROM site_settings WHERE setting_key = 'site_status'").first<any>();
            body += panel('站点状态', 'fa-satellite-dish', `<form class="admin-inline-form" action="/api/admin/site-status" method="POST"><select name="status"><option value="normal" ${status?.setting_value === 'normal' ? 'selected' : ''}>正常运行</option><option value="limited" ${status?.setting_value === 'limited' ? 'selected' : ''}>限流提示</option><option value="maintenance" ${status?.setting_value === 'maintenance' ? 'selected' : ''}>维护中</option></select><button class="admin-btn primary" type="submit">保存状态</button></form>`);
        }
        if (hasAdminPermission(user, 'admin.site.banners.manage')) {
            const banners = await db.prepare('SELECT * FROM banners ORDER BY sort_order, id').all<any>();
            body += panel('轮播图', 'fa-images', `<form class="admin-inline-form" action="/api/admin/banner/add" method="POST"><input type="url" name="image_url" required placeholder="图片 URL"><input type="url" name="link_url" placeholder="跳转链接"><input type="number" name="sort_order" value="0" aria-label="排序"><button class="admin-btn primary" type="submit">新增</button></form><div class="admin-list">${banners.results.map((item: any) => `<div class="admin-list-item"><span>${htmlEscape(item.image_url)}<br><span class="admin-muted">排序 ${Number(item.sort_order || 0)}</span></span><form action="/api/admin/banner/${item.id}/delete" method="POST"><button class="admin-btn danger" type="submit">删除</button></form></div>`).join('') || '<div class="admin-empty">暂无轮播图</div>'}</div>`);
        }
        if (hasAdminPermission(user, 'admin.site.announcements.manage')) {
            const announcements = await db.prepare('SELECT * FROM announcements ORDER BY sort_order, id DESC').all<any>();
            body += panel('公告', 'fa-bullhorn', `<form class="admin-inline-form" action="/api/admin/announcement/add" method="POST"><input type="text" name="content" required placeholder="公告内容"><input type="number" name="sort_order" value="0" aria-label="排序"><select name="announcement_type"><option value="notice">通知</option><option value="warning">警告</option><option value="urgent">紧急</option></select><select name="display_scope"><option value="all">全站</option><option value="home">首页</option><option value="backend">后台</option></select><button class="admin-btn primary" type="submit">发布</button></form><div class="admin-list">${announcements.results.map((item: any) => `<div class="admin-list-item"><span>${htmlEscape(item.content)}<br><span class="admin-muted">${htmlEscape(item.announcement_type || 'notice')} · ${htmlEscape(item.display_scope || 'all')}</span></span><form action="/api/admin/announcement/${item.id}/delete" method="POST"><button class="admin-btn danger" type="submit">删除</button></form></div>`).join('') || '<div class="admin-empty">暂无公告</div>'}</div>`);
        }
        if (hasAdminPermission(user, 'admin.site.export')) {
            body += panel('数据导出', 'fa-download', '<div class="admin-row-actions">' + ['users','tickets','reports','audit'].map(type => `<a class="admin-btn" href="/api/admin/export/${type}?format=csv" download>${type.toUpperCase()} CSV <i class="fas fa-download"></i></a>`).join('') + '</div>');
        }
    } else if (section === 'permissions') {
        if (user.id !== 1) {
            body = panel('权限节点', 'fa-lock', '<div class="admin-notice">只有 UID 1 可以分配或撤销管理员权限节点。</div>');
        } else {
            const admins = await db.prepare('SELECT id, username, color, tag, admin_permissions FROM users WHERE admin = 1 ORDER BY id').all<any>();
            const groups = [...new Set(ADMIN_PERMISSION_NODES.map(node => node.group))];
            body = panel('管理员权限分配', 'fa-key', '<div class="admin-notice">节点支持精确授权（如 <code>admin.users.profile.edit</code>）及末尾通配符（如 <code>admin.users.*</code>）。UID 1 始终拥有完整权限且不可编辑。</div><div class="admin-list">' + admins.results.map((admin: any) => {
                const assigned = parseAdminPermissions(admin.admin_permissions);
                if (Number(admin.id) === 1) return `<div class="admin-list-item"><span>${renderUsernameLink(admin.username, admin.color, admin.tag, admin.id)} · UID 1 <span class="admin-chip">系统超级管理员</span></span><span class="admin-muted">全部节点</span></div>`;
                const options = groups.map(group => `<fieldset class="admin-permission-group"><strong>${group}</strong>${ADMIN_PERMISSION_NODES.filter(node => node.group === group).map(node => `<label class="admin-permission-option"><input type="checkbox" name="permission" value="${node.key}" ${hasAdminPermission({ id: admin.id, admin: 1, admin_permissions: JSON.stringify(assigned) }, node.key) ? 'checked' : ''}><span>${node.label}<br><code>${node.key}</code></span></label>`).join('')}</fieldset>`).join('');
                const custom = assigned.filter(pattern => pattern === '*' || pattern.endsWith('.*') || !ADMIN_PERMISSION_NODES.some(node => node.key === pattern)).join('\n');
                return `<form class="admin-list-item" action="/api/admin/permissions" method="POST" style="align-items:flex-start"><input type="hidden" name="user_id" value="${admin.id}"><div style="width:100%"><div style="margin-bottom:7px">${renderUsernameLink(admin.username, admin.color, admin.tag, admin.id)} · UID ${admin.id}</div><div class="admin-permission-form"><div class="admin-permission-groups">${options}</div><label class="admin-muted">通配符 / 自定义节点（每行一个）</label><textarea name="custom_permissions" rows="2" style="display:block;width:100%;margin:5px 0" placeholder="admin.users.*">${htmlEscape(custom)}</textarea><button class="admin-btn primary" type="submit"><i class="fas fa-floppy-disk"></i> 保存该管理员节点</button></div></div></form>`;
            }).join('') + '</div>');
        }
    }

    if (!body) body = panel('暂无可操作内容', 'fa-circle-info', '<p class="admin-muted">当前账号没有可见的管理节点。</p>');
    return await getLayout(env, user, `管理后台 · ${sectionNames[section]}`, adminShell(user, section, body), styles, req);
}