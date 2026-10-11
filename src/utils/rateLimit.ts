import { jsonRes } from './auth';

export async function getIpRateLimitKey(request: Request, scope: string): Promise<string> {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
    const fingerprint = Array.from(new Uint8Array(digest).slice(0, 16))
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
    return `${scope}:ip:${fingerprint}`;
}

export async function enforceRateLimit(
    limiter: RateLimit | undefined,
    key: string,
    message: string,
): Promise<Response | null> {
    if (!limiter) throw new Error('Required Cloudflare rate-limit binding is not configured.');
    const result = await limiter.limit({ key });
    if (result.success) return null;
    return jsonRes({ error: message }, 429);
}
