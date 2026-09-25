import { getSessionUser } from '../utils/auth';
import { getLayout } from '../utils/layout';
import { htmlEscape, renderUsernameLink } from '../utils/html';
import { contestScheduleState, getUserTeams } from '../handlers/contest';
import type { Env } from '../env.d';

export async function renderContestList(env: Env, request: Request): Promise<string> {
    const user = await getSessionUser(env, request);
    const rows = await env.DB.prepare(`
        SELECT c.*, (SELECT COUNT(*) FROM contest_enrollments ce WHERE ce.contest_id = c.id AND ce.status = 'enrolled') AS enrolled_count
        FROM contests c
        ORDER BY c.start_at DESC, c.id DESC
    `).all<any>();
    const contests = rows.results || [];
    const content = `
        <div class="page-header">
            <h1><i class="fas fa-trophy"></i> 比赛中心</h1>
            <p style="margin-top:4px;">查看 IOI / 团队赛信息、比赛时间和报名状态。</p>
        </div>
        <div class="card">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px;">
                <strong>当前赛程</strong>
                <a href="/oj" style="color:#8E44AD;text-decoration:none;">前往 OJ 题库</a>
            </div>
            ${contests.length ? contests.map((contest: any) => {
                const state = contestScheduleState(contest.start_at, contest.end_at);
                const labelMap = { scheduled: '未开始', running: '进行中', ended: '已结束' };
                const modeLabel = contest.participation_mode === 'team' ? '团队赛' : '公开赛';
                return `
                    <div style="border:1px solid #eee;border-radius:10px;padding:14px 16px;margin-bottom:12px;background:#faf9ff;">
                        <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-start;">
                            <div>
                                <h2 style="margin:0 0 6px;font-size:18px;"><a href="/contest/${contest.id}" style="color:#8E44AD;text-decoration:none;">${htmlEscape(contest.title || `比赛 #${contest.id}`)}</a></h2>
                                <p style="margin:0;color:#555;">${htmlEscape(contest.description || '暂无简介。')}</p>
                            </div>
                            <span style="padding:4px 10px;border-radius:999px;background:#f2eafa;color:#73419b;font-size:12px;font-weight:700;">${labelMap[state as keyof typeof labelMap]}</span>
                        </div>
                        <div style="margin-top:10px;color:#666;font-size:13px;display:flex;gap:18px;flex-wrap:wrap;">
                            <span>模式：${modeLabel}</span>
                            <span>IOI：${contest.is_ioi ? '是' : '否'}</span>
                            <span>开始：${contest.start_at ? htmlEscape(contest.start_at) : '待定'}</span>
                            <span>结束：${contest.end_at ? htmlEscape(contest.end_at) : '待定'}</span>
                            <span>已报名：${Number(contest.enrolled_count || 0)}</span>
                        </div>
                    </div>
                `;
            }).join('') : '<div class="oj-muted">暂无比赛，等待管理员发布赛程。</div>'}
        </div>
    `;
    return getLayout(env, user, '比赛中心', content, '', request);
}

export async function renderContestDetail(env: Env, request: Request, path: string): Promise<string> {
    const user = await getSessionUser(env, request);
    const contestId = Number(path.split('/')[2] || 0);
    const contest = contestId > 0 ? await env.DB.prepare(`
        SELECT c.*, u.username AS organizer_name,
               (SELECT COUNT(*) FROM contest_enrollments ce WHERE ce.contest_id = c.id AND ce.status = 'enrolled') AS enrolled_count
        FROM contests c
        LEFT JOIN users u ON u.id = c.organizer_id
        WHERE c.id = ?
    `).bind(contestId).first<any>() : null;
    if (!contest) return getLayout(env, user, '比赛不存在', '<div class="card">比赛不存在或已被移除。</div>', '', request);

    const state = contestScheduleState(contest.start_at, contest.end_at);
    const enrolled = user ? await env.DB.prepare('SELECT * FROM contest_enrollments WHERE contest_id = ? AND user_id = ?').bind(contestId, user.id).first<any>() : null;
    const teamChoices = user ? await getUserTeams(env, user.id) : [];
    const modeLabel = contest.participation_mode === 'team' ? '团队赛' : '公开赛';
    const stateLabel = { scheduled: '未开始', running: '进行中', ended: '已结束' }[state] || '进行中';

    const enrollForm = !user ? '<div class="card"><p>登录后即可报名比赛。</p><a href="/login?redirect=' + encodeURIComponent('/contest/' + contestId) + '" style="color:#8E44AD;text-decoration:none;">前往登录</a></div>' : `
        <div class="card">
            <h2 style="margin-top:0;">报名状态</h2>
            ${enrolled ? '<p>已报名：' + htmlEscape(enrolled.status || 'enrolled') + '</p>' : '<p>尚未报名。</p>'}
            ${contest.participation_mode === 'team' ? `
                <form method="POST" action="/api/contests/${contestId}/enroll">
                    <label style="display:block;margin-bottom:8px;">团队：
                        <select name="team_id" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;">
                            ${teamChoices.length ? teamChoices.map((team: any) => `<option value="${team.team_id}">${htmlEscape(team.name)}</option>`).join('') : '<option value="">你当前没有可用团队</option>'}
                        </select>
                    </label>
                    <button type="submit" class="oj-submit" ${teamChoices.length ? '' : 'disabled'}>${enrolled ? '更新报名' : '报名比赛'}</button>
                </form>
            ` : `
                <form method="POST" action="/api/contests/${contestId}/enroll">
                    <button type="submit" class="oj-submit">${enrolled ? '重新报名' : '报名比赛'}</button>
                </form>
            `}
        </div>
    `;

    const content = `
        <div class="page-header">
            <h1><i class="fas fa-trophy"></i> ${htmlEscape(contest.title || `比赛 #${contest.id}`)}</h1>
            <p style="margin-top:4px;"><a href="/contest" style="color:#8E44AD;text-decoration:none;">← 返回比赛中心</a></p>
        </div>
        <div class="oj-layout">
            <article class="card">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px;">
                    <span style="padding:4px 10px;border-radius:999px;background:#f2eafa;color:#73419b;font-size:12px;font-weight:700;">${stateLabel}</span>
                    <span class="oj-muted">${modeLabel} · IOI ${contest.is_ioi ? '模式' : '非 IOI'}</span>
                </div>
                <div class="markdown-content">${htmlEscape(contest.description || '暂无比赛说明。')}</div>
                <dl class="oj-submission-fields">
                    <div><dt>开始时间</dt><dd>${htmlEscape(contest.start_at || '待定')}</dd></div>
                    <div><dt>结束时间</dt><dd>${htmlEscape(contest.end_at || '待定')}</dd></div>
                    <div><dt>主办方</dt><dd>${renderUsernameLink(contest.organizer_name || '系统', 'purple', '', Number(contest.organizer_id || 0))}</dd></div>
                    <div><dt>已报名</dt><dd>${Number(contest.enrolled_count || 0)}</dd></div>
                </dl>
            </article>
            <aside>
                ${enrollForm}
                <div class="card">
                    <h2 style="margin-top:0;">题目权限</h2>
                    <p class="oj-muted">比赛题目仅对已报名并在赛程内的用户开放。</p>
                    <a href="/oj?cid=${contestId}" style="color:#8E44AD;text-decoration:none;">进入比赛题库</a>
                </div>
            </aside>
        </div>
    `;
    return getLayout(env, user, contest.title || `比赛 #${contest.id}`, content, '', request);
}
