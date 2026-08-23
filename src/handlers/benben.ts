import { getSessionUser, jsonRes } from '../utils/auth';
import { checkViolation, violationErrorPage } from '../utils/violation';
import type { Env } from '../env.d';

export async function handleBenben(request: Request, env: Env, path: string) {
    const method = request.method;
    const db = env.DB;
    const user = await getSessionUser(env, request);

    if (path === '/api/benben' && method === 'POST') {
        if (!user) return jsonRes({ error: '未登录' }, 403);
        if (!user.speak) return jsonRes({ error: '您已被禁言，无法发布动态。如需申诉，请提交工单。' }, 403);

        const form = await request.formData();
        const content = form.get('content');
        if (!content || content.trim() === '') return jsonRes({ error: '内容不能为空' }, 400);

        const violation = await checkViolation(content);
        if (violation.violated) return violationErrorPage(violation);

        await db.prepare('INSERT INTO benben (content, author_id) VALUES (?, ?)')
            .bind(content.trim(), user.id).run();
        return new Response(null, { status: 302, headers: { Location: '/benben' } });
    }

    // 删除动态：/api/benben/:id
    const match = path.match(/^\/api\/benben\/(\d+)$/);
    if (match && method === 'POST') {
        if (!user) return jsonRes({ error: '未登录' }, 403);
        const id = parseInt(match[1]);
        const benben = await db.prepare('SELECT * FROM benben WHERE id = ?').bind(id).first();
        if (!benben) return jsonRes({ error: '动态不存在' });
        if (user.id !== benben.author_id && !user.admin) return jsonRes({ error: '无权限' });
        await db.prepare('DELETE FROM benben WHERE id = ?').bind(id).run();
        return new Response(null, { status: 302, headers: { Location: '/benben' } });
    }

    return jsonRes({ error: 'Not found' }, 404);
}