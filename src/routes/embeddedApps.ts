import { getLayout } from '../utils/layout';
import { htmlEscape } from '../utils/html';
import type { Env } from '../env.d';

const APP_ID_PATTERN = /^[0-9a-f-]{36}$/i;

export async function renderEmbeddedApp(env: Env, request: Request, path: string): Promise<Response> {
    const match = path.match(/^\/apps\/iframe\/([0-9a-f-]{36})$/i);
    if (!match || !APP_ID_PATTERN.test(match[1])) {
        return new Response('找不到这个 App', { status: 404 });
    }

    const app = await env.DB.prepare(
        'SELECT id, title, url, note, icon FROM embedded_apps WHERE id = ?'
    ).bind(match[1].toLowerCase()).first<{ id: string; title: string; url: string; note: string; icon: string }>();
    if (!app) return new Response('找不到这个 App', { status: 404 });

    let targetUrl: URL;
    try {
        targetUrl = new URL(app.url);
    } catch {
        throw new Error(`Embedded App ${app.id} has an invalid URL.`);
    }
    if (!['http:', 'https:'].includes(targetUrl.protocol) || targetUrl.username || targetUrl.password) {
        throw new Error(`Embedded App ${app.id} has an unsafe URL.`);
    }

    const icon = /^fa-[a-z0-9-]{1,60}$/.test(app.icon) ? app.icon : 'fa-window-maximize';
    const content = `
        <main class="embedded-app">
            <header class="embedded-app-heading">
                <h1><i class="fas ${htmlEscape(icon)}"></i> ${htmlEscape(app.title)}</h1>
                ${app.note ? `<p>${htmlEscape(app.note)}</p>` : ''}
            </header>
            <iframe
                class="embedded-app-frame"
                src="${htmlEscape(targetUrl.href)}"
                title="${htmlEscape(app.title)}"
                loading="lazy"
                referrerpolicy="no-referrer"
                sandbox="allow-forms allow-scripts allow-popups"
            ></iframe>
        </main>
        <style>
            .embedded-app{display:flex;min-height:calc(100vh - 150px);flex-direction:column;gap:12px}
            .embedded-app-heading h1{margin:0;color:#2c3e50;font-size:22px}
            .embedded-app-heading h1 i{color:#8e44ad}
            .embedded-app-heading p{margin:6px 0 0;color:#687780;white-space:pre-wrap}
            .embedded-app-frame{display:block;width:100%;min-height:460px;flex:1;border:1px solid #dce4e3;border-radius:8px;background:#fff}
            @media(max-width:600px){.embedded-app{min-height:calc(100vh - 120px)}.embedded-app-frame{min-height:60vh}}
        </style>`;
    const html = await getLayout(env, null, app.title, content, '', request);
    return new Response(html, {
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'X-Content-Type-Options': 'nosniff',
        },
    });
}
