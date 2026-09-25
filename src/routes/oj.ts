import { getSessionUser } from '../utils/auth';
import { getLayout } from '../utils/layout';
import { htmlEscape } from '../utils/html';
import type { Env } from '../env.d';

const OJ_STYLES = `
    .oj-toolbar { display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:14px; }
    .oj-search { flex:1; min-width:220px; padding:9px 12px; border:1px solid #ddd; border-radius:6px; font-size:14px; }
    .oj-table { width:100%; border-collapse:collapse; }
    .oj-table th, .oj-table td { padding:10px 8px; border-bottom:1px solid #eee; text-align:left; }
    .oj-table th { color:#777; font-size:12px; font-weight:600; }
    .oj-table a { color:#8E44AD; text-decoration:none; font-weight:600; }
    .oj-table a:hover { text-decoration:underline; }
    .oj-tag { display:inline-block; margin:2px 4px 2px 0; padding:2px 7px; border-radius:10px; background:#f2eafa; color:#754092; font-size:11px; }
    .oj-muted { color:#999; font-size:13px; }
    .oj-layout { display:grid; grid-template-columns:minmax(0, 1.5fr) minmax(280px, 1fr); gap:16px; align-items:start; }
    .oj-editor { width:100%; height:420px; border:1px solid #ddd; border-radius:6px; overflow:hidden; }
    .oj-code-fallback { width:100%; min-height:360px; resize:vertical; padding:12px; border:1px solid #ddd; border-radius:6px; font:13px/1.6 Consolas,Monaco,monospace; }
    .oj-submit { border:0; border-radius:6px; padding:9px 16px; background:#8E44AD; color:#fff; cursor:pointer; font-weight:600; }
    .oj-submit:disabled { opacity:.55; cursor:wait; }
    .oj-status { margin-top:12px; padding:10px; border-radius:6px; background:#f8f9fa; color:#555; font-size:13px; white-space:pre-wrap; }
    .oj-submission-summary { display:flex; justify-content:space-between; gap:12px; align-items:center; font-size:16px; }
    .oj-submission-fields { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:10px; margin:18px 0 0; }
    .oj-submission-fields div { padding:10px; border-radius:6px; background:#f8f9fa; }
    .oj-submission-fields dt { color:#777; font-size:12px; margin-bottom:4px; }
    .oj-submission-fields dd { margin:0; overflow-wrap:anywhere; }
    @media (max-width:800px) { .oj-layout { grid-template-columns:1fr; } .oj-table { font-size:13px; } }
`;

function scriptJson(value: string): string {
    return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (character) => ({
        '<': '\\u003c',
        '>': '\\u003e',
        '&': '\\u0026',
        '\u2028': '\\u2028',
        '\u2029': '\\u2029',
    })[character] || character);
}

