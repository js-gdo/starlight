import { htmlEscape } from './html';

const VIOLATION_API_KEY = 'bdc4eb58b4da0ecc';

export async function checkViolation(content: string) {
    if (!content || !String(content).trim()) return { violated: false, words: [] };
    try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 5000);
        const res = await fetch(
            `https://api.auth.top/api/aidetect?key=${VIOLATION_API_KEY}&content=${encodeURIComponent(String(content))}`,
            { signal: ctrl.signal }
        );
        clearTimeout(timer);
        if (!res.ok) return { violated: false, words: [], error: 'API状态异常' };
        const data = await res.json();
        if (data.code === 200 && data.data) {
            return {
                violated: data.data.is_violated === true,
                count: data.data.violation_count || 0,
                words: (data.data.violated_words || []).map((w: any) => w.word)
            };
        }
        return { violated: false, words: [] };
    } catch (e) {
        console.error('违禁词检测失败:', e);
        return { violated: false, words: [], error: (e as Error).message };
    }
}

export function violationErrorPage(violation: any) {
    const words = (violation.words || []).join('、') || '未知违规内容';
    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<link rel="icon" type="image/x-icon" href="https://raw.githubusercontent.com/js-gdo/static/refs/heads/gh-pages/icon/sl/icon.ico">
<title>内容违规 - StarLight</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);}
.box{background:#fff;padding:40px;border-radius:12px;text-align:center;max-width:420px;box-shadow:0 8px 30px rgba(0,0,0,0.15);}
.icon{font-size:52px;margin-bottom:14px;}
h2{color:#333;margin-bottom:10px;font-size:20px;}
p{color:#666;margin-bottom:6px;font-size:14px;}
.words{background:#fee;color:#c33;padding:10px 16px;border-radius:6px;margin:14px 0;display:inline-block;font-size:14px;font-weight:500;word-break:break-all;}
.btn{background:#8E44AD;color:#fff;border:none;padding:10px 28px;border-radius:6px;cursor:pointer;font-size:14px;font-weight:500;margin-top:14px;transition:background 0.2s;}
.btn:hover{background:#7d3c98;}
</style></head>
<body><div class="box">
<div class="icon">警告</div>
<h2>内容包含违禁词</h2>
<p>您提交的内容中检测到违规词汇：</p>
<div class="words">${words}</div>
<p style="margin-top:10px;">请修改后重新提交。</p>
<button class="btn" onclick="history.back()">返回修改</button>
</div></body></html>`;
    return new Response(html, { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}