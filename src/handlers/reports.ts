import { getSessionUser, jsonRes } from '../utils/auth';
import { getTranslator } from '../utils/i18n';
import { sendNotification } from '../utils/notification';
import { writeAudit } from '../utils/audit';
import type { Env } from '../env.d';

const targetTypes = new Set(['user', 'avatar', 'article', 'comment', 'ticket']);
const reportReasons = new Set(['sexual', 'gambling', 'spam', 'abuse', 'other']);

export async function handleReports(request: Request, env: Env, path: string) {
    const t = getTranslator(request);
    const user = await getSessionUser(env, request);
    if (!user) return jsonRes({ error: t('apiNotLoggedIn') }, 403);

    if (path === '/api/reports' && request.method === 'POST') {
        const form = await request.formData();
        const targetType = String(form.get('target_type') || '');
        const targetId = Number(form.get('target_id'));
        const reason = String(form.get('reason') || '');
        const evidence = String(form.get('evidence') || '').trim().slice(0, 500);
        if (!targetTypes.has(targetType) || !Number.isInteger(targetId) || targetId <= 0 || !reportReasons.has(reason)) {
            return jsonRes({ error: '举报参数无效' }, 400);
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
        const resolution = String(form.get('resolution') || '').trim().slice(0, 500);
        if (!['resolved', 'dismissed'].includes(status)) return jsonRes({ error: '处理状态无效' }, 400);
        const report = await env.DB.prepare('SELECT * FROM reports WHERE id = ?').bind(id).first<any>();
        if (!report) return jsonRes({ error: '举报不存在' }, 404);
        if (status === 'resolved' && report.target_type === 'avatar') {
            await env.DB.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').bind('', report.target_id).run();
            await writeAudit(env, user.id, '根据举报清除违规头像', 'avatar', report.target_id, resolution);
        }
        await env.DB.prepare(
            "UPDATE reports SET status = ?, handled_by = ?, resolution = ?, handled_at = datetime('now') WHERE id = ?"
        ).bind(status, user.id, resolution, id).run();
        await writeAudit(env, user.id, `处理举报：${status}`, report.target_type, report.target_id, resolution);
        await sendNotification(env, Number(report.reporter_id), user.id, status === 'resolved' ? '你提交的举报已确认处理' : '你提交的举报经审核后未成立', 'report_result', id);
        return new Response(null, { status: 302, headers: { Location: '/backend' } });
    }

    return jsonRes({ error: t('apiNotFound') }, 404);
}