function renderOjListContent(): string {
    return `
        <div class="page-header">
            <h1><i class="fas fa-code"></i> OJ 评测</h1>
            <p style="margin-top:4px;">浏览题目、查看 Markdown + MathJax 题面，并在线提交代码。</p>
        </div>
        <div class="card">
            <div class="oj-toolbar">
                <input id="ojSearch" class="oj-search" type="search" placeholder="搜索题号、题目名称或难度">
                <span id="ojCount" class="oj-muted">加载中...</span>
            </div>
            <div id="ojProblemState" class="oj-muted">正在加载题目列表...</div>
            <div style="overflow-x:auto;">
                <table class="oj-table" id="ojProblemTable" hidden>
                    <thead><tr><th>题号</th><th>题目</th><th>难度</th></tr></thead>
                    <tbody></tbody>
                </table>
            </div>
        </div>
        <script>
        (function () {
            var rows = [], state = document.getElementById('ojProblemState');
            var table = document.getElementById('ojProblemTable');
            var search = document.getElementById('ojSearch');
            var count = document.getElementById('ojCount');
            function esc(value) {
                return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
                    return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];
                });
            }
            function draw() {
                var keyword = search.value.trim().toLowerCase();
                var filtered = rows.filter(function (p) {
                    return !keyword || [p.id, p.title, p.name, p.difficulty].join(' ').toLowerCase().indexOf(keyword) !== -1;
                });
                count.textContent = filtered.length + ' / ' + rows.length + ' 题';
                table.querySelector('tbody').innerHTML = filtered.map(function (p) {
                    return '<tr><td><a href="/oj/' + encodeURIComponent(p.id) + '">' + esc(p.id) + '</a></td>' +
                        '<td><a href="/oj/' + encodeURIComponent(p.id) + '">' + esc(p.title || p.name || '未命名题目') + '</a></td>' +
                        '<td class="oj-muted">' + esc(p.difficulty || '—') + '</td></tr>';
                }).join('');
                state.hidden = filtered.length > 0;
                table.hidden = filtered.length === 0;
                if (filtered.length === 0) state.textContent = rows.length ? '没有匹配的题目。' : '暂无可用题目。';
            }
            search.addEventListener('input', draw);
            fetch('/api/oj/problems', { headers: { Accept: 'application/json' } })
                .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
                .then(function (data) {
                    rows = Array.isArray(data.problems) ? data.problems : [];
                    draw();
                })
                .catch(function (error) {
                    state.textContent = '题目列表加载失败：' + error.message;
                    count.textContent = '';
                });
        }());
        </script>
    `;
}

