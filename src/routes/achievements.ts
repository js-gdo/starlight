import { getSessionUser } from '../utils/auth';
import { getLayout } from '../utils/layout';
import { getAchievementBadges, getUserAchievementIds, ACHIEVEMENTS, syncAchievements } from '../utils/achievements';
import { htmlEscape } from '../utils/html';
import type { Env } from '../env.d';

export async function renderAchievements(env: Env, req: Request) {
    const user = await getSessionUser(env, req);
    const earned = new Set<string>();
    if (user) {
        await syncAchievements(env.DB, user.id);
        for (const id of await getUserAchievementIds(env.DB, user.id)) earned.add(id);
    }

    const content = `
        <div class="page-header">
            <h1><i class="fas fa-medal"></i> 成就系统</h1>
            <p style="margin-top:4px;">记录你在 StarLight 社区留下的足迹。</p>
        </div>
        <div class="card">
            <div class="achievement-grid">
                ${ACHIEVEMENTS.map((achievement) => `
                    <div class="achievement-card${earned.has(achievement.id) ? ' is-earned' : ''}">
                        <div class="achievement-icon" style="color:${achievement.color};">${htmlEscape(achievement.icon)}</div>
                        <div>
                            <h3>${htmlEscape(achievement.name)} ${earned.has(achievement.id) ? '<span class="achievement-earned">已获得</span>' : ''}</h3>
                            <p>${htmlEscape(achievement.description)}${achievement.prerequisites?.length ? `<br><span class="achievement-prereq">前置：${achievement.prerequisites.map((id) => htmlEscape(ACHIEVEMENTS.find((item) => item.id === id)?.name || id)).join('、')}</span>` : ''}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
            ${user ? `<div class="achievement-summary">你已获得 ${earned.size} / ${ACHIEVEMENTS.length} 项成就 ${await getAchievementBadges(env.DB, user.id)}</div>` : '<div class="achievement-summary">登录后可以查看自己的成就进度。</div>'}
        </div>
    `;

    return getLayout(env, user, '成就系统', content, `
        .achievement-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:12px; }
        .achievement-card { display:flex; gap:12px; align-items:flex-start; padding:14px; border:1px solid #eee; border-radius:8px; background:#fafafa; opacity:.58; }
        .achievement-card.is-earned { opacity:1; border-color:#e8d9f1; background:#fdfaff; }
        .achievement-icon { width:34px; height:34px; display:flex; align-items:center; justify-content:center; font-size:25px; font-weight:700; flex-shrink:0; }
        .achievement-card h3 { font-size:14px; margin:0 0 5px; color:#333; }
        .achievement-card p { color:#888; font-size:12px; line-height:1.5; }
        .achievement-earned { color:#27ae60; font-size:11px; font-weight:500; margin-left:4px; }
        .achievement-summary { margin-top:16px; padding-top:12px; border-top:1px solid #eee; color:#777; font-size:13px; }
        .achievement-badge { display:inline-block; margin-left:3px; font-size:13px; font-weight:700; vertical-align:1px; cursor:help; }
        .achievement-prereq { color:#a06ab8; font-size:11px; }
    `, req);
}
