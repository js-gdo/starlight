import { getSessionUser } from '../utils/auth';
import { getLayout } from '../utils/layout';
import { htmlEscape, renderUsernameLink } from '../utils/html';
import { contestScheduleState, ensureUserCanViewContestLeaderboard } from '../handlers/contest';
import type { Env } from '../env.d';

const CONTEST_STYLES = `
    .contest-page .page-header{margin-bottom:18px}
    .contest-page .page-header h1{font-size:clamp(24px,4vw,34px);letter-spacing:-.025em}
    .contest-page .page-header p{color:#777}
    .contest-create-card{max-width:820px;margin:0 auto;padding:clamp(16px,3vw,28px);border:1px solid #eee7f4;border-radius:16px;background:linear-gradient(150deg,#fff,#fcf9ff);box-shadow:0 12px 32px #39234c0d}
    .contest-create-card form{gap:16px!important}
    .contest-create-card label{color:#493952;font-size:13px;font-weight:700}
    .contest-create-card input:not([type=hidden]),.contest-create-card textarea,.contest-create-card select{margin-top:6px}
    .contest-create-card input:focus,.contest-create-card textarea:focus,.contest-create-card select:focus{outline:2px solid #eadcf4;border-color:#8e44ad!important}
    .contest-list-shell{padding:clamp(14px,3vw,24px);border:1px solid #eee7f4;border-radius:16px;background:#fff;box-shadow:0 12px 30px #39234c0a}
    .contest-list-card{padding:18px;border:1px solid #eee8f3;border-radius:13px;margin:12px 0;background:linear-gradient(135deg,#fff,#fcfaff);transition:transform .18s ease,box-shadow .18s ease}
    .contest-list-card:hover{transform:translateY(-2px);box-shadow:0 10px 26px #39234c12}
    .contest-list-card h2{font-size:19px}
    .contest-list-card h2 a{color:#39234c!important;text-decoration:none}
    .contest-list-card h2 a:hover{color:#8e44ad!important}
    .contest-list-card p{line-height:1.65}
    .contest-list-meta{display:flex;gap:8px 18px;flex-wrap:wrap;margin-top:13px;color:#777;font-size:12px}
    .contest-state-pill{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:99px;background:#f1eafa;color:#754092;font-size:11px;font-weight:800;white-space:nowrap}
    .contest-detail-layout{grid-template-columns:minmax(0,1.55fr) minmax(260px,.8fr)!important}
    .contest-detail-hero{padding:clamp(16px,3vw,26px);border:1px solid #eee7f4;background:linear-gradient(145deg,#fff,#fbf7ff);box-shadow:0 10px 28px #39234c0a}
    .contest-detail-hero h2{color:#39234c}
    .contest-detail-hero .markdown-content{line-height:1.75;color:#5d5363}
    .contest-detail-facts{margin-top:20px}
    .contest-detail-facts div{border:1px solid #eee9f2!important;background:#fff!important}
    .contest-enrollment-card,.contest-info-card,.contest-problems-card{border:1px solid #eee7f4;box-shadow:0 8px 24px #39234c0a}
    .contest-enrollment-card h2,.contest-info-card h2,.contest-problems-card h2{color:#39234c}
    .contest-problems-card ol{padding-left:24px}
    .contest-problems-card li{padding:7px 0;color:#777}
    .contest-review-box{margin-top:14px;padding:14px;border:1px solid #eadcf4;border-radius:11px;background:#faf6ff}
    .contest-page button,.contest-page .oj-submit{border:0;border-radius:8px;padding:10px 14px;background:#78439a;color:#fff;font-weight:700;cursor:pointer}
    .contest-page button:hover,.contest-page .oj-submit:hover{background:#63357f}
    @media(max-width:760px){.contest-detail-layout{grid-template-columns:1fr!important}.contest-list-card{padding:14px}}
`;