function renderOjProblemContent(problemId: string): string {
    const safeId = htmlEscape(problemId);
    return `
        <div class="page-header">
            <h1><i class="fas fa-laptop-code"></i> 题目 ${safeId}</h1>
            <p style="margin-top:4px;"><a href="/oj" style="color:#8E44AD;text-decoration:none;">← 返回题目列表</a></p>
        </div>
        <div id="ojProblemState" class="card">正在加载题面...</div>
        <div id="ojProblemView" class="oj-layout" hidden>
            <article class="card">
                <h2 id="ojProblemTitle" style="font-size:20px;margin-bottom:12px;"></h2>
                <div id="ojProblemTags" style="margin-bottom:12px;"></div>
                <div id="ojProblemStatement" class="markdown-body"></div>
            </article>
            <section class="card">
                <h2 style="font-size:16px;margin-bottom:10px;"><i class="fas fa-paper-plane"></i> 提交代码</h2>
                <p class="oj-muted" style="margin-bottom:10px;">提交后会自动轮询评测结果。</p>
                <div id="ojEditor" class="oj-editor" aria-label="代码编辑器"></div>
                <textarea id="ojCode" class="oj-code-fallback" spellcheck="false" placeholder="// 在此输入代码">#include &lt;bits/stdc++.h&gt;
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    return 0;
}</textarea>
                <div id="ojEditorStatus" class="oj-muted" style="margin-top:6px;">正在加载 Monaco Editor...</div>
                <button id="ojSubmit" class="oj-submit" type="button">提交评测</button>
                <div id="ojJudgeStatus" class="oj-status" hidden></div>
            </section>
        </div>
        <script>
        (function () {
            var pid = ${scriptJson(problemId)};
            var state = document.getElementById('ojProblemState');
            var view = document.getElementById('ojProblemView');
            var status = document.getElementById('ojJudgeStatus');
            var submit = document.getElementById('ojSubmit');
            var editorHost = document.getElementById('ojEditor');
            var fallback = document.getElementById('ojCode');
            var editorStatus = document.getElementById('ojEditorStatus');
            var editor = null;
            function useFallback(message) {
                editorHost.hidden = true;
                fallback.hidden = false;
                editorStatus.textContent = message;
            }
            function initializeMonaco() {
                var loader = document.createElement('script');
                loader.src = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs/loader.js';
                loader.onload = function () {
                    if (!window.require || typeof window.require.config !== 'function') {
                        useFallback('Monaco Editor 加载失败，已切换为文本编辑器。');
                        return;
                    }
                    window.require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs' } });
                    window.require(['vs/editor/editor.main'], function () {
                        editor = window.monaco.editor.create(editorHost, {
                            value: fallback.value,
                            language: 'cpp',
                            theme: 'vs-dark',
                            automaticLayout: true,
                            minimap: { enabled: false },
                            fontSize: 13,
                            tabSize: 4,
                            wordWrap: 'off',
                        });
                        fallback.hidden = true;
                        editorStatus.textContent = 'Monaco Editor · C++';
                    }, function () {
                        useFallback('Monaco Editor 加载失败，已切换为文本编辑器。');
                    });
                };
                loader.onerror = function () {
                    useFallback('Monaco Editor 网络不可用，已切换为文本编辑器。');
                };
                document.head.appendChild(loader);
            }
            initializeMonaco();
            function esc(value) {
                return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
                    return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];
                });
            }
            function showStatus(text, error) {
                status.hidden = false;
                status.style.color = error ? '#c0392b' : '#555';
                status.textContent = text;
            }
            function renderProblem(problem) {
                document.getElementById('ojProblemTitle').textContent = problem.name || problem.title || ('题目 ' + pid);
                document.getElementById('ojProblemTags').innerHTML = (Array.isArray(problem.tags) ? problem.tags : []).map(function (tag) {
                    return '<span class="oj-tag">' + esc(tag) + '</span>';
                }).join('');
                var statement = problem.statement || problem.description || '';
                var statementNode = document.getElementById('ojProblemStatement');
                statementNode.innerHTML = window.renderMarkdownHtml(statement) || '<span class="oj-muted">题面为空。</span>';
                window.typesetMath(statementNode);
                state.hidden = true;
                view.hidden = false;
            }
            function pollSubmission(sid, attempt) {
                fetch('/api/oj/submission?sid=' + encodeURIComponent(sid), { headers: { Accept: 'application/json' } })
                    .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
                    .then(function (data) {
                        var tests = data.passed != null && data.total != null ? '（' + data.passed + '/' + data.total + ' 测试点）' : '';
                        showStatus((data.status || 'Judging') + ' ' + tests + (data.message ? '\\n' + data.message : ''));
                        var done = data.status && !/judg|queue|running|pending/i.test(data.status);
                        if (!done && attempt < 60) setTimeout(function () { pollSubmission(sid, attempt + 1); }, 1500);
                        else submit.disabled = false;
                    })
                    .catch(function (error) { showStatus('查询评测结果失败：' + error.message, true); submit.disabled = false; });
            }
            submit.addEventListener('click', function () {
                var code = editor ? editor.getValue() : fallback.value;
                if (!code.trim()) { showStatus('请输入代码后再提交。', true); return; }
                submit.disabled = true;
                showStatus('正在提交...');
                fetch('/api/oj/judge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: pid, code: code }) })
                    .then(function (response) { return response.json().then(function (data) { if (!response.ok) throw new Error(data.error || data.message || ('HTTP ' + response.status)); return data; }); })
                    .then(function (data) {
                        var sid = data.submissionID || data.submission_id || data.id;
                        if (!sid) throw new Error('评测服务未返回提交 ID');
                        window.location.href = '/oj/submission/' + encodeURIComponent(sid);
                    })
                    .catch(function (error) { showStatus('提交失败：' + error.message, true); submit.disabled = false; });
            });
            fetch('/api/oj/problem?pid=' + encodeURIComponent(pid), { headers: { Accept: 'application/json' } })
                .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
                .then(renderProblem)
                .catch(function (error) { state.textContent = '题面加载失败：' + error.message; });
        }());
        </script>
    `;
}

