import { getSessionUser, jsonRes } from '../utils/auth';
import { getTranslator } from '../utils/i18n';
import { sendNotification } from '../utils/notification';
import { writeAudit } from '../utils/audit';
import type { Env } from '../env.d';

const targetTypes = new Set(['user', 'avatar', 'article', 'comment', 'ticket']);

export function normalizeReportReason(value: string): string {
    return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, 500);
}

export function buildReportAuditText(
    report: { reason?: string; evidence?: string; target_type?: string; target_id?: number | string },
    status: string,
    adminReason: string
): string {
    const statusLabel = status === 'resolved' ? '已确认违规' : '已驳回举报';
    const userFeedback = normalizeReportReason(report.reason || '');
    const evidence = normalizeReportReason(report.evidence || '');
    const reasonText = normalizeReportReason(adminReason || '');

    return [
        `举报状态: ${statusLabel}`,
        `目标类型: ${report.target_type || 'unknown'}`,
        `目标ID: ${report.target_id || 0}`,
        `用户反馈: ${userFeedback || '无'}`,
        `用户证据: ${evidence || '无'}`,
        `管理员处理理由: ${reasonText || '未填写处理理由'}`,
    ].join(' | ');
}

export async function handleReports(request: Request, env: Env, path: string) {
    const t = getTranslator(request);
    const user = await getSessionUser(env, request);
    if (!user) return jsonRes({ error: t('apiNotLoggedIn') }, 403);

    if (path === '/api/reports' && request.method === 'POST') {
        const form = await request.formData();
        const targetType = String(form.get('target_type') || '');
        const targetId = Number(form.get('target_id'));
        const reason = normalizeReportReason(String(form.get('reason') || ''));
        const evidence = normalizeReportReason(String(form.get('evidence') || ''));

        if (!targetTypes.has(targetType) || !Number.isInteger(targetId) || targetId <= 0 || !reason) {
            return jsonRes({ error: '举报原因不能为空，请填写具体问题说明' }, 400);
        }

        const existing = await env.DB.prepare(
            "SELECT id FROM reports WHERE reporter_id = ? AND target_type = ? AND target_id = ? AND status = 'pending'"
        ).bind(user.id, targetType, targetId).first();
        if (existing) return jsonRes({ error: '你已经举报过该内容，请等待处理' }, 409);

        await env.DB.prepare(
            'INSERT INTO reports (reporter_id, target_type, target_id, reason, evidence) VALUES (?, ?, ?, ?, ?)'
        ).bind(user.id, targetType, targetId, reason, evidence).run();

        const admins = await env.DB.prepare('SELECT id FROM users WHERE admin = 1').all();
        for (const admin of admins.results) {
            await sendNotification(env, Number(admin.id), user.id, `收到新的${targetType}举报，请及时处理`, 'report', targetId);
        }
        return jsonRes({ ok: true });
    }

    const decisionMatch = path.match(/^\/api\/reports\/(\d+)\/decision$/);
    if (decisionMatch && request.method === 'POST') {
        if (!user.admin) return jsonRes({ error: t('apiPermissionDenied') }, 403);
        const id = Number(decisionMatch[1]);
        const form = await request.formData();
        const status = String(form.get('status') || '');
        const resolution = normalizeReportReason(String(form.get('resolution') || ''));
        if (!['resolved', 'dismissed'].includes(status)) return jsonRes({ error: '处理状态无效' }, 400);
        if (status === 'resolved' && !resolution) return jsonRes({ error: '请填写处理理由，并写明是否清除内容/禁言/删除用户等结论' }, 400);

        const report = await env.DB.prepare('SELECT * FROM reports WHERE id = ?').bind(id).first<any>();
        if (!report) return jsonRes({ error: '举报不存在' }, 404);

        let auditDetails = buildReportAuditText(report, status, resolution);
        if (status === 'resolved' && report.target_type === 'avatar') {
            const targetUser = await env.DB.prepare('SELECT avatar_url FROM users WHERE id = ?').bind(report.target_id).first<any>();
            const oldAvatarUrl = String(targetUser?.avatar_url || '');
            await env.DB.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').bind('', report.target_id).run();
            auditDetails += ` | 原头像URL: ${oldAvatarUrl || '无'}`;
        }

        await env.DB.prepare(
            "UPDATE reports SET status = ?, handled_by = ?, resolution = ?, handled_at = datetime('now') WHERE id = ?"
        ).bind(status, user.id, resolution, id).run();
        await writeAudit(env, user.id, `处理举报：${status}`, report.target_type, report.target_id, auditDetails);
        await sendNotification(env, Number(report.reporter_id), user.id, status === 'resolved' ? '你提交的举报已确认处理' : '你提交的举报经审核后未成立', 'report_result', id);
        return new Response(null, { status: 302, headers: { Location: '/backend' } });
    }

    return jsonRes({ error: t('apiNotFound') }, 404);
}