export async function renderContestCreate(env: Env, request: Request, path: string): Promise<string> {
    const user = await getSessionUser(env, request);
    const teamId = Number(path.split('/')[2] || 0);
    const team = Number.isSafeInteger(teamId) && teamId > 0
        ? await env.DB.prepare(
            `SELECT t.id, t.name FROM teams t
             JOIN team_members tm ON tm.team_id = t.id
             WHERE t.id = ? AND t.status = 'active' AND tm.user_id = ?
               AND tm.status = 'approved' AND tm.role IN ('owner', 'admin')`
        ).bind(teamId, user?.id || 0).first<any>()
        : null;
    if (!user || !team) {
        return getLayout(env, user, '创建团队赛', '<div class="card">仅团队创建者或管理员可以创建团队赛。</div>', '', request);
    }
    const content = `
        <div class="page-header">
            <h1><i class="fas fa-trophy"></i> 在「${htmlEscape(team.name)}」创建团队赛</h1>
            <p style="margin-top:4px;"><a href="/team/${teamId}">返回团队</a></p>
        </div>
        <div class="card contest-create-card">
            <form id="contestCreateForm" style="display:grid;gap:12px;">
                <input type="hidden" name="team_id" value="${teamId}">
                <label>比赛名称<input name="title" required maxlength="120" style="display:block;width:100%;box-sizing:border-box;padding:9px;border:1px solid #ddd;border-radius:6px;"></label>
                <label>比赛说明<textarea name="description" maxlength="5000" rows="4" style="display:block;width:100%;box-sizing:border-box;padding:9px;border:1px solid #ddd;border-radius:6px;"></textarea></label>
                <label>开始时间（北京时间）<input name="start_at" type="datetime-local" required style="display:block;padding:9px;border:1px solid #ddd;border-radius:6px;"></label>
                <label>结束时间（北京时间）<input name="end_at" type="datetime-local" required style="display:block;padding:9px;border:1px solid #ddd;border-radius:6px;"></label>
                <div>
                    <label for="contestProblemSelect">添加赛题（公开题及已审核比赛题；每题 100 分，最多 50 题）</label>
                    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;">
                        <select id="contestProblemSelect" style="flex:1;min-width:220px;padding:9px;border:1px solid #ddd;border-radius:6px;"><option>正在加载题目…</option></select>
                        <button id="addContestProblem" type="button">添加题目</button>
                    </div>
                    <div id="contestProblemState" role="status" style="margin-top:6px;color:#777;font-size:13px;"></div>
                    <div id="contestProblemList" style="display:grid;gap:6px;margin-top:8px;"></div>
                </div>
                <div id="contestCreateStatus" role="status" style="white-space:pre-wrap;color:#a33;"></div>
                <button type="submit" style="justify-self:start;padding:9px 16px;border:0;border-radius:6px;background:#8E44AD;color:#fff;cursor:pointer;">创建团队赛</button>
            </form>
        </div>
        <script>
        (function() {
            var form = document.getElementById('contestCreateForm');
            var select = document.getElementById('contestProblemSelect');
            var list = document.getElementById('contestProblemList');
            var state = document.getElementById('contestProblemState');
            var status = document.getElementById('contestCreateStatus');
            var selected = new Map();
            function escapeHtml(value) {
                return String(value).replace(/[&<>"']/g, function(c) {
                    return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];
                });
            }
            function draw() {
                list.innerHTML = Array.from(selected.values()).map(function(problem, index) {
                    return '<div style="display:flex;justify-content:space-between;gap:8px;padding:8px;border:1px solid #eee;border-radius:6px;">' +
                        '<span>' + (index + 1) + '. ' + escapeHtml(problem.id) + ' · ' + escapeHtml(problem.title) + ' · 100 分' +
                        '<input type="hidden" name="problem_id" value="' + escapeHtml(problem.id) + '"></span>' +
                        '<button type="button" data-remove="' + escapeHtml(problem.id) + '">移除</button></div>';
                }).join('');
                list.querySelectorAll('[data-remove]').forEach(function(button) {
                    button.addEventListener('click', function() {
                        selected.delete(button.getAttribute('data-remove'));
                        draw();
                    });
                });
                state.textContent = selected.size + ' / 50 道题';
            }
            fetch('/api/contests/available-problems?tid=${teamId}', { headers: { Accept: 'application/json' } })
                .then(function(response) {
                    return response.json().then(function(data) {
                        if (!response.ok) throw new Error(data.error || 'HTTP ' + response.status);
                        return data;
                    });
                })
                .then(function(data) {
                    select.innerHTML = '';
                    (Array.isArray(data.problems) ? data.problems : []).forEach(function(problem) {
                        var option = document.createElement('option');
                        option.value = problem.id;
                        option.textContent = problem.id + ' · ' + problem.title + (problem.category === 'contest' ? '（比赛题）' : '（公开题）');
                        option.dataset.title = problem.title;
                        select.appendChild(option);
                    });
                    if (!select.options.length) select.add(new Option('暂无可用题目', ''));
                })
                .catch(function(error) {
                    select.innerHTML = '<option value="">题目列表加载失败</option>';
                    status.textContent = error.message;
                });
            document.getElementById('addContestProblem').addEventListener('click', function() {
                var option = select.selectedOptions[0];
                if (!option || !option.value) return;
                if (selected.has(option.value)) return;
                if (selected.size >= 50) {
                    status.textContent = '比赛最多只能添加 50 道题目。';
                    return;
                }
                selected.set(option.value, { id: option.value, title: option.dataset.title || option.textContent });
                status.textContent = '';
                draw();
            });
            form.addEventListener('submit', function(event) {
                event.preventDefault();
                status.textContent = '';
                if (!selected.size) {
                    status.textContent = '请至少添加一道赛题。';
                    return;
                }
                var button = form.querySelector('button[type="submit"]');
                button.disabled = true;
                fetch('/api/contests', { method: 'POST', body: new FormData(form) })
                    .then(function(response) {
                        return response.json().then(function(data) {
                            if (!response.ok) throw new Error(data.error || 'HTTP ' + response.status);
                            return data;
                        });
                    })
                    .then(function(data) { location.href = '/contest/' + data.contest_id; })
                    .catch(function(error) { status.textContent = error.message; })
                    .finally(function() { button.disabled = false; });
            });
        }());
        </script>
    `;
    return getLayout(env, user, '创建团队赛', `<div class="contest-page">${content}</div>`, CONTEST_STYLES, request);
}