function renderOjSubmissionContent(submissionId: string): string {
    const safeId = htmlEscape(submissionId);
    return `
        <div class="page-header">
            <h1><i class="fas fa-file-code"></i> 提交详情</h1>
            <p style="margin-top:4px;"><a href="/oj" style="color:#8E44AD;text-decoration:none;">← 返回题目列表</a></p>
        </div>
        <div id="ojSubmissionState" class="card">正在加载提交记录...</div>
        <div id="ojSubmissionView" class="card" hidden>
            <div class="oj-submission-summary">
                <strong>提交 #${safeId}</strong>
                <span id="ojSubmissionStatus"></span>
            </div>
            <dl class="oj-submission-fields">
                <div><dt>题目</dt><dd id="ojSubmissionProblem">—</dd></div>
                <div><dt>用户</dt><dd id="ojSubmissionUser">—</dd></div>
                <div><dt>结果</dt><dd id="ojSubmissionMessage">—</dd></div>
            </dl>
            <h2 style="font-size:16px;margin:18px 0 10px;">测试点详情</h2>
            <div id="ojTestpoints" class="oj-muted">暂无测试点信息。</div>
        </div>
        <script>
        (function () {
            var sid = ${scriptJson(submissionId)};
            var state = document.getElementById('ojSubmissionState');
            var view = document.getElementById('ojSubmissionView');
            var status = document.getElementById('ojSubmissionStatus');
            function esc(value) {
                return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
                    return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];
                });
            }
            function value(item, keys) {
                for (var i = 0; i < keys.length; i++) if (item[keys[i]] != null) return item[keys[i]];
                return '';
            }
            function render(data) {
                var points = Array.isArray(data.testpoints) ? data.testpoints :
                    (Array.isArray(data.test_points) ? data.test_points : []);
                status.textContent = value(data, ['status', 'result']) || 'Unknown';
                document.getElementById('ojSubmissionProblem').textContent = value(data, ['pid', 'problem_id', 'problem']) || '—';
                document.getElementById('ojSubmissionUser').textContent = value(data, ['name', 'username', 'user']) || '—';
                document.getElementById('ojSubmissionMessage').textContent = value(data, ['message', 'error']) || '—';
                var passed = value(data, ['passed']);
                var total = value(data, ['total']);
                if (passed !== '' && total !== '') status.textContent += '（' + passed + '/' + total + ' 测试点）';
                document.getElementById('ojTestpoints').innerHTML = points.length ? '<table class="oj-table"><thead><tr><th>测试点</th><th>状态</th><th>信息</th></tr></thead><tbody>' +
                    points.map(function (point, index) {
                        return '<tr><td>' + esc(value(point, ['id', 'index', 'name']) || (index + 1)) + '</td><td>' +
                            esc(value(point, ['status', 'result']) || '—') + '</td><td>' +
                            esc(value(point, ['message', 'time', 'memory']) || '—') + '</td></tr>';
                    }).join('') + '</tbody></table>' : '暂无测试点信息。';
                state.hidden = true;
                view.hidden = false;
            }
            fetch('/api/oj/submission?sid=' + encodeURIComponent(sid), { headers: { Accept: 'application/json' } })
                .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
                .then(render)
                .catch(function (error) { state.textContent = '提交记录加载失败：' + error.message; });
        }());
        </script>
    `;
}

export async function renderOjList(env: Env, req: Request) {
    const user = await getSessionUser(env, req);
    return getLayout(env, user, 'OJ 评测', renderOjListContent(), OJ_STYLES, req);
}

