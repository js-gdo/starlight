import type { Env } from '../env.d';
import zh from '../locales/zh';
import en from '../locales/en';

type Language = 'zh' | 'en';
type TranslationKeys = keyof typeof zh;

const locales = { zh, en };

// 从请求中获取语言偏好（优先从 cookie 或查询参数）
export function getLanguage(request?: Request): Language {
    if (!request) return 'zh';
    const url = new URL(request.url);
    const langParam = url.searchParams.get('lang') as Language;
    if (langParam && (langParam === 'zh' || langParam === 'en')) return langParam;

    const cookie = request.headers.get('Cookie') || '';
    const match = cookie.match(/(?:^|;\s*)lang=([^;]+)/);
    if (match && (match[1] === 'zh' || match[1] === 'en')) return match[1] as Language;

    return 'zh'; // 默认中文
}

// 翻译函数，支持变量替换如 {name}
export function t(key: TranslationKeys, lang: Language = 'zh', vars?: Record<string, string | number>): string {
    let text = locales[lang]?.[key] ?? locales['zh'][key] ?? key;
    if (vars) {
        for (const [k, v] of Object.entries(vars)) {
            text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
        }
    }
    return text;
}

// 获取当前请求的语言，并返回翻译函数
export function getTranslator(request?: Request): (key: TranslationKeys, vars?: Record<string, string | number>) => string {
    const lang = getLanguage(request);
    return (key: TranslationKeys, vars?: Record<string, string | number>) => t(key, lang, vars);
}

// 导出类型以便在组件中使用
export type { TranslationKeys, Language };