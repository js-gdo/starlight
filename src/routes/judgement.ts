import { getSessionUser } from '../utils/auth';
import { getLayout } from '../utils/layout';
import { renderUsernameLink, htmlEscape } from '../utils/html';
import { formatTimeToChina } from '../utils/time';
import { getTranslator } from '../utils/i18n';
import type { Env } from '../env.d';

export async function renderJudgement(env: Env, req: Request) {
    const t = getTranslator(req);
    const user = await getSessionUser(env, req);
    const db = env.DB;

    let unreadCount = 0;
    if (user) {
        const countResult = await db.prepare('SELECT COUNT(*) as cnt FROM messages WHERE to_user_id = ? AND is_read = 0')
            .bind(user.id).first();
        unreadCount = countResult ? countResult.cnt : 0;
    }

    const logs = await db.prepare(
        `SELECT p.*, u.username as target_name, u.color as target_color, u.tag as target_tag,
                a.username as admin_name, a.color as admin_color, a.tag as admin_tag
         FROM permission_logs p
         JOIN users u ON p.target_id = u.id
         JOIN users a ON p.admin_id = a.id
         ORDER BY p.created_at DESC LIMIT 100`
    ).all();

    const content = `
        <div class="page-header"><h1><i class="fas fa-gavel"></i> ${t('judgement')}</h1></div>
        <div class="card">
            <h2 style="font-size:16px;font-weight:600;margin-bottom:12px;"><i class="fas fa-history"></i> ${t('permissionLog')}</h2>
            ${logs.results.length === 0 ? `
                <div style="color:#999;padding:20px 0;text-align:center;">${t('noLogs')}</div>
            ` : `
                ${logs.results.map((log: any) => `
                    <div style="padding:10px 0;border-bottom:1px solid #f5f5f5;">
                        <div>
                            ${log.action === 'grant' ?
            `<span style="color:#2ecc71;font-weight:600;"><i class="fas fa-check-circle"></i> ${t('logActionGrant')}</span>` :
            `<span style="color:#e74c3c;font-weight:600;"><i class="fas fa-times-circle"></i> ${t('logActionRevoke')}</span>`
        }
                            ${renderUsernameLink(log.target_name, log.target_color, log.target_tag, log.target_id)}
                            ${log.action === 'grant' ? t('grantPermission') : t('revokePermission')}
                            <strong>${t('permission' + (log.permission === 'use' ? 'Use' : log.permission === 'speak' ? 'Speak' : 'Admin'))}</strong>
                        </div>
                        <div style="color:#999;font-size:13px;">${t('reason')}：${htmlEscape(log.reason)}</div>
                        <div style="color:#999;font-size:12px;">
                            ${t('operator')}：${renderUsernameLink(log.admin_name, log.admin_color, log.admin_tag, log.admin_id)}
                            · ${formatTimeToChina(log.created_at)}
                        </div>
                    </div>
                `).join('')}
            `}
        </div>
    `;
    return await getLayout(env, user, t('judgement'), content, '', req);
}