export async function renderOjProposal(env: Env, req: Request) {
    const user = await getSessionUser(env, req);
    if (user?.id !== 1) {
        return getLayout(env, user, 'OJ 投题', '<div class="card"><h2>无权访问</h2><p class="oj-muted">只有 superuser（UID 1）可以提交 OJ 投题。</p></div>', OJ_STYLES, req);
    }
    const teams = user
        ? await env.DB.prepare("SELECT t.id, t.name FROM team_members tm JOIN teams t ON t.id = tm.team_id WHERE tm.user_id = ? AND tm.status = 'approved' AND t.status = 'active' ORDER BY t.name").bind(user.id).all<any>()
        : { results: [] };
    const teamOptions = (teams.results || []).map((team: any) =>
        `<option value="${team.id}">${htmlEscape(String(team.name))} (#${team.id})</option>`).join('');
    const submitted = new URL(req.url).searchParams.get('submitted') === '1';
    const content = `
        <div class="page-header"><h1><i class="fas fa-file-circle-plus"></i> OJ 投题</h1>
            <p style="margin-top:4px;">登记题目元数据，并通过外部文件服务交接题目压缩包。</p></div>
        ${submitted ? '<div class="card" style="color:#18794e;background:#effaf3;">投题已登记，等待 superuser 审核。</div>' : ''}
        <div class="card">
            <form action="/api/oj/proposals" method="POST" class="oj-proposal-form">
                <label>题目类别<select name="proposal_category" id="ojProposalCategory">
                    <option value="public">公共题目（ID 以 1 开头）</option>
                    <option value="team">团队题目（ID 以 5 开头，奇数公开、偶数私有）</option>
                    <option value="contest">比赛题目（ID 以 6 开头）</option>
                </select></label>
                <label>题目 ID<input name="problem_id" maxlength="20" pattern="[0-9]+" required placeholder="例如：1001"></label>
                <label id="ojProposalTeamField" hidden>所属团队<select name="team_id"><option value="">请选择团队</option>${teamOptions}</select></label>
                <div id="ojProposalVisibility" class="oj-upload-guidance">公共题目对所有用户可见。</div>
                <label>题目名称<input name="problem_name" maxlength="120" required placeholder="例如：区间查询"></label>
                <label>标签<input name="tags" maxlength="300" placeholder="用逗号分隔，例如：数据结构,线段树"></label>
                <label>5 字母取件码<input name="pickup_code" minlength="5" maxlength="5" pattern="[A-Za-z]{5}" required placeholder="上传后从外部文件服务取得"></label>
                <div class="oj-upload-guidance"><strong>外部上传说明</strong><br>
                    请先将题目 ZIP 上传至 <a href="https://filetransmit.cqiming.com/#/send" target="_blank" rel="noopener noreferrer">filetransmit.cqiming.com</a>，再把服务生成的 5 个英文字母取件码填入这里。
                    本站只保存题目名称、标签和取件码，不接收、不上传、也不保存 ZIP 文件或文件内的详细评测数据。
                    请勿把密码、完整下载链接或测试点内容填写到表单。</div>
                <button class="oj-submit" type="submit">登记投题</button>
            </form>
        </div>
        <script>
            (function () {
                var category = document.getElementById('ojProposalCategory');
                var team = document.getElementById('ojProposalTeamField');
                var visibility = document.getElementById('ojProposalVisibility');
                var id = document.querySelector('input[name="problem_id"]');
                function sync() {
                    var isTeam = category.value === 'team';
                    team.hidden = !isTeam;
                    id.placeholder = category.value === 'public' ? '例如：1001' : (category.value === 'team' ? '例如：5001（奇数公开，偶数私有）' : '例如：6001');
                    visibility.textContent = category.value === 'team' ? '团队题目可见性由 ID 尾数决定：奇数公开，偶数私有。' :
                        (category.value === 'contest' ? '比赛题目归属于 OJ 比赛。' : '公共题目对所有用户可见。');
                }
                category.addEventListener('change', sync);
                sync();
            }());
        </script>
        <style>
            .oj-proposal-form { display:grid; gap:14px; max-width:620px; }
            .oj-proposal-form label { display:grid; gap:6px; color:#555; font-size:13px; font-weight:600; }
            .oj-proposal-form input { padding:9px 10px; border:1px solid #ddd; border-radius:6px; font:inherit; font-weight:400; }
            .oj-upload-guidance { padding:12px; border-radius:6px; background:#fff8dc; border:1px solid #f0d98c; color:#765b14; font-size:12px; line-height:1.7; }
            .oj-proposal-form select { padding:9px 10px; border:1px solid #ddd; border-radius:6px; font:inherit; font-weight:400; }
        </style>`;
    return getLayout(env, user, 'OJ 投题', content, OJ_STYLES, req);
}

