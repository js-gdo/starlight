import { jsonRes } from '../utils/auth';
import type { Env } from '../env.d';

const CHINA_TIMEZONE = 'Asia/Shanghai (UTC+8)';
const ACTIVE_WINDOW_MS = 5 * 60 * 1000;

function getChinaDayRange(now: Date): { date: string; start: string; end: string } {
    const chinaNow = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const date = chinaNow.toISOString().slice(0, 10);
    const nextDay = new Date(`${date}T00:00:00.000Z`);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    return {
        date,
        start: new Date(nextDay.getTime() - 24 * 60 * 60 * 1000 - 8 * 60 * 60 * 1000).toISOString(),
        end: new Date(nextDay.getTime() - 8 * 60 * 60 * 1000).toISOString(),
    };
}

async function countByDate(db: Env['DB'], table: string, dateColumn: string, start: string, end: string): Promise<number> {
    const row = await db.prepare(
        `SELECT COUNT(*) AS total FROM ${table} WHERE datetime(${dateColumn}) >= datetime(?) AND datetime(${dateColumn}) < datetime(?)`
    ).bind(start, end).first<{ total?: number }>();
    return Number(row?.total || 0);
}

export async function handleHealth(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'GET') {
        return jsonRes({ error: 'Method Not Allowed' }, 405);
    }

    const now = new Date();
    const { date, start, end } = getChinaDayRange(now);
    const activeSince = new Date(now.getTime() - ACTIVE_WINDOW_MS).toISOString();

    try {
        const [currentOnlineRow, activeTodayRow, peakTodayRow, totalUsersRow, totalArticlesRow, totalCommentsRow, totalTicketsRow, totalReportsRow, totalMessagesRow, newTickets, newReports, newArticles, newComments, newUsers, newMessages, newCheckins] = await Promise.all([
            env.DB.prepare("SELECT COUNT(*) AS total FROM users WHERE use = 1 AND last_active_at >= datetime(?)").bind(activeSince).first<{ total?: number }>(),
            env.DB.prepare("SELECT COUNT(*) AS total FROM users WHERE use = 1 AND last_active_at >= datetime(?) AND last_active_at < datetime(?)").bind(start, end).first<{ total?: number }>(),
            env.DB.prepare("SELECT MAX(peak_count) AS total FROM online_hourly_stats WHERE hour_start >= ? AND hour_start < ?").bind(start, end).first<{ total?: number }>(),
            env.DB.prepare('SELECT COUNT(*) AS total FROM users').first<{ total?: number }>(),
            env.DB.prepare('SELECT COUNT(*) AS total FROM articles').first<{ total?: number }>(),
            env.DB.prepare('SELECT COUNT(*) AS total FROM comments').first<{ total?: number }>(),
            env.DB.prepare('SELECT COUNT(*) AS total FROM tickets').first<{ total?: number }>(),
            env.DB.prepare('SELECT COUNT(*) AS total FROM reports').first<{ total?: number }>(),
            env.DB.prepare('SELECT COUNT(*) AS total FROM messages').first<{ total?: number }>(),
            countByDate(env.DB, 'tickets', 'created_at', start, end),
            countByDate(env.DB, 'reports', 'created_at', start, end),
            countByDate(env.DB, 'articles', 'created_at', start, end),
            countByDate(env.DB, 'comments', 'created_at', start, end),
            countByDate(env.DB, 'users', 'created_at', start, end),
            countByDate(env.DB, 'messages', 'created_at', start, end),
            countByDate(env.DB, 'online_hourly_stats', 'hour_start', start, end),
        ]);

        return jsonRes({
            status: 'ok',
            service: {
                status: 'operational',
                timezone: CHINA_TIMEZONE,
                checked_at: now.toISOString(),
            },
            period: {
                date_china: date,
                start_utc: start,
                end_utc: end,
            },
            access: {
                current_online: Number(currentOnlineRow?.total || 0),
                active_users_today: Number(activeTodayRow?.total || 0),
                peak_online_today: Number(peakTodayRow?.total || 0),
                online_stat_records_today: newCheckins,
            },
            tickets: {
                total: Number(totalTicketsRow?.total || 0),
                new_today: newTickets,
            },
            content: {
                users: Number(totalUsersRow?.total || 0),
                new_users_today: newUsers,
                articles: Number(totalArticlesRow?.total || 0),
                new_articles_today: newArticles,
                comments: Number(totalCommentsRow?.total || 0),
                new_comments_today: newComments,
                reports: Number(totalReportsRow?.total || 0),
                reports_today: newReports,
                messages: Number(totalMessagesRow?.total || 0),
                messages_today: newMessages,
            },
        });
    } catch (error) {
        console.error('Health API error:', error);
        return jsonRes({
            status: 'degraded',
            service: {
                status: 'database_unavailable',
                timezone: CHINA_TIMEZONE,
                checked_at: now.toISOString(),
            },
            period: { date_china: date, start_utc: start, end_utc: end },
        }, 503);
    }
}
