import type { Env, TypedD1Database } from '../env.d';
import { getAtMentionedUsers } from './html';

// 消息通知发送函数
export async function sendNotification(env: Env, toUserId: number, fromUserId: number, content: string, type = 'private', relatedId = 0) {
    if (toUserId === fromUserId) return;
    const db = env.DB;
    await db.prepare(
        `INSERT INTO messages (from_user_id, to_user_id, content, type, related_id) VALUES (?, ?, ?, ?, ?)`
    ).bind(fromUserId, toUserId, content, type, relatedId).run();
}

export async function sendMentionNotifications(
    env: Env,
    fromUserId: number,
    text: string,
    context: string,
    excludedUserIds: number[] = []
) {
    const mentionedUsers = await getAtMentionedUsers(env.DB, text);
    const excluded = new Set(excludedUserIds);
    const excerpt = text.replace(/\s+/g, ' ').trim();
    const content = `${context}: ${excerpt.slice(0, 160)}${excerpt.length > 160 ? '...' : ''}`;

    for (const user of mentionedUsers) {
        if (user.id === fromUserId || excluded.has(user.id)) continue;
        await sendNotification(env, user.id, fromUserId, content, 'mention');
    }
}

// 系统消息未读数量
export async function getSystemUnreadCount(db: TypedD1Database, uid: number) {
    const row = await db.prepare(`SELECT COUNT(*) AS cnt FROM messages WHERE to_user_id = ? AND is_read = 0 AND type != 'pm_chat'`).bind(uid).first();
    return row ? row.cnt : 0;
}

// 私信未读数量
export async function getPmUnreadCount(db: TypedD1Database, uid: number) {
    const row = await db.prepare(`SELECT COUNT(*) AS cnt FROM messages WHERE to_user_id = ? AND is_read = 0 AND type = 'pm_chat'`).bind(uid).first();
    return row ? row.cnt : 0;
}

// 发送私信消息
export async function sendPmChatMessage(env: Env, fromUid: number, toUid: number, content: string) {
    if (fromUid === toUid) return;
    const db = env.DB;
    await db.prepare(
        `INSERT INTO messages (from_user_id, to_user_id, content, type, is_read, related_id) VALUES (?, ?, ?, 'pm_chat', 0, 0)`
    ).bind(fromUid, toUid, content).run();
}