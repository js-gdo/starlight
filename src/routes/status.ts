import { htmlEscape } from '../utils/html';
import type { Env } from '../env.d';

const DEFAULT_REDIRECT_DELAY = 5;

function getReturnPath(request: Request): string {
    const referer = request.headers.get('Referer');
    if (!referer) return '/';

    try {
        const refererUrl = new URL(referer);
        const requestUrl = new URL(request.url);
        if (refererUrl.origin !== requestUrl.origin) return '/';
        return `${refererUrl.pathname}${refererUrl.search}${refererUrl.hash}` || '/';
    } catch {
        return '/';
    }
}

async function getRedirectDelay(env: Env, request: Request): Promise<number> {
    const cookie = request.headers.get('Cookie') || '';
    const match = cookie.match(/(?:^|;\s*)uid=([^;]+)/);
    if (!match) return DEFAULT_REDIRECT_DELAY;

    try {
        const row = await env.DB.prepare(
            'SELECT redirect_delay_seconds FROM users WHERE id = ? AND use = 1'
        ).bind(Number.parseInt(match[1].split('.')[0], 10)).first<{ redirect_delay_seconds?: number }>();
        const delay = Number(row?.redirect_delay_seconds);
        return Number.isInteger(delay) && (delay === 0 || delay >= 5) ? delay : DEFAULT_REDIRECT_DELAY;
    } catch {
        return DEFAULT_REDIRECT_DELAY;
    }
}

export async function renderStatusPage(
    env: Env,
    request: Request,
    status: number,
    title: string,
    message: string
): Promise<Response> {
    const delay = await getRedirectDelay(env, request);
    const returnPath = getReturnPath(request);
    const isError = status >= 400;
    const countdown = delay > 0
        ? `<p id="statusCountdown" style="color:#777;font-size:14px;">${delay} 秒后自动返回</p>`
        : '<p id="statusCountdown" style="color:#777;font-size:14px;">已关闭自动返回</p>';
    const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${htmlEscape(title)} - StarLight</title>
  <style>
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f5f3f7;color:#333;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
    .status-card{width:min(560px,calc(100% - 40px));box-sizing:border-box;padding:42px 34px;text-align:center;background:#fff;border-radius:14px;box-shadow:0 8px 30px rgba(50,30,70,.1)}
    .status-icon{width:58px;height:58px;margin:0 auto 18px;border-radius:50%;display:grid;place-items:center;color:#fff;font-size:30px;background:${isError ? '#e74c3c' : '#27ae60'}}
    h1{margin:0;cursor:pointer;font-size:25px;user-select:none}
    p{line-height:1.7}.message{margin:16px 0 4px;color:#555;word-break:break-word}
    a{color:#8e44ad;text-decoration:none;font-weight:600}a:hover{text-decoration:underline}
    .paused{color:#e67e22!important}
  </style>
</head>
<body>
  <main class="status-card">
    <div class="status-icon" aria-hidden="true">${isError ? '!' : '✓'}</div>
    <h1 id="statusTitle" title="3 秒内点击三次可暂停自动返回">${htmlEscape(title)}</h1>
    <p class="message">${htmlEscape(message)}</p>
    ${countdown}
    <p><a href="${htmlEscape(returnPath)}">立即返回</a></p>
  </main>
  <script>
    (function () {
      var delay = ${delay};
      var target = ${JSON.stringify(returnPath)};
      var countdown = document.getElementById('statusCountdown');
      var title = document.getElementById('statusTitle');
      var timer = null;
      var interval = null;
      var clicks = 0;
      var clickWindow = null;
      function stop() {
        if (timer) window.clearTimeout(timer);
        if (interval) window.clearInterval(interval);
        timer = null;
        interval = null;
        countdown.textContent = '自动返回已暂停';
        countdown.className = 'paused';
      }
      if (delay > 0) {
        var remaining = delay;
        interval = window.setInterval(function () {
          remaining -= 1;
          if (remaining > 0) countdown.textContent = remaining + ' 秒后自动返回';
        }, 1000);
        timer = window.setTimeout(function () { window.location.assign(target); }, delay * 1000);
      }
      title.addEventListener('click', function () {
        clicks += 1;
        if (!clickWindow) clickWindow = window.setTimeout(function () {
          clicks = 0;
          clickWindow = null;
        }, 3000);
        if (clicks >= 3) {
          if (clickWindow) window.clearTimeout(clickWindow);
          stop();
          clicks = 0;
          clickWindow = null;
        }
      });
    }());
  </script>
</body>
</html>`;
    return new Response(html, {
        status,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
}

export function wantsHtmlNavigation(request: Request): boolean {
    const accept = request.headers.get('Accept') || '';
    return accept.includes('text/html');
}
