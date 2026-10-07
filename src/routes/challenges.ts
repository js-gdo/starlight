import { getSessionUser } from '../utils/auth';
import { getLayout } from '../utils/layout';
import { getWeeklyChallengeData } from '../handlers/challenges';
import { htmlEscape } from '../utils/html';
import type { Env } from '../env.d';

export async function renderChallenges(env: Env, request: Request): Promise<string> {
    const user = await getSessionUser(env, request);
    const state = user ? await getWeeklyChallengeData(env, Number(user.id)) : null;
    const personal = state?.personal.map((task) => {
        const complete = task.progress >= task.target;
        return `<article class="challenge-task">
            <div><h2>${htmlEscape(task.title)}</h2><p>进度：${task.progress} / ${task.target} · 奖励：${task.reward} 积分</p></div>
            ${task.claimed
                ? '<span class="challenge-done">已领取</span>'
                : complete
                    ? `<button class="challenge-claim" data-key="${htmlEscape(task.key)}">领取奖励</button>`
                    : '<span class="challenge-progress">进行中</span>'}
        </article>`;
    }).join('') || '';
    const teams = state?.teams.map((team) => {
        const complete = team.comments >= state.teamChallenge.commentsTarget &&
            team.contributors >= state.teamChallenge.contributorsTarget;
        const eligible = team.userComments > 0;
        return `<article class="challenge-task team-task">
            <div><h2><a href="/team/${team.id}">${htmlEscape(team.name)}</a> · ${htmlEscape(state.teamChallenge.title)}</h2>
                <p>团队讨论 ${team.comments} / ${state.teamChallenge.commentsTarget} 条，参与成员 ${team.contributors} / ${state.teamChallenge.contributorsTarget} 位</p>
                <p>${eligible ? `你已参与 ${team.userComments} 条` : '你还没有参与本周团队讨论'} · 奖励：${state.teamChallenge.reward} 积分</p>
            </div>
            ${team.claimed
                ? '<span class="challenge-done">已领取</span>'
                : complete && eligible
                    ? `<button class="challenge-claim" data-key="team_collaboration" data-team-id="${team.id}">领取奖励</button>`
                    : '<span class="challenge-progress">进行中</span>'}
        </article>`;
    }).join('') || '';
    const content = `
        <div class="page-header">
            <h1><i class="fas fa-calendar-check"></i> 每周社区挑战</h1>
            <p>每周一更新。活动周期：${state ? `${state.week.start} 起，次周一刷新` : '登录后查看'}（北京时间）</p>
        </div>
        ${!user ? '<div class="card">登录后参与每周挑战并领取积分奖励。</div>' : `
        <section class="card challenge-section">
            <h2>个人挑战</h2>
            <p class="challenge-intro">参加公开赛，或在团队帖子中与成员交流。每项任务每周只能领取一次。</p>
            ${personal}
        </section>
        <section class="card challenge-section">
            <h2>团队合作</h2>
            <p class="challenge-intro">团队本周累计 6 条讨论并有至少 2 位成员参与后，已参与讨论的成员可以各自领取奖励。</p>
            ${teams || '<p class="challenge-empty">加入团队后即可参与团队合作目标。</p>'}
        </section>
        <p id="challengeStatus" class="challenge-status" role="status"></p>
        `}
        <script>
        document.querySelectorAll('.challenge-claim').forEach(function(button) {
            button.addEventListener('click', async function() {
                button.disabled = true;
                var payload = { key: button.dataset.key };
                if (button.dataset.teamId) payload.team_id = Number(button.dataset.teamId);
                try {
                    var response = await fetch('/api/challenges/claim', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    var data = await response.json();
                    if (!response.ok) throw new Error(data.error || '领取失败');
                    location.reload();
                } catch (error) {
                    document.getElementById('challengeStatus').textContent = error.message || '领取失败，请稍后重试';
                    button.disabled = false;
                }
            });
        });
        </script>`;
    return getLayout(env, user, '每周社区挑战', content, `
        .challenge-section{margin-bottom:18px}
        .challenge-section>h2{margin:0 0 6px;color:#39234c}
        .challenge-intro,.challenge-empty{color:#777;font-size:13px}
        .challenge-task{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px 0;border-top:1px solid #eee}
        .challenge-task h2{font-size:16px;margin:0 0 5px}
        .challenge-task p{margin:4px 0;color:#777;font-size:13px}
        .challenge-task a{color:#78439a}
        .challenge-claim{flex:none;border:0;border-radius:7px;padding:9px 14px;background:#78439a;color:#fff;font-weight:700;cursor:pointer}
        .challenge-claim:disabled{opacity:.6;cursor:wait}
        .challenge-done,.challenge-progress{flex:none;color:#27ae60;font-size:13px;font-weight:700}
        .challenge-progress{color:#999}
        .challenge-status{color:#c0392b;font-size:13px}
        @media(max-width:560px){.challenge-task{align-items:flex-start;flex-direction:column}.challenge-claim{align-self:flex-start}}
    `, request);
}
