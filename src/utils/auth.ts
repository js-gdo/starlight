import type { Env } from '../env.d';

/**
 * 从请求中获取指定名称的 Cookie 值
 */
export function getCookie(req: Request, name: string): string | null {
    const cookie = req.headers.get('Cookie') || '';
    const match = cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? match[2] : null;
}

/**
 * 根据 Cookie 中的 uid 获取当前登录用户信息
 * 同时会节流更新用户的 last_active_at 字段（距上次更新超过 60 秒）
 */
export async function getSessionUser(env: Env, req: Request): Promise<any | null> {
    const uid = getCookie(req, 'uid');
    if (!uid) return null;
    try {
        const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(parseInt(uid)).first();
        if (user) {
            const now = new Date();
            const lastActive = user.last_active_at ? new Date(user.last_active_at) : null;
            if (!lastActive || (now.getTime() - lastActive.getTime()) > 60000) {
                await env.DB.prepare('UPDATE users SET last_active_at = ? WHERE id = ?')
                    .bind(now.toISOString(), user.id).run();
                user.last_active_at = now.toISOString();
            }
        }
        return user;
    } catch {
        return null;
    }
}

/**
 * 生成一个 16 位随机十六进制字符串（用于帖子 hex_id）
 */
export function generateHex(): string {
    return 'xxxxxxxxxxxxxxxx'.replace(/x/g, () => (Math.random() * 16 | 0).toString(16));
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
 * 获取权限的中文名称
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
 * 根据 IP 地址获取大致的地理位置（省份、城市）
 * 使用外部 API https://v2.xxapi.cn，超时 3 秒，失败则返回传入的备用值
 */
export async function getLocationInfo(
    ip: string,
    cfRegion?: string,
    cfCity?: string
): Promise<{ region: string; city: string }> {
    let region = cfRegion || '';
    let city = cfCity || '';
    try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 3000);
        const ipRes = await fetch(`https://v2.xxapi.cn/api/ip?ip=${encodeURIComponent(ip)}`, { signal: ctrl.signal });
        clearTimeout(timer);
        if (ipRes.ok) {
            const ipData = await ipRes.json();
            if (ipData.code === 200 && ipData.data && ipData.data.address) {
                const addr = ipData.data.address.replace(/^中国/, '');
                const m = addr.match(/^(.+?(?:省|市|自治区|特别行政区))(.*)$/);
                if (m) {
                    region = m[1];
                    city = m[2] || '';
                } else {
                    region = addr;
                }
            }
        }
    } catch {
        // 忽略错误，返回备用值
    }
    return { region, city };
}