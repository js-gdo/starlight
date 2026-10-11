import type { Env } from '../env.d';
import { hmacSha256, randomHex } from './crypto';

const SESSION_COOKIE = 'uid';
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
let cachedSessionSecret: string | null = null;

/**
 * 从请求中获取指定名称的 Cookie 值
 */
export function getCookie(req: Request, name: string): string | null {
    const cookie = req.headers.get('Cookie') || '';
    const match = cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? match[2] : null;
}

/**
 * 会话密钥存放在 site_settings，缺失时生成并落库
 */
async function getSessionSecret(env: Env): Promise<string> {
    if (cachedSessionSecret) return cachedSessionSecret;
    try {
        const row = await env.DB.prepare("SELECT setting_value FROM site_settings WHERE setting_key = 'session_secret'").first<Record<string, any>>();
        if (row && row.setting_value) {
            cachedSessionSecret = String(row.setting_value);
            return cachedSessionSecret;
        }
    } catch { }
    const secret = randomHex(32);
    try {
        await env.DB.prepare("INSERT OR IGNORE INTO site_settings (setting_key, setting_value) VALUES ('session_secret', ?)").bind(secret).run();
        const row = await env.DB.prepare("SELECT setting_value FROM site_settings WHERE setting_key = 'session_secret'").first<Record<string, any>>();
        cachedSessionSecret = row && row.setting_value ? String(row.setting_value) : secret;
    } catch {
        cachedSessionSecret = secret;
    }
    return cachedSessionSecret;
}

export function getSessionMaxAge(): number {
    return SESSION_TTL_SECONDS;
}

export function serializeSessionCookie(request: Request, value: string, maxAge: number): string {
    const url = new URL(request.url);
    const localDevelopment = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    const secure = url.protocol === 'https:' || !localDevelopment ? '; Secure' : '';
    const expiry = maxAge === 0 ? '; Expires=Thu, 01 Jan 1970 00:00:00 GMT' : '';
    return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${expiry}${secure}`;
}

/**
 * 签发会话 Cookie 值，格式为 uid.expires.signature
 */
export async function createSession(env: Env, uid: number, version?: number): Promise<string> {
    const expires = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
    let sessionVersion = version;
    if (sessionVersion === undefined) {
        const user = await env.DB.prepare('SELECT session_version FROM users WHERE id = ?').bind(uid).first<Record<string, any>>();
        sessionVersion = Number(user?.session_version || 0);
    }
    const payload = `${uid}.${expires}.${Math.max(0, Math.trunc(sessionVersion))}`;
    return `${payload}.${await hmacSha256(await getSessionSecret(env), payload)}`;
}

/**
 * 校验会话 Cookie 值并取出 uid，签名不符或已过期返回 null
 */
async function verifySession(env: Env, value: string | null): Promise<{ uid: number; version: number } | null> {
    if (!value) return null;
    const parts = value.split('.');
    if (parts.length !== 3 && parts.length !== 4) return null;
    const uid = Number.parseInt(parts[0], 10);
    const expires = Number.parseInt(parts[1], 10);
    const version = parts.length === 4 ? Number.parseInt(parts[2], 10) : 0;
    const payload = parts.length === 4 ? `${parts[0]}.${parts[1]}.${parts[2]}` : `${parts[0]}.${parts[1]}`;
    const signature = parts[parts.length - 1];
    if (!uid || !expires || expires < Math.floor(Date.now() / 1000)) return null;
    if (!Number.isSafeInteger(version) || version < 0) return null;
    const expected = await hmacSha256(await getSessionSecret(env), payload);
    return expected === signature ? { uid, version } : null;
}

/**
 * 根据会话 Cookie 获取当前登录用户信息
 * 同时会节流更新用户的 last_active_at 字段（距上次更新超过 60 秒）
 */
export async function getSessionUser(env: Env, req: Request): Promise<any | null> {
    const session = await verifySession(env, getCookie(req, SESSION_COOKIE));
    if (!session) return null;
    try {
        const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(session.uid).first<Record<string, any>>();
        if (user && Number(user.session_version || 0) !== session.version) return null;
        if (user && user.use) {
            const now = new Date();
            const lastActive = user.last_active_at ? new Date(user.last_active_at) : null;
            if (!lastActive || (now.getTime() - lastActive.getTime()) > 60000) {
                await env.DB.prepare('UPDATE users SET last_active_at = ? WHERE id = ?')
                    .bind(now.toISOString(), user.id).run();
                user.last_active_at = now.toISOString();
            }
            await recordOnlinePeak(env, now);
        }
        return user && user.use ? user : null;
    } catch {
        return null;
    }
}

/**
 * 生成一个 16 位随机十六进制字符串（用于帖子 hex_id）
 */
export function generateHex(): string {
    return randomHex(8);
}

/**
 * 返回一个 JSON 格式的 Response 对象
 */
export function jsonRes(data: any, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

/**
 * 获取权限的名称
 */
export function getPermissionName(permission: string): string {
    const map: Record<string, string> = {
        'use': '进入主站',
        'speak': '自由发言',
        'admin': '管理员'
    };
    return map[permission] || permission;
}

async function recordOnlinePeak(env: Env, now: Date): Promise<void> {
    try {
        const activeSince = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
        const activeUsers = await env.DB.prepare(
            'SELECT COUNT(*) AS count FROM users WHERE use = 1 AND last_active_at > ?'
        ).bind(activeSince).first();
        const peakCount = Number(activeUsers?.count || 0);
        const hourStart = new Date(now);
        hourStart.setUTCMinutes(0, 0, 0);
        const hourKey = hourStart.toISOString();
        await env.DB.prepare(
            `INSERT INTO online_hourly_stats (hour_start, peak_count, updated_at)
             VALUES (?, ?, ?)
             ON CONFLICT(hour_start) DO UPDATE SET
               peak_count = MAX(online_hourly_stats.peak_count, excluded.peak_count),
               updated_at = excluded.updated_at`
        ).bind(hourKey, peakCount, now.toISOString()).run();
    } catch {
        // 在线统计不应影响正常请求
    }
}