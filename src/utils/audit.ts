import type { Env } from '../env.d';

export async function writeAudit(
    env: Env,
    adminId: number,
    action: string,
    targetType = '',
    targetId = 0,
    details = ''
): Promise<void> {
    await env.DB.prepare(
        'INSERT INTO audit_logs (admin_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)'
    ).bind(adminId, action, targetType, targetId, details).run();
}
