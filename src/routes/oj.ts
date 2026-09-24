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
    .oj-code { width:100%; min-height:360px; resize:vertical; padding:12px; border:1px solid #ddd; border-radius:6px; font:13px/1.6 Consolas,Monaco,monospace; }
    .oj-submit { border:0; border-radius:6px; padding:9px 16px; background:#8E44AD; color:#fff; cursor:pointer; font-weight:600; }
    .oj-submit:disabled { opacity:.55; cursor:wait; }
    .oj-status { margin-top:12px; padding:10px; border-radius:6px; background:#f8f9fa; color:#555; font-size:13px; white-space:pre-wrap; }
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
                <textarea id="ojCode" class="oj-code" spellcheck="false" placeholder="// 在此输入代码"></textarea>
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
                var code = document.getElementById('ojCode').value;
                if (!code.trim()) { showStatus('请输入代码后再提交。', true); return; }
                submit.disabled = true;
                showStatus('正在提交...');
                fetch('/api/oj/judge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: pid, code: code }) })
                    .then(function (response) { return response.json().then(function (data) { if (!response.ok) throw new Error(data.error || data.message || ('HTTP ' + response.status)); return data; }); })
                    .then(function (data) {
                        var sid = data.submissionID || data.submission_id || data.id;
                        if (!sid) throw new Error('评测服务未返回提交 ID');
                        showStatus('已提交，正在评测...');
                        pollSubmission(sid, 0);
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

export async function renderOjList(env: Env, req: Request) {
    const user = await getSessionUser(env, req);
    return getLayout(env, user, 'OJ 评测', renderOjListContent(), OJ_STYLES, req);
}

export async function renderOjProblem(env: Env, req: Request, path: string) {
    const user = await getSessionUser(env, req);
    const problemId = decodeURIComponent(path.slice('/oj/'.length)).trim();
    return getLayout(env, user, `题目 ${problemId}`, renderOjProblemContent(problemId), OJ_STYLES, req);
}