export async function renderContestList(env: Env, request: Request): Promise<string> {
    const user = await getSessionUser(env, request);
    const rows = await env.DB.prepare(`
        SELECT c.*, t.name AS team_name,
               (SELECT COUNT(*) FROM contest_enrollments ce WHERE ce.contest_id = c.id AND ce.status = 'enrolled') AS enrolled_count
        FROM contests c LEFT JOIN teams t ON t.id = c.team_id
        WHERE c.participation_mode = 'public'
           OR EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id = c.team_id AND tm.user_id = ? AND tm.status = 'approved')
        ORDER BY c.start_at DESC, c.id DESC
    `).bind(user?.id || 0).all<any>();
    const contests = rows.results || [];
    const pendingRequests = user?.id === 1 ? await env.DB.prepare(`
        SELECT r.id, r.contest_id, r.review_note, r.created_at,
               c.title AS contest_title, t.name AS team_name, u.username AS requester_name
        FROM contest_public_requests r
        JOIN contests c ON c.id = r.contest_id
        JOIN teams t ON t.id = c.team_id
        JOIN users u ON u.id = r.requested_by
        WHERE r.status = 'pending'
        ORDER BY r.created_at, r.id
    `).all<any>() : { results: [] };
    const content = `
        <div class="page-header contest-page">
            <h1><i class="fas fa-trophy"></i> 比赛中心</h1>
            <p style="margin-top:4px;">查看公开赛赛程、报名状态和排行榜；团队赛请前往所属团队查看。</p>
        </div>
        ${pendingRequests.results.length ? `<div class="card" style="margin-bottom:16px;">
            <h2 style="margin-top:0;">公开赛申请审核</h2>
            ${pendingRequests.results.map((item: any) => `<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;padding:10px 0;border-bottom:1px solid #eee;">
                <div><strong>${htmlEscape(item.contest_title)}</strong><div class="oj-muted">${htmlEscape(item.team_name)} · ${htmlEscape(item.requester_name)} · ${htmlEscape(item.review_note || '无申请说明')}</div></div>
                <div style="display:flex;gap:6px;">
                    <button type="button" onclick="reviewContestPublic(${Number(item.id)},'approve')">批准转公开</button>
                    <button type="button" onclick="reviewContestPublic(${Number(item.id)},'reject')">拒绝</button>
                </div>
            </div>`).join('')}
            <div id="contestReviewStatus" role="status"></div>
        </div>
        <script>
        async function reviewContestPublic(id, decision) {
            var form = new FormData(); form.set('decision', decision);
            var response = await fetch('/api/contests/public-requests/' + id + '/review', { method: 'POST', body: form });
            var data = await response.json();
            if (!response.ok) return document.getElementById('contestReviewStatus').textContent = data.error || '审核失败';
            location.reload();
        }
        </script>` : ''}
        <div class="contest-list-shell">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px;">
                <strong>当前赛程</strong>
                <a href="/oj" style="color:#8E44AD;text-decoration:none;">前往 OJ 题库</a>
            </div>
            ${contests.length ? contests.map((contest: any) => {
                const state = contestScheduleState(contest.start_at, contest.end_at);
                const labelMap = { scheduled: '未开始', running: '进行中', ended: '已结束' };
                const modeLabel = contest.participation_mode === 'team' ? '团队赛' : '公开赛';
                return `
                    <div class="contest-list-card">
                        <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-start;">
                            <div>
                                <h2 style="margin:0 0 6px;font-size:18px;"><a href="/contest/${contest.id}" style="color:#8E44AD;text-decoration:none;">${htmlEscape(contest.title || `比赛 #${contest.id}`)}</a></h2>
                                <p style="margin:0;color:#555;">${htmlEscape(contest.description || '暂无简介。')}</p>
                            </div>
                            <span class="contest-state-pill">${labelMap[state as keyof typeof labelMap]}</span>
                        </div>
                        <div class="contest-list-meta">
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
    return getLayout(env, user, '比赛中心', `<div class="contest-page">${content}</div>`, CONTEST_STYLES, request);
}

