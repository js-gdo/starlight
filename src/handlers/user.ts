import { getSessionUser, jsonRes } from '../utils/auth';
import { checkViolation, violationErrorPage } from '../utils/violation';
import type { Env } from '../env.d';

export async function handleUser(request: Request, env: Env, path: string) {
    const method = request.method;
    const db = env.DB;
    const user = await getSessionUser(env, request);

    // 修改个性签名
    if (path === '/api/user/bio' && method === 'POST') {
        if (!user) return jsonRes({ error: '未登录' }, 403);
        if (!user.speak) return jsonRes({ error: '您已被禁言，无法修改资料。如需申诉，请提交工单。' }, 403);

        const form = await request.formData();
        const bio = form.get('bio') || '';
        const violation = await checkViolation(bio);
        if (violation.violated) return violationErrorPage(violation);

        await db.prepare('UPDATE users SET bio = ? WHERE id = ?').bind(bio.trim(), user.id).run();
        return new Response(null, { status: 302, headers: { Location: `/user/${user.id}` } });
    }

    // 其他 /api/user/* 可在此扩展，但本项目中只有 /api/user/bio 和 /api/user/find（后者已放入 pm.ts）
    return jsonRes({ error: 'Not found' }, 404);
}