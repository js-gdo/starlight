import type { Env } from '../env.d';
import { hmacSha256, randomHex, constantTimeEqual } from './crypto';

const SESSION_COOKIE = 'uid';
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
let cachedSessionSecret: string | null = null;
let lastOnlinePeakAt = 0;

// 登录暴力破解防护：按 IP 在滑动窗口内统计失败次数
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_SECONDS = 300; // 5 分钟

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
    } catch (error) {
        console.warn('[auth] 读取 session_secret 失败，将重新生成会话密钥。', String(error));
    }
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
    return constantTimeEqual(expected, signature) ? { uid, version } : null;
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
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
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

/**
 * 中国省级行政区划代码（Cloudflare request.cf.region）→ 中文省份名映射。
 * 未命中的代码原样返回，非中国地区返回原始地区码。
 */
const CN_REGION_NAMES: Record<string, string> = {
    BJ: '北京', TJ: '天津', HE: '河北', SX: '山西', NM: '内蒙古',
    LN: '辽宁', JL: '吉林', HL: '黑龙江', SH: '上海', JS: '江苏',
    ZJ: '浙江', AH: '安徽', FJ: '福建', JX: '江西', SD: '山东',
    HA: '河南', HB: '湖北', HN: '湖南', GD: '广东', GX: '广西',
    HI: '海南', CQ: '重庆', SC: '四川', GZ: '贵州', YN: '云南',
    XZ: '西藏', SN: '陕西', GS: '甘肃', QH: '青海', NX: '宁夏',
    XJ: '新疆', TW: '台湾', MO: '澳门', HK: '香港',
};

/**
 * 根据 Cloudflare 内置的 request.cf 信息获取大致地理位置（省份、城市）。
 * 不再调用任何外部 IP 定位 API，避免把用户 IP 泄露给第三方并消除外部依赖。
 */
export function getLocationInfo(
    cfRegion?: string,
    cfCity?: string
): { region: string; city: string } {
    const rawRegion = String(cfRegion || '').trim();
    const region = (rawRegion && CN_REGION_NAMES[rawRegion.toUpperCase()]) || rawRegion;
    const city = String(cfCity || '').trim();
    return { region, city };
}

async function recordOnlinePeak(env: Env, now: Date): Promise<void> {
    const nowMs = now.getTime();
    if (nowMs - lastOnlinePeakAt < 60_000) return;
    lastOnlinePeakAt = nowMs;
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

/**
 * 查询当前 IP 是否被登录限流锁定。返回是否被锁与剩余等待秒数。
 */
export async function getLoginThrottleState(env: Env, ip: string): Promise<{ blocked: boolean; retryAfterSeconds: number }> {
    if (!ip) return { blocked: false, retryAfterSeconds: 0 };
    const now = Math.floor(Date.now() / 1000);
    try {
        const row = await env.DB.prepare('SELECT attempts, window_start FROM login_attempts WHERE key = ?')
            .bind(`login:${ip}`).first<{ attempts: number; window_start: number }>();
        if (!row) return { blocked: false, retryAfterSeconds: 0 };
        const windowStart = Number(row.window_start || 0);
        const attempts = Number(row.attempts || 0);
        if (now - windowStart >= LOGIN_WINDOW_SECONDS) return { blocked: false, retryAfterSeconds: 0 };
        if (attempts >= LOGIN_MAX_ATTEMPTS) {
            return { blocked: true, retryAfterSeconds: Math.max(0, windowStart + LOGIN_WINDOW_SECONDS - now) };
        }
        return { blocked: false, retryAfterSeconds: 0 };
    } catch {
        return { blocked: false, retryAfterSeconds: 0 };
    }
}

/**
 * 记录一次登录失败；窗口过期则重置计数。
 */
export async function recordLoginFailure(env: Env, ip: string): Promise<void> {
    if (!ip) return;
    const key = `login:${ip}`;
    const now = Math.floor(Date.now() / 1000);
    try {
        await env.DB.prepare(
            `INSERT INTO login_attempts (key, attempts, window_start) VALUES (?, 1, ?)
             ON CONFLICT(key) DO UPDATE SET
               attempts = CASE WHEN ? - login_attempts.window_start >= ? THEN 1 ELSE login_attempts.attempts + 1 END,
               window_start = CASE WHEN ? - login_attempts.window_start >= ? THEN ? ELSE login_attempts.window_start END`
        ).bind(key, now, now, LOGIN_WINDOW_SECONDS, now, LOGIN_WINDOW_SECONDS, now).run();
    } catch {
        // 限流失败不应阻塞登录主流程
    }
}

/**
 * 登录成功后清除该 IP 的失败计数。
 */
export async function clearLoginFailures(env: Env, ip: string): Promise<void> {
    if (!ip) return;
    try {
        await env.DB.prepare('DELETE FROM login_attempts WHERE key = ?').bind(`login:${ip}`).run();
    } catch { }
}
