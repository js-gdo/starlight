import type { Env } from '../env.d';

const OJ_BASE_URL = 'https://oj.lin114514.top';

function ojUrl(path: string, request: Request): URL {
    const url = new URL(path, OJ_BASE_URL);
    const incoming = new URL(request.url);
    for (const key of ['pid', 'sid']) {
        const value = incoming.searchParams.get(key);
        if (value) url.searchParams.set(key, value);
    }
    return url;
}

async function proxyJson(url: URL, init?: RequestInit): Promise<Response> {
    try {
        const response = await fetch(url, {
            ...init,
            headers: {
                Accept: 'application/json',
                ...(init?.headers || {}),
            },
        });
        const body = await response.text();
        return new Response(body, {
            status: response.status,
            headers: { 'Content-Type': response.headers.get('Content-Type') || 'application/json; charset=utf-8' },
        });
    } catch (error) {
        console.error('OJ upstream request failed:', error);
        return new Response(JSON.stringify({ error: 'OJ 服务暂时不可用，请稍后重试' }), {
            status: 502,
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
        });
    }
}

export async function handleOj(request: Request, _env: Env, path: string): Promise<Response> {
    if (path === '/api/oj/problems') {
        return proxyJson(ojUrl('/api/get/problem/list', request));
    }
    if (path === '/api/oj/problem') {
        return proxyJson(ojUrl('/api/get/problem', request));
    }
    if (path === '/api/oj/submission') {
        return proxyJson(ojUrl('/api/get/submission', request));
    }
    if (path === '/api/oj/judge' && request.method === 'POST') {
        const body = await request.text();
        return proxyJson(ojUrl('/api/judge/anonymous', request), {
            method: 'POST',
            body,
            headers: { 'Content-Type': request.headers.get('Content-Type') || 'application/json' },
        });
    }
    return new Response(JSON.stringify({ error: 'OJ API not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
}
