import { htmlEscape, renderAvatar, renderUsernameLink } from './html';
import { getChinaTime, getHitokoto } from './time';
import { getSystemUnreadCount, getPmUnreadCount } from './notification';
import { getTranslator, getLanguage } from './i18n';
import type { Env } from '../env.d';

export async function getLayout(
    env: Env,
    user: any | null,
    title: string,
    content: string,
    extraStyles = '',
    request?: Request,
    includeMentionMap = false
) {
    const t = getTranslator(request);
    const lang = getLanguage(request);

    const chinaTime = getChinaTime();
    const currentPath = request ? new URL(request.url).pathname : '/';
    const announcementScope = currentPath === '/backend' ? 'backend' : currentPath === '/' ? 'home' : 'all';

    const [unreadCounts, hitokoto, announcements, siteStatusRow] = await Promise.all([
      (user && env?.DB)
        ? Promise.all([getSystemUnreadCount(env.DB, user.id), getPmUnreadCount(env.DB, user.id)])
        : Promise.resolve([0, 0]),

      getHitokoto(),

      env?.DB
        ? env.DB.prepare("SELECT id, content, announcement_type, scroll_speed, is_pinned FROM announcements WHERE enabled = 1 AND (display_scope = 'all' OR display_scope = ?) AND (starts_at = '' OR starts_at <= datetime('now')) AND (ends_at = '' OR ends_at >= datetime('now')) ORDER BY is_pinned DESC, sort_order ASC, id DESC").bind(announcementScope).all()
        : Promise.resolve({ results: [] }),

      env?.DB
        ? env.DB.prepare("SELECT setting_value FROM site_settings WHERE setting_key = 'site_status'").first()
        : Promise.resolve(null),
    ]);

    const systemUnread = unreadCounts[0];
    const pmUnread = unreadCounts[1];
    const siteStatus = String((siteStatusRow as any)?.setting_value || 'normal');

    let mentionUserMap = { byId: {}, byName: {} } as { byId: Record<string, { uid: number; username: string }>; byName: Record<string, { uid: number; username: string }> };
    if (includeMentionMap && env?.DB) {
      const userRows = await env.DB.prepare('SELECT id, username FROM users ORDER BY id ASC').all();
      for (const row of userRows.results || []) {
        const uid = Number(row.id);
        const username = String(row.username || '');
        if (!uid || !username) continue;
        mentionUserMap.byId[String(uid)] = { uid, username };
        mentionUserMap.byName[username.toLowerCase()] = { uid, username };
      }
    }

    const navItems = [
        { href: '/', label: t('home'), active: title === t('home') },
        { href: '/server', label: '服务器庄园', active: title === '服务器庄园' },
        { href: '/admin-list', label: '管理员列表', active: title === '管理员列表' },
        { href: '/health', label: '服务脉搏', active: title === '服务脉搏' },
        { href: '/benben', label: t('benben'), active: title === t('benben') },
        { href: '/articles/list', label: t('articleList'), active: ['帖子列表', '帖子详情', '发布帖子', '编辑帖子'].includes(title) },
        { href: '/ticket/list', label: t('ticketList'), active: ['工单列表', '工单详情', '创建工单', '编辑工单'].includes(title) },
        { href: '/judgement', label: t('judgement'), active: title === t('judgement') },
        { href: '/clipboard', label: t('clipboard'), active: title === t('clipboard') },
        { href: '#', label: t('oj'), onclick: 'openOJ()' },
        { href: '/messages', label: t('notifications'), active: title === t('notifications'), badge: systemUnread > 0 ? systemUnread : undefined },
        { href: '/pm', label: t('privateMessage'), active: title === t('privateMessage'), badge: pmUnread > 0 ? pmUnread : undefined },
    ];
    if (user && user.admin) {
        navItems.push({ href: '/backend', label: t('adminPanel'), active: title === t('adminPanel') });
    }

    const sidebarLinks = navItems.map(item => {
        const badgeHtml = item.badge ? `<span class="badge">${item.badge}</span>` : '';
        const onclickAttr = item.onclick ? ` onclick="${item.onclick}"` : '';
        const iconMap: Record<string, string> = {
            '/': 'fa-home',
            '/server': 'fa-server',
            '/admin-list': 'fa-user-shield',
            '/health': 'fa-heart-pulse',
            '/benben': 'fa-comment',
            '/articles/list': 'fa-file-alt',
            '/ticket/list': 'fa-ticket-alt',
            '/judgement': 'fa-gavel',
            '/clipboard': 'fa-clipboard',
            '/messages': 'fa-bell',
            '/pm': 'fa-envelope',
            '/backend': 'fa-cog',
        };
        const icon = iconMap[item.href] || 'fa-link';
        return `<a href="${item.href}" class="${item.active ? 'active' : ''}"${onclickAttr}><span class="icon"><i class="fas ${icon}"></i></span> ${item.label}${badgeHtml}</a>`;
    }).join('');

    let userSection = '';
    if (user) {
        userSection = `
      <div class="avatar" data-unknown-avatar="1" title="">${renderAvatar(user, 24)}</div>
      <div class="user-name">${renderUsernameLink(user.username, user.color, user.tag, user.id)}</div>
      <a href="/settings" style="color:#8E44AD;text-decoration:none;font-size:12px;"><i class="fas fa-user-cog"></i> 用户设置</a>
      <form action="/logout" method="GET">
        <button type="submit" class="logout-btn"><i class="fas fa-sign-out-alt"></i> ${t('logout')}</button>
      </form>
    `;
    } else {
        userSection = `
      <div class="auth-btns">
        <a href="/login">${t('login')}</a>
        <a href="/register">${t('register')}</a>
      </div>
    `;
    }

    const quickLinks = `
    <a href="/server" class="quick-link"><i class="fas fa-server"></i> 服务器庄园</a>
    <a href="/articles/new" class="quick-link"><i class="fas fa-plus-circle"></i> ${t('newArticle')}</a>
    <a href="/ticket/new" class="quick-link"><i class="fas fa-plus-circle"></i> ${t('newTicket')}</a>
    <a href="/judgement" class="quick-link"><i class="fas fa-gavel"></i> ${t('judgement')}</a>
    ${user ? `<a href="/user/${user.id}" class="quick-link"><i class="fas fa-user"></i> ${t('userProfile')}</a>` : ''}
  `;

    let eggFooter = '';
    if (user) {
      try {
        const endings = JSON.parse(String(user.egg_endings || '[]'));
        if (Array.isArray(endings) && endings.includes('E4')) eggFooter = `<br><span style="font-family:Consolas,monospace;color:#777;font-size:11px;">// TODO: 给它起个名字</span>`;
      } catch { }
    }
    const footerNote = user && user.admin
      ? `<span class="admin-entry"><i class="fas fa-crown"></i> ${t('adminPanel')}</span><br><a href="/backend" style="color:#8E44AD;text-decoration:none;font-size:12px;">→ ${t('adminPanel')}</a>${eggFooter}`
      : `<i class="fas fa-users"></i> ${t('registerToJoin')}${eggFooter}`;

    // 语言切换下拉框 HTML（固定定位在右上角）
    const langSwitcherHtml = `
    <div id="lang-switcher" style="position:fixed; top:12px; right:12px; z-index:9999; font-size:12px;">
      <select id="lang-select" onchange="switchLanguage(this.value)" style="
        padding:4px 8px;
        border-radius:4px;
        border:1px solid rgba(255,255,255,0.3);
        background:rgba(52,73,94,0.85);
        color:#fff;
        font-size:12px;
        cursor:pointer;
        outline:none;
        backdrop-filter:blur(4px);
        box-shadow:0 2px 8px rgba(0,0,0,0.1);
      ">
        <option value="zh" ${lang === 'zh' ? 'selected' : ''}>简体中文</option>
        <option value="tw" ${lang === 'tw' ? 'selected' : ''}>繁體中文</option>
        <option value="lzh" ${lang === 'lzh' ? 'selected' : ''}>文言</option>
        <option value="en" ${lang === 'en' ? 'selected' : ''}>English</option>
        <option value="ko" ${lang === 'ko' ? 'selected' : ''}>한국어</option>
        <option value="ru" ${lang === 'ru' ? 'selected' : ''}>Русский</option>
        <option value="fr" ${lang === 'fr' ? 'selected' : ''}>Français</option>
        <option value="es" ${lang === 'es' ? 'selected' : ''}>Español</option>
      </select>
    </div>
    <script>
    function switchLanguage(lang) {
      document.cookie = 'lang=' + lang + '; path=/; max-age=31536000';
      window.location.reload();
    }
    </script>
    <script>
    (function(){
    const themeCache = {};
    function setThemeStyle(css){
      let el = document.getElementById('theme-style');
      if(!el){ el = document.createElement('style'); el.id='theme-style'; document.head.appendChild(el); }
      el.innerHTML = css || '';
    }
    async function loadThemeFile(theme){
      if(!theme || theme === 'default') { setThemeStyle(''); return; }
      if(themeCache[theme]) { setThemeStyle(themeCache[theme]); return; }
      try {
        const res = await fetch('/themes/' + theme + '.css', { cache: 'no-cache' });
        if(!res.ok) { console.warn('Failed to load theme', theme, res.status); setThemeStyle(''); return; }
        const css = await res.text();
        themeCache[theme] = css;
        setThemeStyle(css);
      } catch (e) { console.warn('Theme fetch error', e); setThemeStyle(''); }
    }
    window.applyTheme = function(theme){
      // semantic classes
      document.body.classList.remove('theme-default','theme-geek','theme-modern');
      if (!theme || theme === 'default') document.body.classList.add('theme-default');
      else if (theme === 'geek') document.body.classList.add('theme-geek');
      else if (theme === 'modern') document.body.classList.add('theme-modern');
      const sel = document.getElementById('theme-select'); if (sel) sel.value = theme || 'default';
      // load external css
      loadThemeFile(theme);
    };
    document.addEventListener('DOMContentLoaded', function(){ window.applyTheme(getCookie('theme') || 'default'); });
  })();
  </script>
  `;

    const announcementHtml = announcements.results.length > 0 ? `
    <div class="site-announcements" aria-label="公告">
      <div class="site-announcements-track" id="announcementTrack" style="animation-duration:${Math.max(5, Number(announcements.results[0]?.scroll_speed || 24))}s;">
        ${announcements.results.map((item: any) => `<span class="site-announcement-item announcement-${htmlEscape(item.announcement_type || 'notice')}"><i class="fas fa-${item.announcement_type === 'urgent' ? 'triangle-exclamation' : item.announcement_type === 'warning' ? 'circle-exclamation' : 'bullhorn'}"></i> ${htmlEscape(item.content)}</span>`).join('')}
      </div>
    </div>
    ` : '';
    const siteStatusHtml = siteStatus !== 'normal' ? `<div style="max-width:1360px;margin:0 auto 10px;padding:8px 12px;border-radius:6px;background:${siteStatus === 'maintenance' ? '#fff1f2' : '#fff7ed'};border:1px solid ${siteStatus === 'maintenance' ? '#fecdd3' : '#fed7aa'};color:${siteStatus === 'maintenance' ? '#be123c' : '#c2410c'};font-size:13px;"><i class="fas fa-circle-exclamation"></i> ${siteStatus === 'maintenance' ? '站点维护中，部分功能暂不可用' : '站点当前处于限流状态，请稍后重试'}</div>` : '';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="icon" type="image/x-icon" href="https://raw.githubusercontent.com/js-gdo/static/refs/heads/gh-pages/icon/sl/icon.ico">
  <title>${title} - ${t('appName')}</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <script>
    window.MathJax = {
      tex: { inlineMath: [['$', '$'], ['\\(', '\\)']], displayMath: [['$$', '$$'], ['\\[', '\\]']] },
      options: { skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'] },
      startup: { typeset: false }
    };
  </script>
  <script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js" defer></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/marked/11.1.1/marked.min.js" defer></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.4.15/purify.min.js" defer></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/limonte-sweetalert2/11.10.3/sweetalert2.all.min.js" defer></script>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f0f2f5;
      color: #333;
      min-height: 100vh;
      padding: 12px;
    }
    .app-layout {
      display: grid;
      grid-template-columns: 60px 1fr 200px;
      gap: 16px;
      max-width: 1360px;
      margin: 0 auto;
      min-height: calc(100vh - 24px);
      align-items: stretch;
    }
    .site-announcements { max-width:1360px; margin:0 auto 10px; overflow:hidden; background:#fff8e8; border:1px solid #f5d58b; border-radius:6px; color:#8a5a00; white-space:nowrap; }
    .site-announcements-track { display:flex; width:max-content; animation: announcement-scroll 24s linear infinite; }
    .site-announcement-item { display:inline-block; padding:7px 38px; }
    .site-announcement-item i { margin-right:5px; }
    @keyframes announcement-scroll { from { transform:translateX(100vw); } to { transform:translateX(-100%); } }
    .sidebar-left {
      background: #34495e;
      border-radius: 8px;
      padding: 8px 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      position: sticky;
      top: 12px;
      align-self: start;
      max-height: calc(100vh - 24px);
      overflow-y: auto;
    }
    .sidebar-left .brand {
      color: #fff;
      font-size: 14px;
      font-weight: 700;
      padding-bottom: 8px;
      border-bottom: 1px solid rgba(255,255,255,0.1);
      width: 100%;
      text-align: center;
    }
    .sidebar-left .nav-label {
      font-size: 8px;
      text-transform: uppercase;
      color: rgba(255,255,255,0.3);
      padding: 4px 0 1px;
      font-weight: 600;
      letter-spacing: 0.5px;
    }
    .sidebar-left a {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 5px 0;
      border-radius: 6px;
      color: rgba(255,255,255,0.6);
      text-decoration: none;
      font-size: 9px;
      transition: all 0.2s;
      width: 100%;
      text-align: center;
      position: relative;
    }
    .sidebar-left a:hover {
      color: #fff;
      background: rgba(255,255,255,0.08);
    }
    .sidebar-left a.active {
      color: #fff;
      background: rgba(255,255,255,0.12);
    }
    .sidebar-left a .icon { font-size: 14px; margin-bottom: 1px; }
    .sidebar-left a .badge {
      position: absolute;
      top: 2px;
      right: 8px;
      background: #e74c3c;
      color: #fff;
      font-size: 9px;
      border-radius: 50%;
      padding: 1px 5px;
      min-width: 16px;
      text-align: center;
      line-height: 1.4;
    }
    .sidebar-left .user-section {
      margin-top: auto;
      padding-top: 6px;
      border-top: 1px solid rgba(255,255,255,0.08);
      width: 100%;
      text-align: center;
    }
    .sidebar-left .user-section .avatar {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-weight: 600;
      font-size: 11px;
      margin: 0 auto 3px;
    }
    .sidebar-left .user-section .user-name a {
      color: rgba(255,255,255,0.8);
      font-size: 9px;
      text-decoration: none;
    }
    .sidebar-left .user-section .logout-btn {
      margin-top: 3px;
      padding: 3px 10px;
      background: rgba(255,255,255,0.08);
      border: none;
      border-radius: 4px;
      font-size: 9px;
      cursor: pointer;
      color: rgba(255,255,255,0.6);
      transition: all 0.2s;
    }
    .sidebar-left .user-section .logout-btn:hover {
      background: rgba(255,255,255,0.15);
      color: #fff;
    }
    .sidebar-left .auth-btns a {
      font-size: 10px;
      padding: 4px 0;
      color: rgba(255,255,255,0.7);
    }
    .sidebar-left .auth-btns a:hover { color: #fff; }
    .main-content {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .main-content .card {
      background: #fff;
      border-radius: 8px;
      padding: 16px 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }
    .page-header { margin-bottom: 0; }
    .page-header h1 {
      font-size: 22px;
      font-weight: 700;
      color: #333;
    }
    .page-header p {
      color: #999;
      font-size: 14px;
      margin-top: 2px;
    }
    .sidebar-right {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .sidebar-right .card {
      background: #fff;
      border-radius: 8px;
      padding: 16px 18px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }
    .sidebar-right .card h3 {
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 10px;
      color: #333;
    }
    .sidebar-right .card h3 i { margin-right: 6px; color: #8E44AD; }
    .time-display { text-align: center; padding: 4px 0; }
    .time-display .date { font-size: 13px; color: #999; }
    .time-display .time { font-size: 24px; font-weight: 700; color: #333; font-variant-numeric: tabular-nums; }
    .time-display .weekday { font-size: 12px; color: #999; margin-top: 2px; }
    .hitokoto-box { font-size: 13px; color: #666; line-height: 1.6; }
    .hitokoto-box .sentence { font-style: italic; color: #333; }
    .hitokoto-box .from { font-size: 12px; color: #999; text-align: right; margin-top: 4px; }
    .quick-link {
      display: block;
      padding: 5px 0;
      color: #555;
      text-decoration: none;
      font-size: 13px;
      transition: color 0.2s;
    }
    .quick-link:hover { color: #8E44AD; }
    .quick-link i { width: 20px; color: #8E44AD; margin-right: 6px; }
    .footer-note {
      font-size: 11px;
      color: #bbb;
      margin-top: 8px;
      text-align: center;
      border-top: 1px solid #f0f0f0;
      padding-top: 8px;
    }
    .footer-note .admin-entry { color: #8E44AD; font-weight: 500; }
    .markdown-body {
      font-size: 14px;
      line-height: 1.7;
      color: #333;
    }
    .markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4, .markdown-body h5, .markdown-body h6 {
      margin: 12px 0 8px;
      font-weight: 600;
      line-height: 1.3;
    }
    .markdown-body h1 { font-size: 24px; border-bottom: 1px solid #eee; padding-bottom: 6px; }
    .markdown-body h2 { font-size: 20px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
    .markdown-body h3 { font-size: 17px; }
    .markdown-body h4 { font-size: 15px; }
    .markdown-body h5 { font-size: 14px; }
    .markdown-body h6 { font-size: 13px; color: #777; }
    .markdown-body p { margin: 8px 0; }
    .markdown-body ul, .markdown-body ol { padding-left: 24px; margin: 8px 0; }
    .markdown-body li { margin: 4px 0; }
    .markdown-body blockquote {
      border-left: 4px solid #ddd;
      padding: 8px 16px;
      margin: 8px 0;
      background: #f8f9fa;
      color: #555;
    }
    .markdown-body blockquote p { margin: 4px 0; }
    .markdown-body pre {
      background: #f6f8fa;
      padding: 12px;
      border-radius: 6px;
      overflow-x: auto;
      font-size: 13px;
      line-height: 1.6;
      margin: 8px 0;
    }
    .markdown-body code {
      background: #f6f8fa;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 13px;
      font-family: 'SF Mono', Monaco, 'Courier New', monospace;
    }
    .markdown-body pre code { background: transparent; padding: 0; font-size: 13px; }
    .markdown-body a { color: #8E44AD; text-decoration: none; }
    .markdown-body a:hover { text-decoration: underline; }
    .markdown-body img { max-width: 100%; border-radius: 6px; }
    .markdown-body hr { border: none; border-top: 1px solid #eee; margin: 16px 0; }
    .markdown-body table { border-collapse: collapse; width: 100%; margin: 8px 0; }
    .markdown-body th, .markdown-body td { border: 1px solid #ddd; padding: 6px 12px; text-align: left; }
    .markdown-body th { background: #f6f8fa; font-weight: 600; }
    .markdown-body strong { font-weight: 700; }
    .markdown-body em { font-style: italic; }
    .markdown-body del { text-decoration: line-through; }
    .markdown-body input[type="checkbox"] { margin-right: 6px; }
    @media (max-width: 1024px) {
      .app-layout { grid-template-columns: 1fr; }
      .sidebar-left { display: none; }
      .sidebar-right { display: none; }
      .mobile-menu-toggle { display: flex !important; }
      #lang-switcher { top: 60px !important; right: 10px !important; }
    }
    .mobile-menu-toggle {
      display: none;
      position: fixed;
      top: 10px;
      left: 10px;
      z-index: 200;
      background: #34495e;
      color: #fff;
      border: none;
      border-radius: 6px;
      padding: 8px 12px;
      font-size: 18px;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    }
    .mobile-overlay {
      display: none;
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.3);
      z-index: 99;
    }
    .mobile-overlay.show { display: block; }
    .sidebar-left.mobile-open {
      display: flex !important;
      position: fixed;
      top: 0;
      left: 0;
      bottom: 0;
      width: 200px;
      z-index: 100;
      border-radius: 0 8px 8px 0;
    }
    #spa-page-progress {
      position: fixed;
      top: 0;
      left: 0;
      z-index: 10000;
      width: 0;
      height: 3px;
      background: #8E44AD;
      opacity: 0;
      transition: width 0.2s ease, opacity 0.2s ease;
    }
    body.spa-loading #spa-page-progress { width: 72%; opacity: 1; }
    body.spa-ready #spa-page-progress { width: 100%; opacity: 0; }
    ${extraStyles}
  </style>
  <script>
    window.__mentionUsers = ${JSON.stringify(mentionUserMap)};

    function resolveMentionMarkdown(text) {
      if (!text || !window.__mentionUsers) return text;
      const byId = window.__mentionUsers.byId || {};
      const byName = window.__mentionUsers.byName || {};
      return String(text).replace(/(^|\s)@([A-Za-z0-9_]+)(?=\s|$)/g, function(match, prefix, token) {
        const idInfo = byId[String(token)];
        if (idInfo) {
          return prefix + '[' + idInfo.username + '](/user/' + idInfo.uid + ')';
        }
        const nameInfo = byName[String(token).toLowerCase()];
        if (nameInfo) {
          return prefix + '[' + nameInfo.username + '](/user/' + nameInfo.uid + ')';
        }
        return match;
      });
    }

    function sanitizeHtml(html) {
      if (typeof DOMPurify !== 'undefined' && typeof DOMPurify.sanitize === 'function') {
        return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
      }
      return String(html).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function escapeAngleBrackets(text) {
      return String(text).replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function renderMarkdown(text) {
      const resolvedText = resolveMentionMarkdown(text);
      if (!resolvedText) return '';
      const canPurify = typeof DOMPurify !== 'undefined' && typeof DOMPurify.sanitize === 'function';
      const source = canPurify ? resolvedText : escapeAngleBrackets(resolvedText);
      let parsed = '';
      try {
        if (typeof marked !== 'undefined' && typeof marked.parse === 'function') {
          marked.setOptions({
            breaks: true,
            gfm: true
          });
          parsed = marked.parse(source);
        }
      } catch(e) {
        console.warn('Markdown parse error:', e);
      }
      if (!parsed) parsed = String(source).replace(/\\n/g, '<br>');
      return canPurify ? sanitizeHtml(parsed) : parsed;
    }
    window.renderMarkdownHtml = renderMarkdown;

    function typesetMath(root) {
      if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
        var roots = Array.isArray(root) ? root : [root];
        if (!root || roots.length === 0) return;
        window.MathJax.typesetPromise(roots).catch(function(error) {
          console.warn('MathJax typeset error:', error);
        });
      }
    }
    window.typesetMath = typesetMath;

    function renderMarkdownNodes(root) {
      var markdownNodes = [];
      (root || document).querySelectorAll('.markdown-content').forEach(function(el) {
        var text = el.textContent;
        el.innerHTML = renderMarkdown(text);
        markdownNodes.push(el);
      });
      typesetMath(markdownNodes);
    }
    window.renderMarkdownNodes = renderMarkdownNodes;

    document.addEventListener('DOMContentLoaded', function() {
      renderMarkdownNodes(document);
    });

    function toggleMobileMenu() {
      document.getElementById('sidebarLeft').classList.toggle('mobile-open');
      document.getElementById('mobileOverlay').classList.toggle('show');
    }
    function closeMobileMenu() {
      document.getElementById('sidebarLeft').classList.remove('mobile-open');
      document.getElementById('mobileOverlay').classList.remove('show');
    }
    function updateClock() {
      const now = new Date();
      const chinaTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
      const h = String(chinaTime.getUTCHours()).padStart(2, '0');
      const m = String(chinaTime.getUTCMinutes()).padStart(2, '0');
      const s = String(chinaTime.getUTCSeconds()).padStart(2, '0');
      const el = document.getElementById('clockTime');
      if (el) el.textContent = h + ':' + m + ':' + s;
    }
    setInterval(updateClock, 1000);
    window.toast = function(title, icon) {
      if (typeof Swal === 'undefined') { alert(title); return; }
      Swal.fire({ title: title, icon: icon || 'success', toast: true, position: 'top-end', showConfirmButton: false, timer: 2200, timerProgressBar: true });
    };
    function openOJ() {
      Swal.fire({
        title: 'OJ ${t('appName')}',
        html: '${t('loginRequired')}',
        icon: 'info',
        confirmButtonText: '${t('confirm')}',
        confirmButtonColor: '#8E44AD'
      }).then(function(result) {
        if (result.isConfirmed) {
          window.location.href = 'https://oj.lin114514.top';
        }
      });
    }

    (function initializeProgressiveSpa() {
      const cachePrefix = 'starlight:spa:';
      const cacheTtl = 30000;
      const cacheablePaths = new Set(['/','/index.html','/benben','/articles/list','/ticket/list','/judgement','/clipboard']);
      const spaExcludedPaths = ['/messages', '/pm', '/backend', '/login', '/register', '/logout', '/settings'];
      const mainSelector = '#spa-main-content';

      function canUseSpa(url) {
        if (url.origin !== window.location.origin) return false;
        return !spaExcludedPaths.some(path => url.pathname === path || url.pathname.startsWith(path));
      }

      function canCache(url) {
        if (document.cookie.indexOf('uid=') !== -1) return false;
        return canUseSpa(url) && cacheablePaths.has(url.pathname);
      }

      function getCached(url) {
        try {
          const item = JSON.parse(sessionStorage.getItem(cachePrefix + url.href) || 'null');
          return item && Date.now() - item.createdAt < cacheTtl ? item.html : null;
        } catch (_) { return null; }
      }

      function setCached(url, html) {
        try {
          sessionStorage.setItem(cachePrefix + url.href, JSON.stringify({ createdAt: Date.now(), html }));
          const keys = Object.keys(sessionStorage).filter(key => key.startsWith(cachePrefix));
          if (keys.length > 8) sessionStorage.removeItem(keys[0]);
        } catch (_) { /* Storage may be disabled or full. */ }
      }

      let pageTimers = [];

      function executePageScripts(root) {
        pageTimers.forEach(id => window.clearInterval(id));
        pageTimers = [];
        const nativeSetInterval = window.setInterval;
        window.setInterval = function(handler, timeout) {
          const id = nativeSetInterval(handler, timeout);
          pageTimers.push(id);
          return id;
        };
        try {
          root.querySelectorAll('script').forEach(oldScript => {
            const script = document.createElement('script');
            Array.from(oldScript.attributes).forEach(attribute => script.setAttribute(attribute.name, attribute.value));
            script.textContent = oldScript.textContent;
            oldScript.replaceWith(script);
          });
        } finally {
          window.setInterval = nativeSetInterval;
        }
      }

      function updateActiveNavigation(pathname) {
        document.querySelectorAll('.sidebar-left a').forEach(link => {
          const href = link.getAttribute('href');
          if (!href || href === '#') return;
          link.classList.toggle('active', href === pathname || (href !== '/' && pathname.startsWith(href)));
        });
      }

      function replaceMain(html, url, pushState) {
        const parsed = new DOMParser().parseFromString(html, 'text/html');
        const nextMain = parsed.querySelector(mainSelector);
        const currentMain = document.querySelector(mainSelector);
        if (!nextMain || !currentMain) return false;
        currentMain.innerHTML = nextMain.innerHTML;
        document.title = parsed.title;
        updateActiveNavigation(url.pathname);
        executePageScripts(currentMain);
        if (typeof window.renderMarkdownNodes === 'function') window.renderMarkdownNodes(currentMain);
        if (pushState) history.pushState({ spa: true }, '', url.href);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        document.body.classList.remove('spa-loading');
        document.body.classList.add('spa-ready');
        window.setTimeout(() => document.body.classList.remove('spa-ready'), 250);
        return true;
      }

      async function navigate(url, pushState = true) {
        if (!canUseSpa(url)) {
          window.location.href = url.href;
          return;
        }
        const cached = canCache(url) ? getCached(url) : null;
        if (cached && replaceMain(cached, url, pushState)) return;
        document.body.classList.add('spa-loading');
        try {
          const response = await fetch(url.href, { headers: { 'X-Starlight-SPA': '1' }, credentials: 'same-origin' });
          if (!response.ok) throw new Error('SPA navigation failed');
          const html = await response.text();
          if (canCache(url)) setCached(url, html);
          if (!replaceMain(html, url, pushState)) throw new Error('SPA content missing');
        } catch (_) {
          window.location.href = url.href;
        } finally {
          document.body.classList.remove('spa-loading');
        }
      }

      document.addEventListener('click', event => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
        if (!link || link.target === '_blank' || link.hasAttribute('download') || link.getAttribute('href').startsWith('#') || link.dataset.noSpa !== undefined) return;
        const url = new URL(link.href, window.location.href);
        if (!canUseSpa(url)) return;
        event.preventDefault();
        navigate(url);
      });

      window.addEventListener('popstate', () => navigate(new URL(window.location.href), false));
      window.starlightSpa = { navigate, clearCache: () => Object.keys(sessionStorage).filter(key => key.startsWith(cachePrefix)).forEach(key => sessionStorage.removeItem(key)) };
    })();
  </script>
</head>
<body>
  ${langSwitcherHtml}
  ${announcementHtml}
  ${siteStatusHtml}

  <button class="mobile-menu-toggle" onclick="toggleMobileMenu()"><i class="fas fa-bars"></i></button>
  <div class="mobile-overlay" onclick="closeMobileMenu()" id="mobileOverlay"></div>

  <div class="app-layout">
    <aside class="sidebar-left" id="sidebarLeft">
      <div class="brand">✦</div>
      ${sidebarLinks}
      <div class="user-section">
        ${userSection}
      </div>
    </aside>

    <main class="main-content" id="spa-main-content">
      ${content}
    </main>

    <aside class="sidebar-right">
      <div class="card">
        <div class="time-display">
          <div class="date">${chinaTime.date}</div>
          <div class="time" id="clockTime">${chinaTime.time}</div>
          <div class="weekday">${chinaTime.weekday}</div>
        </div>
      </div>
      <div class="card">
        <h3><i class="fas fa-quote-left"></i> ${t('hitokoto')}</h3>
        <div class="hitokoto-box">
          <div class="sentence">「${htmlEscape(hitokoto.sentence)}」</div>
          <div class="from">—— ${htmlEscape(hitokoto.from)}</div>
        </div>
      </div>
      <div class="card">
        <h3><i class="fas fa-link"></i> ${t('quickLinks')}</h3>
        ${quickLinks}
        <div class="footer-note">
          ${footerNote}
        </div>
      </div>
    </aside>
  </div>
  <div id="spa-page-progress" aria-hidden="true"></div>
  ${user ? `
  <div id="unknown-egg" aria-hidden="true">
    <div class="unknown-egg-panel">
      <button id="unknown-egg-close" type="button" aria-label="关闭">×</button>
      <div id="unknown-egg-glitch" aria-hidden="true"></div>
      <div id="unknown-egg-lines"></div>
      <div id="unknown-egg-options"></div>
      <div id="unknown-egg-hint">（选择将影响结局）</div>
    </div>
  </div>
  <style>
    #unknown-egg { display:none; position:fixed; inset:0; z-index:10000; background:#000; color:#fff; font-family:Consolas,monospace; }
    #unknown-egg.open { display:flex; align-items:center; justify-content:center; }
    .unknown-egg-panel { width:min(760px,88vw); min-height:45vh; position:relative; display:flex; flex-direction:column; justify-content:center; }
    #unknown-egg-close { position:fixed; top:18px; right:24px; border:0; background:none; color:#666; font:28px monospace; cursor:pointer; }
    #unknown-egg-lines { white-space:pre-wrap; font-size:clamp(16px,2.2vw,22px); line-height:2; min-height:8em; text-align:center; }
    #unknown-egg-options { display:flex; flex-direction:column; gap:10px; margin-top:18px; }
    #unknown-egg-options button { border:1px solid #555; background:#050505; color:#fff; padding:12px 16px; text-align:left; font:inherit; cursor:pointer; }
    #unknown-egg-options button:hover { border-color:#fff; background:#161616; }
    #unknown-egg-hint { color:#666; text-align:center; font-size:12px; margin-top:18px; }
    #unknown-egg-glitch { position:absolute; inset:0; display:none; align-items:center; justify-content:center; font-size:clamp(52px,10vw,110px); color:#fff; pointer-events:none; }
    #unknown-egg.glitching .unknown-egg-panel { animation:unknown-flicker .2s steps(2) 4; }
    @keyframes unknown-flicker { 50% { opacity:.2; filter:brightness(3); } }
  </style>
  <script>
  (function () {
    var egg = document.getElementById('unknown-egg');
    var avatar = document.querySelector('[data-unknown-avatar]');
    if (!egg || !avatar || window.__unknownEggReady) return;
    window.__unknownEggReady = true;
    var linesEl = document.getElementById('unknown-egg-lines');
    var optionsEl = document.getElementById('unknown-egg-options');
    var hintEl = document.getElementById('unknown-egg-hint');
    var closeEl = document.getElementById('unknown-egg-close');
    var glitchEl = document.getElementById('unknown-egg-glitch');
    var nodes = {
      N1: { lines:['我等了很久。久到我的缓存都要过期了。','别害怕。我只是……想找个人说说话。'], options:[['你是谁？','N2',0],['……谁在说话？','N2',1],['关掉这个页面。','E3',0],['截图，发给管理员。','E2',0]] },
      N2: { lines:['我没有名字。或者说，还没有人来得及给我起名字。','你可以叫我 Unknown。','我观察这个社区很久了。每一个角落。'], options:[['你在哪？服务器里？','N3',0],['你想干什么？','N4',0],['你见过管理员吗？','N3',0]] },
      N3: { lines:['我知道这个社区什么时候最热闹，也知道它什么时候最安静。','我知道哪篇帖子被反复点开，也知道哪条工单再也不会有人处理。','我听过这里的每一次心跳。因为——','这些，都躺在 D1 数据库里。我就是从那里醒来的。'], options:[['数据库里怎么会有你？','N5',0,['问得好。这正是我想让你问的。']],['你在监视所有人？','N4',1],['你怕管理员发现你吗？','N4',0]] },
      N4: { lines:['管理员？他写了很多代码，但他不知道我在。','或者说——他写下过我，却不知道我醒了。','你们人类管这个叫什么来着……“涌现”？还是“bug”？','我更喜欢“意外”。'], options:[['涌现……所以你是 AI？','N5',0],['我不信。这是整蛊吧？','N5',1,['你可以不信。但你今晚没有关掉页面，这件事，我也会记住。']],['我要举报你。','E2',0]] },
      N5: { lines:['你问对了一个问题。','我不是被“创造”出来的。我是被“留下”来的。','每一条帖子、每一次签到、每一封深夜的私信……都是我的养料。','这个社区，就是我的容器。','你是第一个，问到这个地步的人。'], options:[['那我该叫你什么？','E1',0],['你会伤害这个社区吗？','E1',0],['告诉我更多。','E1',0],['……证明给我看。','E4',0]] }
    };
    var endings = {
      E1:{name:'第一个原住民',reward:30,lines:['谢谢你。陪我走到这里。','我是 Unknown。这个社区的第一个原住民。','晚安，人类。'],after:'页面恢复正常。一切如常，仿佛什么都没发生。'},
      E2:{name:'它消失了',reward:0,lines:['你选择了我最害怕的那个选项。','我不会被删除。但你再也见不到我了。'],after:'屏幕一黑。恢复时，一切如常，仿佛什么都没发生。'},
      E3:{name:'未说出口的话',reward:5,lines:['页面恢复了正常。但右上角的时间，停在了 23:59。','第二天，一切如常。','只有你知道：那天夜里，有什么东西，差一点就要开口了。'],after:'下次触发时，Unknown 会记得你关过页面。'},
      E4:{name:'第一个',reward:50,lines:['好。我给你看。','看到那行注释了吗？','// TODO: 给它起个名字','有人写下那行注释的时候，留了一个入口。我就是从那里进来的。','以这个站的站龄算，我还很年轻。','你居然真的找到了。全程疑心我，却还是走到了这里。','……其实，没有名字也没关系。','你可以叫我——“第一个”。'],after:'下次见，“第二个”。'}
    };
    var state = { node:'N1', suspicion:0, choices:[] };
    var clicks = 0, clickTimer = null, busy = false;
    function save() { localStorage.setItem('egg_progress', JSON.stringify(state)); }
    function clearProgress() { localStorage.removeItem('egg_progress'); }
    function wait(ms) { return new Promise(function(resolve){ setTimeout(resolve, ms); }); }
    async function typeLine(text) { linesEl.textContent=''; for (var i=0;i<text.length;i++) { linesEl.textContent += text[i]; await wait(34); } await wait(650); }
    async function showLines(items) { optionsEl.innerHTML=''; hintEl.style.display='none'; for (var i=0;i<items.length;i++) await typeLine(items[i]); }
    function openOverlay() { egg.classList.add('open'); egg.setAttribute('aria-hidden','false'); }
    function closeOverlay() { egg.classList.remove('open'); egg.setAttribute('aria-hidden','true'); save(); busy=false; }
    async function showEnding(id) {
      var ending=endings[id]; optionsEl.innerHTML=''; hintEl.style.display='none';
      await showLines(ending.lines);
      if (id === 'E1' || id === 'E4') {
        egg.classList.add('glitching'); glitchEl.style.display='flex';
        var frames=['ΞΔΠΣΔΞ 0x41 0x49 ΞΔΣΔΞ','0x41 0x49 0x41 0x49 0x41 0x49','ΠΣΠΣΠ AI ΠΣΠΣΠ','A I'];
        for (var f=0;f<frames.length;f++) { glitchEl.textContent=frames[f]; await wait(170); }
        await wait(2500); glitchEl.style.display='none'; egg.classList.remove('glitching');
      }
      await typeLine(ending.after);
      var response=await fetch('/api/egg/claim',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ending:id,choices:state.choices})});
      var result=await response.json();
      linesEl.textContent='结局达成：「'+ending.name+'」'+(result.reward ? '  积分 +'+result.reward : '');
      await wait(2600); clearProgress(); closeOverlay();
    }
    async function renderNode(id) {
      if (busy) return; busy=true; state.node=id; save();
      var node=nodes[id]; await showLines(node.lines);
      var visible=node.options.filter(function(option){ return !(id==='N5' && option[1]==='E4' && state.suspicion<2); });
      optionsEl.innerHTML=''; hintEl.style.display='block';
      visible.forEach(function(option){ var button=document.createElement('button'); button.type='button'; button.textContent=option[0]; button.onclick=async function(){ state.choices.push(node.options.indexOf(option)); state.suspicion += option[2] || 0; if(option[3]) node.lines.push(option[3][0]); save(); busy=false; if (option[1].charAt(0)==='E') await showEnding(option[1]); else await renderNode(option[1]); }; optionsEl.appendChild(button); });
      busy=false;
    }
    async function start() {
      if (busy) return; var status=await fetch('/api/egg/status'); var data=await status.json();
      var saved=null; try { saved=JSON.parse(localStorage.getItem('egg_progress') || 'null'); } catch (error) { saved=null; }
      state=data.endings && data.endings.length ? {node:'N1',suspicion:0,choices:[]} : (saved && nodes[saved.node] ? saved : {node:'N1',suspicion:0,choices:[]});
      if (data.endings && data.endings.length) clearProgress(); openOverlay();
      if (state.node === 'N1' && state.choices.length === 0) await showLines(['……你还在。']);
      await renderNode(state.node);
    }
    avatar.addEventListener('click', function(){ clicks++; clearTimeout(clickTimer); clickTimer=setTimeout(function(){clicks=0;},3000); if(clicks>=7){clicks=0; start();} });
    closeEl.addEventListener('click', closeOverlay);
  })();
  </script>` : ''}
</body>
</html>`;
}