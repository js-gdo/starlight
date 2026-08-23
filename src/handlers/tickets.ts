import { getSessionUser, jsonRes } from '../utils/auth';
import { checkViolation, violationErrorPage } from '../utils/violation';
import { sendNotification } from '../utils/notification';
import { getTicketStatus } from '../utils/constants';
import type { Env } from '../env.d';

export async function handleTickets(request: Request, env: Env, path: string) {
    const method = request.method;
    const db = env.DB;
    const user = await getSessionUser(env, request);

    // 创建工单
    if (path === '/api/tickets' && method === 'POST') {
        if (!user) return jsonRes({ error: '未登录' }, 403);
        const form = await request.formData();
        const title = form.get('title');
        const content = form.get('content');
        if (!title || !content) return jsonRes({ error: '缺少参数' });

        const violation = await checkViolation(`${title}\n${content}`);
        if (violation.violated) return violationErrorPage(violation);

        await db.prepare('INSERT INTO tickets (title, content, author_id) VALUES (?, ?, ?)')
            .bind(title, content, user.id).run();
        return new Response(null, { status: 302, headers: { Location: '/ticket/list' } });
    }

    // 更新工单或指派：/api/tickets/:id
    const ticketMatch = path.match(/^\/api\/tickets\/(\d+)$/);
    if (ticketMatch && method === 'POST') {
        const id = parseInt(ticketMatch[1]);
        const form = await request.formData();
        const methodOverride = form.get('_method');

        if (methodOverride === 'PUT') {
            if (!user) return jsonRes({ error: '未登录' }, 403);
            const ticket = await db.prepare('SELECT * FROM tickets WHERE id = ?').bind(id).first();
            if (!ticket) return jsonRes({ error: '工单不存在' });
            if (user.id !== ticket.author_id && !user.admin) return jsonRes({ error: '无权限' });

            const title = form.get('title');
            const content = form.get('content');
            if (!title || !content) return jsonRes({ error: '标题和内容不能为空' });
            const violation = await checkViolation(`${title}\n${content}`);
            if (violation.violated) return violationErrorPage(violation);

            await db.prepare('UPDATE tickets SET title = ?, content = ? WHERE id = ?')
                .bind(title, content, id).run();
            return new Response(null, { status: 302, headers: { Location: `/ticket/${id}` } });
        } else {
            // 指派处理人
            if (!user || !user.admin) return jsonRes({ error: '无权限' }, 403);
            const assignee_id = parseInt(String(form.get('assignee_id'))) || 0;
            await db.prepare('UPDATE tickets SET assignee_id = ? WHERE id = ?').bind(assignee_id, id).run();
            if (assignee_id > 0 && assignee_id !== user.id) {
                const ticket = await db.prepare('SELECT * FROM tickets WHERE id = ?').bind(id).first();
                if (ticket) {
                    await sendNotification(env, assignee_id, user.id,
                        `您被指派处理工单: ${ticket.title}`, 'ticket_assign', id);
                }
            }
            return new Response(null, { status: 302, headers: { Location: `/ticket/${id}` } });
        }
    }

    // 更新状态：/api/tickets/:id/status
    const statusMatch = path.match(/^\/api\/tickets\/(\d+)\/status$/);
    if (statusMatch && method === 'POST') {
        if (!user || !user.admin) return jsonRes({ error: '无权限' }, 403);
        const id = parseInt(statusMatch[1]);
        const form = await request.formData();
        const status = form.get('status');
        const ticket = await db.prepare('SELECT * FROM tickets WHERE id = ?').bind(id).first();
        if (!ticket) return jsonRes({ error: '工单不存在' });

        await db.prepare('UPDATE tickets SET status = ? WHERE id = ?').bind(status, id).run();
        if (ticket.author_id !== user.id) {
            await sendNotification(env, ticket.author_id, user.id,
                `工单 "${ticket.title}" 状态已更新为: ${getTicketStatus(String(status)).label}`,
                'ticket_status', id);
        }
        return new Response(null, { status: 302, headers: { Location: `/ticket/${id}` } });
    }

    // 回复工单：/api/tickets/:id/replies
    const replyMatch = path.match(/^\/api\/tickets\/(\d+)\/replies$/);
    if (replyMatch && method === 'POST') {
        if (!user) return jsonRes({ error: '未登录' }, 403);
        const id = parseInt(replyMatch[1]);
        const form = await request.formData();
        const content = form.get('content');
        if (!content) return jsonRes({ error: '内容不能为空' });

        const violation = await checkViolation(content);
        if (violation.violated) return violationErrorPage(violation);

        await db.prepare('INSERT INTO ticket_replies (ticket_id, author_id, content) VALUES (?, ?, ?)')
            .bind(id, user.id, content).run();

        const ticket = await db.prepare('SELECT * FROM tickets WHERE id = ?').bind(id).first();
        if (ticket) {
            if (ticket.author_id !== user.id) {
                await sendNotification(env, ticket.author_id, user.id,
                    `工单 "${ticket.title}" 有新回复: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`,
                    'ticket_reply', id);
            }
            if (ticket.assignee_id > 0 && ticket.assignee_id !== user.id && ticket.assignee_id !== ticket.author_id) {
                await sendNotification(env, ticket.assignee_id, user.id,
                    `工单 "${ticket.title}" 有新回复: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`,
                    'ticket_reply', id);
            }
        }
        return new Response(null, { status: 302, headers: { Location: `/ticket/${id}` } });
    }

    return jsonRes({ error: 'Not found' }, 404);
}