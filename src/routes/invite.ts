import { getSessionUser } from '../utils/auth';
import { getLayout } from '../utils/layout';
import { htmlEscape } from '../utils/html';
import { createInviteCode } from '../utils/invite';
import type { Env } from '../env.d';

export async function renderInvite(env: Env, request: Request): Promise<Response> {
    const user = await getSessionUser(env, request);
    if (!user) return new Response(null, { status: 302, headers: { Location: '/login' } });

    const inviteCode = await createInviteCode(String(user.username || ''));
    const referrals = await env.DB.prepare(
        `SELECT u.id, u.username, u.created_at, COUNT(c.checkin_date) AS checkins
         FROM referrals r
         JOIN users u ON u.id = r.invitee_id
         LEFT JOIN referral_checkins c ON c.invitee_id = r.invitee_id
         WHERE r.inviter_id = ?
         GROUP BY u.id, u.username, u.created_at
         ORDER BY u.id DESC`
    ).bind(user.id).all<{ id: number; username: string; created_at: string; checkins: number }>();
    const entries = (referrals.results || []).map(referral => `
        <tr>
            <td>${referral.id}</td>
            <td>${htmlEscape(referral.username)}</td>
            <td>${htmlEscape(referral.created_at || '')}</td>
            <td>${Number(referral.checkins || 0)}</td>
            <td>${50 + Number(referral.checkins || 0)}</td>
        </tr>
    `).join('');
    const totalCheckins = (referrals.results || []).reduce((total, referral) => total + Number(referral.checkins || 0), 0);
    const inviteUrl = `${new URL(request.url).origin}/register?invite=${encodeURIComponent(inviteCode)}`;
    const content = `
        <div class="page-header"><h1><i class="fas fa-user-plus"></i> 邀请好友</h1></div>
        <div class="card invite-card">
            <h2>我的邀请码</h2>
            <p>好友注册时填写邀请码，你获得 50 积分，好友获得 30 积分。好友每次签到，你再获得 1 积分。</p>
            <div class="invite-code" id="inviteCode">${htmlEscape(inviteCode)}</div>
            <div class="invite-actions">
                <button type="button" onclick="copyInviteValue('${htmlEscape(inviteCode)}')">复制邀请码</button>
                <button type="button" onclick="copyInviteValue('${htmlEscape(inviteUrl)}')">复制邀请链接</button>
            </div>
            <a href="${htmlEscape(inviteUrl)}" target="_blank" rel="noopener noreferrer">打开注册链接</a>
        </div>
        <div class="invite-stats">
            <div class="card"><strong>${(referrals.results || []).length}</strong><span>成功邀请</span></div>
            <div class="card"><strong>${totalCheckins}</strong><span>好友签到次数</span></div>
            <div class="card"><strong>${(referrals.results || []).length * 50 + totalCheckins}</strong><span>邀请奖励积分</span></div>
        </div>
        <div class="card invite-card">
            <h2>邀请记录</h2>
            <div style="overflow-x:auto">
                <table class="invite-table">
                    <thead><tr><th>UID</th><th>用户名</th><th>注册时间</th><th>签到次数</th><th>已得积分</th></tr></thead>
                    <tbody>${entries || '<tr><td colspan="5" class="invite-empty">还没有邀请记录</td></tr>'}</tbody>
                </table>
            </div>
        </div>
        <script>
          async function copyInviteValue(value) {
            try {
              await navigator.clipboard.writeText(value);
              toast('已复制到剪贴板');
            } catch (error) {
              console.error('Unable to copy invite value:', error);
              toast('复制失败，请手动复制', 'error');
            }
          }
        </script>
    `;
    const response = await getLayout(env, user, '邀请好友', content, `
        .invite-card{margin-bottom:14px}
        .invite-card h2{font-size:16px;margin-bottom:8px}
        .invite-card p{color:#666;font-size:13px;margin-bottom:14px}
        .invite-code{font-size:32px;font-weight:800;letter-spacing:8px;color:#8e44ad;margin:12px 0}
        .invite-actions{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}
        .invite-actions button{border:0;border-radius:5px;background:#8e44ad;color:white;padding:8px 12px;cursor:pointer}
        .invite-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:14px}
        .invite-stats .card{display:grid;gap:5px;text-align:center}
        .invite-stats strong{font-size:24px;color:#8e44ad}
        .invite-stats span,.invite-empty{font-size:12px;color:#888}
        .invite-table{width:100%;border-collapse:collapse;font-size:13px}
        .invite-table th,.invite-table td{text-align:left;padding:10px;border-bottom:1px solid #eee}
    `, request);
    return new Response(response, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
