import { getSessionUser, jsonRes } from '../utils/auth';
import { checkViolation, violationErrorPage } from '../utils/violation';
import { sendNotification } from '../utils/notification';
import { getTicketStatus } from '../utils/constants';
import { getTranslator } from '../utils/i18n';
import { validateAtMentionSpacing } from '../utils/html';
import type { Env } from '../env.d';

export async function handleTickets(request: Request, env: Env, path: string) {
    const t = getTranslator(request);
    const method = request.method;
    const db = env.DB;
    const user = await getSessionUser(env, request);

    // 创建工单
    if (path === '/api/tickets' && method === 'POST') {
        if (!user) return jsonRes({ error: t('apiNotLoggedIn') }, 403);
        const form = await request.formData();
        const title = form.get('title');
        const content = form.get('content');
        if (!title || !content) return jsonRes({ error: t('apiMissingParams') });

        const invalidMentions = validateAtMentionSpacing(String(content));
        if (invalidMentions.length > 0) return jsonRes({ error: t('apiAtMentionFormat') }, 400);

        const violation = await checkViolation(`${title}\n${content}`);
        if (violation.violated) return violationErrorPage(violation, t);

        await db.prepare('INSERT INTO tickets (title, content, author_id) VALUES (?, ?, ?)')
            .bind(title, content, user.id).run();
        return new Response(null, { status: 302, headers: { Location: '/ticket/list' } });
    }

    // 更新工单或指派
    const ticketMatch = path.match(/^\/api\/tickets\/(\d+)$/);
    if (ticketMatch && method === 'POST') {
        const id = parseInt(ticketMatch[1]);
        const form = await request.formData();
        const methodOverride = form.get('_method');

        if (methodOverride === 'PUT') {
            if (!user) return jsonRes({ error: t('apiNotLoggedIn') }, 403);
            const ticket = await db.prepare('SELECT * FROM tickets WHERE id = ?').bind(id).first();
            if (!ticket) return jsonRes({ error: t('apiTicketNotFound') });
            if (user.id !== ticket.author_id && !user.admin) return jsonRes({ error: t('apiPermissionDenied') });

            const title = form.get('title');
            const content = form.get('content');
            if (!title || !content) return jsonRes({ error: t('apiMissingTitleOrContent') });
            const invalidMentions = validateAtMentionSpacing(String(content));
            if (invalidMentions.length > 0) return jsonRes({ error: t('apiAtMentionFormat') }, 400);

            const violation = await checkViolation(`${title}\n${content}`);
            if (violation.violated) return violationErrorPage(violation, t);

            await db.prepare('UPDATE tickets SET title = ?, content = ? WHERE id = ?')
                .bind(title, content, id).run();
            return new Response(null, { status: 302, headers: { Location: `/ticket/${id}` } });
        } else {
            // 指派处理人
            if (!user || !user.admin) return jsonRes({ error: t('apiPermissionDenied') }, 403);
            const assignee_id = parseInt(String(form.get('assignee_id'))) || 0;
            await db.prepare('UPDATE tickets SET assignee_id = ? WHERE id = ?').bind(assignee_id, id).run();
            if (assignee_id > 0 && assignee_id !== user.id) {
                const ticket = await db.prepare('SELECT * FROM tickets WHERE id = ?').bind(id).first();
                if (ticket) {
                    await sendNotification(
                        env,
                        assignee_id,
                        user.id,
                        t('ticketAssignedNotify', { title: ticket.title }),
                        'ticket_assign',
                        id
                    );
                }
            }
            return new Response(null, { status: 302, headers: { Location: `/ticket/${id}` } });
        }
    }

    // 更新状态
    const statusMatch = path.match(/^\/api\/tickets\/(\d+)\/status$/);
    if (statusMatch && method === 'POST') {
        if (!user || !user.admin) return jsonRes({ error: t('apiPermissionDenied') }, 403);
        const id = parseInt(statusMatch[1]);
        const form = await request.formData();
        const status = form.get('status');
        const ticket = await db.prepare('SELECT * FROM tickets WHERE id = ?').bind(id).first();
        if (!ticket) return jsonRes({ error: t('apiTicketNotFound') });

        await db.prepare('UPDATE tickets SET status = ? WHERE id = ?').bind(status, id).run();
        if (ticket.author_id !== user.id) {
            const statusLabel = getTicketStatus(String(status)).label;
            await sendNotification(
                env,
                ticket.author_id,
                user.id,
                t('ticketStatusUpdatedNotify', { title: ticket.title, status: statusLabel }),
                'ticket_status',
                id
            );
        }
        return new Response(null, { status: 302, headers: { Location: `/ticket/${id}` } });
    }

    // 回复工单
    const replyMatch = path.match(/^\/api\/tickets\/(\d+)\/replies$/);
    if (replyMatch && method === 'POST') {
        if (!user) return jsonRes({ error: t('apiNotLoggedIn') }, 403);
        const id = parseInt(replyMatch[1]);
        const form = await request.formData();
        const content = form.get('content');
        if (!content) return jsonRes({ error: t('apiMissingParams') });

        const invalidMentions = validateAtMentionSpacing(String(content));
        if (invalidMentions.length > 0) return jsonRes({ error: t('apiAtMentionFormat') }, 400);

        const violation = await checkViolation(content);
        if (violation.violated) return violationErrorPage(violation, t);

        await db.prepare('INSERT INTO ticket_replies (ticket_id, author_id, content) VALUES (?, ?, ?)')
            .bind(id, user.id, content).run();

        const ticket = await db.prepare('SELECT * FROM tickets WHERE id = ?').bind(id).first();
        if (ticket) {
            const preview = content.substring(0, 50) + (content.length > 50 ? '...' : '');
            if (ticket.author_id !== user.id) {
                await sendNotification(
                    env,
                    ticket.author_id,
                    user.id,
                    t('ticketReplyNotify', { title: ticket.title, preview: preview }),
                    'ticket_reply',
                    id
                );
            }
            if (ticket.assignee_id > 0 && ticket.assignee_id !== user.id && ticket.assignee_id !== ticket.author_id) {
                await sendNotification(
                    env,
                    ticket.assignee_id,
                    user.id,
                    t('ticketReplyNotify', { title: ticket.title, preview: preview }),
                    'ticket_reply',
                    id
                );
            }
        }
        return new Response(null, { status: 302, headers: { Location: `/ticket/${id}` } });
    }

    return jsonRes({ error: t('apiNotFound') }, 404);
}