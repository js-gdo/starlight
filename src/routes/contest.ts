import { getSessionUser } from '../utils/auth';
import { getLayout } from '../utils/layout';
import { htmlEscape, renderUsernameLink } from '../utils/html';
import { contestScheduleState } from '../handlers/contest';
import type { Env } from '../env.d';

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
        <div class="card" style="max-width:820px;">
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
    return getLayout(env, user, '创建团队赛', content, '', request);
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
        <div class="page-header">
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
    const scoreRows = enrolled ? await env.DB.prepare(`
        SELECT s.user_id, u.username, s.problem_id, MAX(s.score) AS best_score
        FROM contest_submissions s JOIN users u ON u.id = s.user_id
        WHERE s.contest_id = ?
        GROUP BY s.user_id, u.username, s.problem_id
    `).bind(contestId).all<any>() : { results: [] };
    const scoreMap = new Map<number, { username: string; score: number; problems: Record<string, number> }>();
    for (const row of scoreRows.results || []) {
        const uid = Number(row.user_id);
        const entry = scoreMap.get(uid) || { username: String(row.username), score: 0, problems: {} };
        const score = Math.max(0, Math.min(100, Number(row.best_score || 0)));
        entry.problems[String(row.problem_id)] = score;
        entry.score += score;
        scoreMap.set(uid, entry);
    }
    const problemList = contestProblems.results || [];
    const leaderboardRows = [...scoreMap.entries()].sort((a, b) =>
        b[1].score - a[1].score || a[1].username.localeCompare(b[1].username)
    );
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
        <div class="card">
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
                <div class="card">
                    <h2 style="margin-top:0;">题目权限</h2>
                    <p class="oj-muted">共 ${problemList.length} 题，每题最高 100 分。题库仅在比赛进行中对已报名成员开放。</p>
                    <a href="/oj?cid=${contestId}" style="color:#8E44AD;text-decoration:none;">进入比赛题库</a>
                </div>
            </aside>
        </div>
        <div class="card" style="margin-top:16px;">
            <h2 style="margin-top:0;">比赛题目</h2>
            ${enrolled && state === 'running'
                ? problemList.length ? `<ol>${problemList.map((problem: any) => `<li><a href="/oj/${encodeURIComponent(String(problem.problem_id))}?cid=${contestId}" style="color:#8E44AD;">${htmlEscape(String(problem.problem_name || problem.proposal_name || `题目 ${problem.problem_id}`))}</a> · 100 分</li>`).join('')}</ol>` : '<p class="oj-muted">本场比赛尚未添加题目。</p>'
                : '<p class="oj-muted">赛题仅在比赛进行中对已报名成员开放。</p>'}
        </div>
        ${enrolled ? `<div class="card" style="margin-top:16px;">
            <h2 style="margin-top:0;">实时排行榜</h2>
            <p class="oj-muted">每题取最高得分；部分分按通过测试点比例计算，单题最高 100 分。</p>
            ${leaderboardRows.length ? `<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;"><thead><tr><th style="text-align:left;padding:8px;">排名</th><th style="text-align:left;padding:8px;">参赛者</th>${problemList.map((problem: any) => `<th style="text-align:center;padding:8px;">${htmlEscape(String(problem.problem_id))}</th>`).join('')}<th style="text-align:right;padding:8px;">总分</th></tr></thead><tbody>
                ${leaderboardRows.map(([uid, result], index) => `<tr><td style="padding:8px;">${index + 1}</td><td style="padding:8px;">${uid === user?.id ? '<strong>你</strong>' : htmlEscape(result.username)}</td>${problemList.map((problem: any) => `<td style="text-align:center;padding:8px;">${Number(result.problems[String(problem.problem_id)] || 0)}</td>`).join('')}<td style="text-align:right;padding:8px;"><strong>${result.score}</strong></td></tr>`).join('')}
            </tbody></table></div>` : '<p class="oj-muted">暂时还没有已评测提交。</p>'}
        </div>` : ''}
    `;
    return getLayout(env, user, contest.title || `比赛 #${contest.id}`, content, '', request);
}