export async function renderOjProposalReview(env: Env, req: Request) {
    const user = await getSessionUser(env, req);
    if (user?.id !== 1) {
        return getLayout(env, user, 'OJ 投题审核', '<div class="card"><h2>无权访问</h2><p class="oj-muted">只有 superuser（UID 1）可以查看审核队列。</p></div>', OJ_STYLES, req);
    }
    const rows = await env.DB.prepare(
        `SELECT p.*, u.username AS proposer_name FROM oj_proposals p
         LEFT JOIN users u ON u.id = p.proposer_id ORDER BY p.created_at DESC, p.id DESC`
    ).all<any>();
    const proposals = rows.results || [];
    const content = `
        <div class="page-header"><h1><i class="fas fa-clipboard-check"></i> OJ 投题审核</h1></div>
        <div class="card">
            ${proposals.length ? proposals.map((proposal: any) => {
                let tags: string[] = [];
                try { tags = JSON.parse(String(proposal.tags || '[]')); } catch { }
                return `<article class="oj-proposal-row">
                    <div><strong>${htmlEscape(String(proposal.problem_name))}</strong>
                        <span class="oj-proposal-status status-${htmlEscape(String(proposal.status))}">${htmlEscape(String(proposal.status))}</span>
                        <div class="oj-muted">#${proposal.id} · ${htmlEscape(String(proposal.proposer_name || '未知'))} ·
                            ${htmlEscape(String(proposal.proposal_category || 'public'))} ·
                            ${htmlEscape(String(proposal.problem_id || '未分配 ID'))} ·
                            ${proposal.team_id ? `团队 #${htmlEscape(String(proposal.team_id))} · ` : ''}
                            ${htmlEscape(String(proposal.visibility || 'public'))} ·
                            ${htmlEscape(tags.join('、') || '无标签')} · 取件码：${htmlEscape(String(proposal.pickup_code))}</div>
                    </div>
                    <form action="/api/oj/proposals/${proposal.id}" method="POST" class="oj-proposal-review">
                        <select name="status"><option value="pending" ${proposal.status === 'pending' ? 'selected' : ''}>待审核</option><option value="approved" ${proposal.status === 'approved' ? 'selected' : ''}>通过</option><option value="rejected" ${proposal.status === 'rejected' ? 'selected' : ''}>退回</option></select>
                        <input name="review_note" maxlength="500" placeholder="审核备注" value="${htmlEscape(String(proposal.review_note || ''))}">
                        <button class="oj-submit" type="submit">保存</button>
                    </form>
                </article>`;
            }).join('') : '<p class="oj-muted">暂无投题记录。</p>'}
        </div>
        <style>.oj-proposal-row{display:flex;justify-content:space-between;gap:14px;padding:14px 0;border-bottom:1px solid #eee;align-items:center}.oj-proposal-row:last-child{border-bottom:0}.oj-proposal-status{margin-left:8px;padding:2px 6px;border-radius:8px;font-size:11px}.status-pending{background:#fff8dc;color:#765b14}.status-approved{background:#effaf3;color:#18794e}.status-rejected{background:#fff0f0;color:#a33}.oj-proposal-review{display:flex;gap:6px;flex-wrap:wrap}.oj-proposal-review input,.oj-proposal-review select{padding:7px;border:1px solid #ddd;border-radius:5px;max-width:180px}</style>`;
    return getLayout(env, user, 'OJ 投题审核', content, OJ_STYLES, req);
}

export async function renderOjProblem(env: Env, req: Request, path: string) {
    const user = await getSessionUser(env, req);
    const problemId = decodeURIComponent(path.slice('/oj/'.length)).trim();
    return getLayout(env, user, `题目 ${problemId}`, renderOjProblemContent(problemId), OJ_STYLES, req);
}

export async function renderOjSubmission(env: Env, req: Request, path: string) {
    const user = await getSessionUser(env, req);
    const submissionId = decodeURIComponent(path.slice('/oj/submission/'.length)).trim();
    return getLayout(env, user, `提交详情 ${submissionId}`, renderOjSubmissionContent(submissionId), OJ_STYLES, req);
}
