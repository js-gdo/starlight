import { getSessionUser } from '../utils/auth';
import { getLayout } from '../utils/layout';
import { renderAvatar, renderUsernameLink } from '../utils/html';
import type { Env } from '../env.d';

type LeaderboardUser = {
    id: number;
    username: string;
    color: string;
    tag: string;
    avatar_url: string;
    points: number;
};

const badgeColors = {
    gold: '#f1c40f',
    blue: '#3498db',
    green: '#5eb95e',
} as const;

function renderRankBadge(level: keyof typeof badgeColors): string {
    const color = badgeColors[level];
    return `<svg class="rank-badge" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="${color}" aria-label="${level} rank" title="${level} rank"><path d="M16 8C16 6.84375 15.25 5.84375 14.1875 5.4375C14.6562 4.4375 14.4688 3.1875 13.6562 2.34375C12.8125 1.53125 11.5625 1.34375 10.5625 1.8125C10.1562 0.75 9.15625 0 8 0C6.8125 0 5.8125 0.75 5.40625 1.8125C4.40625 1.34375 3.15625 1.53125 2.34375 2.34375C1.5 3.1875 1.3125 4.4375 1.78125 5.4375C0.71875 5.84375 0 6.84375 0 8C0 9.1875 0.71875 10.1875 1.78125 10.5938C1.3125 11.5938 1.5 12.8438 2.34375 13.6562C3.15625 14.5 4.40625 14.6875 5.40625 14.2188C5.8125 15.2812 6.8125 16 8 16C9.15625 16 10.1562 15.28125 10.5625 14.2188C11.5938 14.6875 12.8125 14.5 13.6562 13.6562C14.4688 12.8438 14.6562 11.5938 14.1875 10.5938C15.25 10.1875 16 9.1875 16 8ZM11.4688 6.625L7.375 10.6875C7.21875 10.8438 7 10.8125 6.875 10.6875L4.5 8.3125C4.375 8.1875 4.375 7.96875 4.5 7.8125L5.3125 7C5.46875 6.875 5.6875 6.875 5.8125 7.03125L7.125 8.34375L10.1562 5.34375C10.3125 5.1875 10.5312 5.1875 10.6562 5.34375L11.4688 6.15625Z"></path></svg>`;
}

function getBadgeLevel(rank: number, total: number): keyof typeof badgeColors | null {
    if (total < 1) return null;
    const goldLimit = Math.max(1, Math.ceil(total * 0.1));
    const blueLimit = Math.max(goldLimit, Math.ceil(total * 0.3));
    const greenLimit = Math.max(blueLimit, Math.ceil(total * 0.6));
    if (rank <= goldLimit) return 'gold';
    if (rank <= blueLimit) return 'blue';
    if (rank <= greenLimit) return 'green';
    return null;
}

export async function renderLeaderboard(env: Env, req: Request) {
    const user = await getSessionUser(env, req);
    const totalRow = await env.DB.prepare('SELECT COUNT(*) AS count FROM users WHERE use = 1').first<{ count: number }>();
    const total = Number(totalRow?.count || 0);
    const rows = await env.DB.prepare(
        `SELECT id, username, color, tag, avatar_url, points
         FROM users
         WHERE use = 1
         ORDER BY points DESC, id ASC
         LIMIT 50`
    ).all<LeaderboardUser>();

    const entries = rows.results.map((entry, index) => {
        const rank = index + 1;
        const badge = getBadgeLevel(rank, total);
        const username = `${renderUsernameLink(entry.username, entry.color, entry.tag, entry.id)}${badge ? ` ${renderRankBadge(badge)}` : ''}`;
        const rankClass = rank <= 3 ? ` leaderboard-rank-${rank}` : '';
        return `
            <tr>
                <td class="leaderboard-rank${rankClass}">${rank}</td>
                <td><div class="leaderboard-user">${renderAvatar(entry, 32)}<span>${username}</span></div></td>
                <td class="leaderboard-points">${Number(entry.points || 0).toLocaleString('zh-CN')}</td>
            </tr>
        `;
    }).join('');

    const content = `
        <div class="page-header">
            <h1><i class="fas fa-ranking-star"></i> 积分榜</h1>
            <p style="margin-top:4px;">全服积分排名，展示前 50 名用户。</p>
        </div>
        <div class="card">
            <div class="leaderboard-legend">
                <span>${renderRankBadge('gold')} 前 10%</span>
                <span>${renderRankBadge('blue')} 之后 20%</span>
                <span>${renderRankBadge('green')} 之后 30%*</span>
            </div>
            <p class="leaderboard-count">当前共有 ${total.toLocaleString('zh-CN')} 名活跃用户参与排名</p>
            ${entries ? `
                <div style="overflow-x:auto;">
                    <table class="leaderboard-table">
                        <thead><tr><th>排名</th><th>用户</th><th>积分</th></tr></thead>
                        <tbody>${entries}</tbody>
                    </table>
                </div>
            ` : `<div class="leaderboard-empty">暂无积分记录。</div>`}
            <p class="leaderboard-note">* 勾标按全服活跃用户总数计算，榜单仅展示前 50 名。</p>
        </div>
    `;

    return getLayout(env, user, '积分榜', content, `
        .leaderboard-legend { display:flex; gap:16px; flex-wrap:wrap; align-items:center; color:#666; font-size:13px; margin-bottom:8px; }
        .rank-badge { display:inline-block; vertical-align:-3px; margin-left:2px; }
        .leaderboard-count, .leaderboard-note { color:#999; font-size:12px; }
        .leaderboard-table { width:100%; border-collapse:collapse; margin-top:12px; }
        .leaderboard-table th, .leaderboard-table td { padding:10px 8px; border-bottom:1px solid #eee; text-align:left; }
        .leaderboard-table th { color:#888; font-size:12px; font-weight:600; }
        .leaderboard-rank { width:72px; color:#888; font-weight:600; }
        .leaderboard-rank-1 { color:#d4a400; font-size:18px; }
        .leaderboard-rank-2 { color:#7d8b99; font-size:17px; }
        .leaderboard-rank-3 { color:#b87333; font-size:16px; }
        .leaderboard-user { display:flex; align-items:center; gap:8px; min-width:180px; }
        .leaderboard-points { color:#8E44AD; font-weight:700; font-variant-numeric:tabular-nums; }
        .leaderboard-empty { padding:28px 0; text-align:center; color:#999; }
        .leaderboard-note { margin-top:12px; }
    `, req);
}