export async function renderContestDetail(env: Env, request: Request, path: string): Promise<string> {
    const user = await getSessionUser(env, request);
    const contestId = Number(path.split('/')[2] || 0);
    const contest = contestId > 0 ? await env.DB.prepare(`
        SELECT c.*, u.username AS organizer_name,
               t.name AS team_name,
               (SELECT COUNT(*) FROM contest_enrollments ce WHERE ce.contest_id = c.id AND ce.status = 'enrolled') AS enrolled_count
        FROM contests c
        LEFT JOIN users u ON u.id = c.organizer_id
        LEFT JOIN teams t ON t.id = c.team_id
        WHERE c.id = ?
    `).bind(contestId).first<any>() : null;
    if (!contest) return getLayout(env, user, '比赛不存在', '<div class="card">比赛不存在或已被移除。</div>', '', request);

    const state = contestScheduleState(contest.start_at, contest.end_at);
    const enrolled = user ? await env.DB.prepare('SELECT * FROM contest_enrollments WHERE contest_id = ? AND user_id = ?').bind(contestId, user.id).first<any>() : null;
    const teamMember = user && contest.team_id ? await env.DB.prepare(
        "SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ? AND status = 'approved'"
    ).bind(contest.team_id, user.id).first() : null;
    if (contest.participation_mode === 'team' && !teamMember) {
        return getLayout(env, user, '团队赛', '<div class="card">该团队赛仅对所属团队的已审核成员开放。</div>', '', request);
    }
    const contestProblems = await env.DB.prepare(`
        SELECT cp.problem_id, cp.problem_name, cp.problem_order, p.problem_name AS proposal_name
        FROM contest_problems cp
        LEFT JOIN oj_proposals p ON p.problem_id = cp.problem_id
          AND p.proposal_category = 'contest' AND p.status = 'approved'
        WHERE cp.contest_id = ?
        ORDER BY cp.problem_order, cp.problem_id
    `).bind(contestId).all<any>();
    const problemList = contestProblems.results || [];
    const modeLabel = contest.participation_mode === 'team' ? '团队赛' : '公开赛';
    const stateLabel = { scheduled: '未开始', running: '进行中', ended: '已结束' }[state] || '进行中';
    const isTeamManager = user && contest.team_id ? await env.DB.prepare(
        "SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ? AND status = 'approved' AND role IN ('owner', 'admin')"
    ).bind(contest.team_id, user.id).first() : null;
    const publicRequest = isTeamManager && contest.participation_mode === 'team'
        ? await env.DB.prepare(
            'SELECT id, status FROM contest_public_requests WHERE contest_id = ? ORDER BY id DESC LIMIT 1'
        ).bind(contestId).first<any>()
        : null;

    const enrollForm = !user ? '<div class="card"><p>登录后即可报名比赛。</p><a href="/login?redirect=' + encodeURIComponent('/contest/' + contestId) + '" style="color:#8E44AD;text-decoration:none;">前往登录</a></div>' : `
        <div class="card contest-enrollment-card">
            <h2 style="margin-top:0;">报名状态</h2>
            ${enrolled ? '<p>已报名：' + htmlEscape(enrolled.status || 'enrolled') + '</p>' : '<p>尚未报名。</p>'}
            ${contest.participation_mode === 'team' ? `
                <p>本场团队赛所属团队：${htmlEscape(contest.team_name || `团队 #${contest.team_id}`)}</p>
                <form method="POST" action="/api/contests/${contestId}/enroll">
                    <button type="submit" class="oj-submit">${enrolled ? '确认报名' : '报名比赛'}</button>
                </form>
            ` : `
                <form method="POST" action="/api/contests/${contestId}/enroll">
                    <button type="submit" class="oj-submit">${enrolled ? '重新报名' : '报名比赛'}</button>
                </form>
            `}
        </div>
    `;

    const content = `
        <div class="page-header contest-page">
            <h1><i class="fas fa-trophy"></i> ${htmlEscape(contest.title || `比赛 #${contest.id}`)}</h1>
            <p style="margin-top:4px;"><a href="/contest" style="color:#8E44AD;text-decoration:none;">← 返回比赛中心</a></p>
        </div>
        <div class="oj-layout contest-detail-layout">
            <article class="card contest-detail-hero">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px;">
                    <span style="padding:4px 10px;border-radius:999px;background:#f2eafa;color:#73419b;font-size:12px;font-weight:700;">${stateLabel}</span>
                    <span class="oj-muted">${modeLabel} · IOI ${contest.is_ioi ? '模式' : '非 IOI'}</span>
                </div>
                <div class="markdown-content">${htmlEscape(contest.description || '暂无比赛说明。')}</div>
                <dl class="oj-submission-fields contest-detail-facts">
                    <div><dt>开始时间</dt><dd>${htmlEscape(contest.start_at || '待定')}</dd></div>
                    <div><dt>结束时间</dt><dd>${htmlEscape(contest.end_at || '待定')}</dd></div>
                    <div><dt>主办方</dt><dd>${renderUsernameLink(contest.organizer_name || '系统', 'purple', '', Number(contest.organizer_id || 0))}</dd></div>
                    ${contest.team_name ? `<div><dt>所属团队</dt><dd><a href="/team/${Number(contest.team_id)}">${htmlEscape(contest.team_name)}</a></dd></div>` : ''}
                    <div><dt>已报名</dt><dd>${Number(contest.enrolled_count || 0)}</dd></div>
                </dl>
                ${isTeamManager && contest.participation_mode === 'team' ? `
                    <div style="margin-top:14px;padding:12px;background:#faf7fd;border-radius:8px;">
                        ${publicRequest?.status === 'pending'
                            ? '<span>公开申请审核中。</span>'
                            : `<form id="publicContestRequest"><label>申请转为公开赛（审核通过后，比赛和现有报名/题目保留）<textarea name="note" maxlength="500" rows="2" style="display:block;width:100%;box-sizing:border-box;margin:6px 0;padding:8px;"></textarea></label><button class="oj-submit" type="submit">${publicRequest?.status === 'rejected' ? '重新申请转公开' : '提交转公开申请'}</button><span id="publicContestRequestStatus" role="status"></span></form>`}
                    </div>
                    <script>
                    (function(){
                        var form=document.getElementById('publicContestRequest');
                        if(!form)return;
                        form.addEventListener('submit',async function(event){
                            event.preventDefault();
                            var response=await fetch('/api/contests/${contestId}/public-request',{method:'POST',body:new FormData(form)});
                            var data=await response.json();
                            if(!response.ok){document.getElementById('publicContestRequestStatus').textContent=data.error||'申请失败';return;}
                            location.reload();
                        });
                    }());
                    </script>
                ` : ''}
            </article>
            <aside>
                ${enrollForm}
                <div class="card contest-info-card">
                    <h2 style="margin-top:0;">题目权限</h2>
                    <p class="oj-muted">共 ${problemList.length} 题，每题最高 100 分。题库仅在比赛进行中对已报名成员开放。</p>
                    <a href="/oj?cid=${contestId}" style="color:#8E44AD;text-decoration:none;">进入比赛题库</a>
                </div>
            </aside>
        </div>
        <div class="card contest-problems-card" style="margin-top:16px;">
            <h2 style="margin-top:0;">比赛题目</h2>
            ${enrolled && state === 'running'
                ? problemList.length ? `<ol>${problemList.map((problem: any) => `<li><a href="/oj/${encodeURIComponent(String(problem.problem_id))}?cid=${contestId}" style="color:#8E44AD;">${htmlEscape(String(problem.problem_name || problem.proposal_name || `题目 ${problem.problem_id}`))}</a> · 100 分</li>`).join('')}</ol>` : '<p class="oj-muted">本场比赛尚未添加题目。</p>'
                : '<p class="oj-muted">赛题仅在比赛进行中对已报名成员开放。</p>'}
        </div>
        <div class="card contest-rank-entry" style="margin-top:16px;">
            <div><h2 style="margin:0 0 4px;">比赛排行榜</h2><p class="oj-muted" style="margin:0;">实时查看参赛者总分及各题最高分；同分并列排名。</p></div>
            ${enrolled
                ? `<a class="oj-submit" href="/contest/${contestId}/rank">查看排行榜</a>`
                : '<span class="oj-muted">报名后可查看排行榜。</span>'}
        </div>
        <style>.contest-rank-entry{display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap}.contest-rank-entry .oj-submit{text-decoration:none}</style>
    `;
    return getLayout(env, user, contest.title || `比赛 #${contest.id}`, `<div class="contest-page">${content}</div>`, CONTEST_STYLES, request);
}

