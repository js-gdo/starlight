import zhCN from '../lang/zh-cn';
import enUS from '../lang/en-us';

export type TranslationMap = Record<string, string>;

const languageMap: Record<string, TranslationMap> = {
  'zh-cn': zhCN,
  'zh': zhCN,
  'zh-hans': zhCN,
  'en-us': enUS,
  'en': enUS,
  'en-gb': enUS,
};

const DEFAULT_LANGUAGE = 'zh-cn';

export function resolveLanguageCode(lang?: string | null): string {
  const code = (lang || DEFAULT_LANGUAGE).toLowerCase();
  if (languageMap[code]) return code;
  if (code.startsWith('en')) return 'en-us';
  if (code.startsWith('zh')) return 'zh-cn';
  return DEFAULT_LANGUAGE;
}

export function getLanguageFile(lang?: string | null): TranslationMap {
  return languageMap[resolveLanguageCode(lang)] || languageMap[DEFAULT_LANGUAGE];
}

export function getCurrentLanguage(req?: Request): string {
  if (!req) return DEFAULT_LANGUAGE;
  const cookie = req.headers.get('Cookie') || '';
  const match = cookie.match(/(?:^|;\s*)lang=([^;]+)/);
  const raw = match ? decodeURIComponent(match[1]) : undefined;
  return resolveLanguageCode(raw);
}

export function GetText(id: string, langOrReq?: string | Request | null): string {
  const locale = typeof langOrReq === 'string' || langOrReq === null || langOrReq === undefined
    ? resolveLanguageCode(langOrReq || undefined)
    : getCurrentLanguage(langOrReq);
  const dict = getLanguageFile(locale);
  return dict[id] || id;
}

export function setLanguageCookie(lang: string): string {
  const normalized = resolveLanguageCode(lang);
  return `lang=${encodeURIComponent(normalized)}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
}

export function getLanguageSwitch(currentLang?: string): string {
  const lang = resolveLanguageCode(currentLang || DEFAULT_LANGUAGE);
  return `
    <div class="language-switch-wrap" style="position:fixed;top:14px;right:18px;z-index:200;">
      <select class="language-switch" onchange="document.cookie='lang=' + encodeURIComponent(this.value) + '; path=/; max-age=31536000; SameSite=Lax'; location.reload();" style="padding:5px 10px;border-radius:999px;border:1px solid rgba(142,68,173,0.3);background:#fff;color:#333;box-shadow:0 2px 8px rgba(0,0,0,0.06);font-size:12px;cursor:pointer;">
        <option value="zh-cn" ${lang === 'zh-cn' ? 'selected' : ''}>中文</option>
        <option value="en-us" ${lang === 'en-us' ? 'selected' : ''}>English</option>
      </select>
    </div>
  `;
}