export async function renderContestLeaderboard(env: Env, request: Request, path: string): Promise<string> {
    const user = await getSessionUser(env, request);
    const contestId = Number(path.split('/')[2] || 0);
    const access = await ensureUserCanViewContestLeaderboard(env, user, contestId);
    if (!access.ok || !access.contest) {
        const content = `<div class="card"><h2>无法查看排行榜</h2><p>${htmlEscape(access.error || '无权查看该比赛排行榜。')}</p><a href="/contest/${contestId || ''}">返回比赛</a></div>`;
        return getLayout(env, user, '比赛排行榜', content, '', request);
    }

    const contest = access.contest;
    const content = `
        <div class="page-header contest-rank-header">
            <div><span class="contest-rank-eyebrow">CONTEST STANDINGS</span><h1><i class="fas fa-ranking-star"></i> ${htmlEscape(contest.title || `比赛 #${contestId}`)} · 排行榜</h1>
                <p>每题取个人最高得分，按总分排名；同分并列。比赛进行中每 15 秒自动刷新。</p></div>
            <a class="contest-rank-back" href="/contest/${contestId}"><i class="fas fa-arrow-left"></i> 返回比赛</a>
        </div>
        <section class="contest-rank-summary">
            <div><span>参赛人数</span><strong id="contestRankParticipants">—</strong></div>
            <div><span>赛题数量</span><strong id="contestRankProblemCount">—</strong></div>
            <div><span>我的排名</span><strong id="contestRankMyPosition">—</strong></div>
            <div><span>最后更新</span><strong id="contestRankUpdatedAt">载入中</strong></div>
        </section>
        <section class="card contest-rank-card">
            <div id="contestRankState" class="contest-rank-state" role="status">正在加载排行榜…</div>
            <div class="contest-rank-table-wrap">
                <table class="contest-rank-table" id="contestRankTable" hidden>
                    <thead id="contestRankHead"></thead><tbody id="contestRankBody"></tbody>
                </table>
            </div>
        </section>
        <style>
            .contest-rank-header{display:flex;align-items:center;justify-content:space-between;gap:18px;flex-wrap:wrap;margin-bottom:18px}
            .contest-rank-header h1{margin:5px 0;font-size:clamp(22px,4vw,32px)}
            .contest-rank-header p{margin:6px 0 0;color:#777}
            .contest-rank-eyebrow{font-size:10px;letter-spacing:.16em;color:#8e44ad;font-weight:800}
            .contest-rank-back{padding:9px 13px;border-radius:9px;background:#fff;color:#754092;text-decoration:none;box-shadow:0 5px 18px #39234c14;font-weight:700}
            .contest-rank-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:14px}
            .contest-rank-summary>div{padding:15px 17px;border:1px solid #eee7f4;border-radius:12px;background:linear-gradient(140deg,#fff,#faf6ff);box-shadow:0 5px 18px #39234c0a}
            .contest-rank-summary span{display:block;color:#8b8191;font-size:12px;margin-bottom:5px}
            .contest-rank-summary strong{font-size:21px;color:#39234c;font-variant-numeric:tabular-nums}
            .contest-rank-card{padding:0;overflow:hidden}
            .contest-rank-state{padding:18px;color:#8b8191}
            .contest-rank-state.error{color:#a33}
            .contest-rank-table-wrap{overflow:auto}
            .contest-rank-table{width:100%;border-collapse:separate;border-spacing:0;min-width:620px}
            .contest-rank-table th,.contest-rank-table td{padding:12px 14px;border-bottom:1px solid #f0edf2;text-align:center;white-space:nowrap}
            .contest-rank-table th{position:sticky;top:0;background:#faf8fc;color:#756b7b;font-size:11px;letter-spacing:.04em}
            .contest-rank-table th:nth-child(2),.contest-rank-table td:nth-child(2){text-align:left;min-width:150px}
            .contest-rank-table tbody tr:hover{background:#fbf8ff}
            .contest-rank-table tbody tr.is-me{background:#f5edff}
            .contest-rank-place{font-weight:800;color:#8e44ad}
            .contest-rank-place.top-1{color:#d29a18}.contest-rank-place.top-2{color:#778899}.contest-rank-place.top-3{color:#ad7045}
            .contest-rank-name{font-weight:700;color:#33283b}
            .contest-rank-me{display:inline-block;margin-left:6px;padding:2px 6px;border-radius:99px;background:#8e44ad;color:#fff;font-size:10px}
            .contest-rank-points{font-variant-numeric:tabular-nums;color:#665a70}
            .contest-rank-total{font-size:15px;font-weight:800;color:#39234c}
            @media(max-width:650px){.contest-rank-summary{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.contest-rank-summary>div{padding:12px}.contest-rank-summary strong{font-size:18px}.contest-rank-table th,.contest-rank-table td{padding:10px}}
        </style>
        <script>
        (function(){
            var contestId=${contestId},currentUserId=${Number(user?.id || 0)};
            var state=document.getElementById('contestRankState');
            var table=document.getElementById('contestRankTable');
            var head=document.getElementById('contestRankHead');
            var body=document.getElementById('contestRankBody');
            var timer=null;
            function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,function(c){return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];});}
            function problemLabel(index){var label='';for(index++;index>0;index=Math.floor((index-1)/26))label=String.fromCharCode(65+(index-1)%26)+label;return label;}
            function render(data){
                var problems=Array.isArray(data.problems)?data.problems:[];
                var standings=Array.isArray(data.standings)?data.standings:[];
                head.innerHTML='<tr><th>排名</th><th>参赛者</th>'+problems.map(function(id,index){return '<th>'+problemLabel(index)+'<br>'+esc(id)+'</th>';}).join('')+'<th>总分</th></tr>';
                body.innerHTML=standings.map(function(row){
                    var mine=Number(row.user_id)===currentUserId;
                    var rank=Number(row.rank||0);
                    var rankClass=rank<=3?' top-'+rank:'';
                    return '<tr class="'+(mine?'is-me':'')+'"><td><span class="contest-rank-place'+rankClass+'">'+rank+'</span></td>'+
                        '<td><span class="contest-rank-name">'+esc(mine?'你':row.username)+'</span>'+(mine?'<span class="contest-rank-me">我</span>':'')+'</td>'+
                        problems.map(function(id){var score=Number(row.problems&&row.problems[id]||0);return '<td class="contest-rank-points">'+(score?score:'<span style="color:#c8c1cd">—</span>')+'</td>';}).join('')+
                        '<td class="contest-rank-total">'+Number(row.score||0)+'</td></tr>';
                }).join('');
                document.getElementById('contestRankParticipants').textContent=standings.length;
                document.getElementById('contestRankProblemCount').textContent=problems.length;
                var mine=standings.find(function(row){return Number(row.user_id)===currentUserId;});
                document.getElementById('contestRankMyPosition').textContent=mine?'#'+mine.rank:'—';
                document.getElementById('contestRankUpdatedAt').textContent=new Date().toLocaleTimeString();
                state.hidden=true;
                table.hidden=standings.length===0;
                if(!standings.length){state.hidden=false;state.textContent='暂时没有已报名参赛者。';}
            }
            function load(){
                fetch('/api/contests/'+contestId+'/leaderboard',{headers:{Accept:'application/json'}})
                    .then(function(response){return response.json().then(function(data){if(!response.ok)throw new Error(data.error||'HTTP '+response.status);return data;});})
                    .then(render)
                    .catch(function(error){state.hidden=false;state.classList.add('error');state.textContent='排行榜加载失败：'+error.message;});
            }
            load();
            timer=setInterval(load,15000);
            window.addEventListener('pagehide',function(){if(timer)clearInterval(timer);});
        }());
        </script>
    `;
    return getLayout(env, user, `${contest.title || `比赛 #${contestId}`} · 排行榜`, content, '', request);
}
