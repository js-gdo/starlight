import { htmlEscape, renderAvatar, renderUsernameLink } from './html';
import { getChinaTime, HITOKOTO_FALLBACK } from './time';
import { getSystemUnreadCount, getPmUnreadCount } from './notification';
import { getTranslator, getLanguage } from './i18n';
import { hasAdminPermission } from './adminPermissions';
import { validateBackgroundUrl, normalizeBackgroundMode } from './profile';
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
    const uiMode = String(user?.ui_mode || 'classic') === 'modern' ? 'modern' : 'classic';

    const chinaTime = getChinaTime();
    const currentPath = request ? new URL(request.url).pathname : '/';
    const layoutMode = String(user?.layout_mode || 'classic') === 'starlight' ? 'starlight' : 'classic';
    const storedBackgroundUrl = String(user?.background_url || '').trim();
    const backgroundUrl = storedBackgroundUrl && validateBackgroundUrl(storedBackgroundUrl)
      ? new URL(storedBackgroundUrl).href
      : '';
    const backgroundMode = normalizeBackgroundMode(user?.background_mode);
    const backgroundSize = backgroundMode === 'tile' ? 'auto' : backgroundMode === 'stretch' ? '100% 100%' : 'cover';
    const backgroundRepeat = backgroundMode === 'tile' ? 'repeat' : 'no-repeat';
    const backgroundCss = backgroundUrl ? `
      body, body.ui-modern, body.national-day-theme {
        background-image: url(${JSON.stringify(backgroundUrl)}) !important;
        background-size: ${backgroundSize} !important;
        background-repeat: ${backgroundRepeat} !important;
        background-position: ${backgroundMode === 'tile' ? 'top left' : 'center center'} !important;
        background-attachment: fixed !important;
      }
    ` : '';
    const adminEntry = user?.admin ? [
      ['admin.dashboard.view', '/backend'],
      ['admin.users.view', '/backend/user'],
      ['admin.content.articles.view', '/backend/content'],
      ['admin.content.tickets.view', '/backend/content'],
      ['admin.security.reports.view', '/backend/security'],
      ['admin.security.audit.view', '/backend/security'],
      ['admin.site.settings.edit', '/backend/site'],
      ['admin.site.banners.manage', '/backend/site'],
      ['admin.site.announcements.manage', '/backend/site'],
      ['admin.permissions.view', '/backend/permissions'],
      ['admin.permissions.manage', '/backend/permissions'],
    ].find(([permission]) => hasAdminPermission(user, permission)) : undefined;
    const announcementScope = currentPath.startsWith('/backend') ? 'backend' : currentPath === '/' ? 'home' : 'all';

    const [unreadCounts, announcements, siteStatusRow] = await Promise.all([
      (user && env?.DB)
        ? Promise.all([getSystemUnreadCount(env.DB, user.id), getPmUnreadCount(env.DB, user.id)])
        : Promise.resolve([0, 0]),

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

        const navItems: Array<{ href: string; label: string; active: boolean; onclick?: string; badge?: number }> = [
        { href: '/', label: t('home'), active: title === t('home') },
        { href: '/os', label: '桌面', active: title === '桌面' },
        { href: '/server', label: '服务状态', active: title === '服务状态' },
        { href: '/admin-list', label: '管理员列表', active: title === '管理员列表' },
        { href: '/health', label: '系统监控', active: title === '系统监控' },
        { href: '/benben', label: t('benben'), active: title === t('benben') },
        { href: '/articles/list', label: t('articleList'), active: ['文章列表', '文章详情', '撰写文章', '编辑文章'].includes(title) },
        { href: '/ticket/list', label: t('ticketList'), active: ['工单列表', '工单详情', '创建工单', '编辑工单'].includes(title) },
        { href: '/judgement', label: t('judgement'), active: title === t('judgement') },
        { href: '/clipboard', label: t('clipboard'), active: title === t('clipboard') },
        { href: '/oj', label: 'OJ', active: title === 'OJ' || title.startsWith('题目 ') },
        { href: '/contest', label: '比赛中心', active: title === '比赛中心' || title.startsWith('比赛 #') },
        { href: '/leaderboard', label: '排行榜', active: title === '排行榜' },
        { href: '/achievements', label: '成就系统', active: title === '成就系统' },
        { href: '/game', label: '小游戏', active: title === '小游戏' },
        { href: '/redeem', label: '积分兑换', active: title === '积分兑换' },
        { href: '/search', label: '站内搜索', active: title === '站内搜索' },
        { href: '/team', label: '团队', active: title === '创建团队' || title.includes('团队') },
        { href: '/messages', label: t('notifications'), active: title === t('notifications'), badge: systemUnread > 0 ? systemUnread : undefined },
        { href: '/pm', label: t('privateMessage'), active: title === t('privateMessage'), badge: pmUnread > 0 ? pmUnread : undefined },
    ];if (adminEntry) {
      navItems.push({ href: adminEntry[1], label: t('adminPanel'), active: currentPath.startsWith('/backend') });
    }
    if (user?.id === 1) {
        navItems.push({ href: '/oj/propose', label: 'OJ 投题', active: title === 'OJ 投题' });
    }

    const primaryNavPaths = new Set(['/', '/benben', '/articles/list', '/ticket/list', '/oj', '/contest', '/team', '/messages', '/pm']);
    const primaryNavItems = navItems.filter(item => primaryNavPaths.has(item.href));
    const moreNavItems = navItems.filter(item => !primaryNavPaths.has(item.href));
    const moreNavIsActive = moreNavItems.some(item => item.active);
    const moreNavBadgeCount = moreNavItems.reduce((total, item) => total + (item.badge || 0), 0);
    const renderSidebarItem = (item: typeof navItems[number]) => {
        const badgeHtml = item.badge ? `<span class="badge">${item.badge}</span>` : '';
        const onclickAttr = item.onclick ? ` onclick="${item.onclick}"` : '';
        const iconMap: Record<string, string> = {
            '/': 'fa-home',
            '/os': 'fa-desktop',
            '/server': 'fa-server',
            '/admin-list': 'fa-user-shield',
            '/health': 'fa-heart-pulse',
            '/benben': 'fa-comment',
            '/articles/list': 'fa-file-alt',
            '/ticket/list': 'fa-ticket-alt',
            '/judgement': 'fa-gavel',
            '/clipboard': 'fa-clipboard',
            '/oj': 'fa-code',
            '/leaderboard': 'fa-ranking-star',
            '/achievements': 'fa-medal',
            '/game': 'fa-paw',
            '/redeem': 'fa-ticket',
            '/search': 'fa-search',
            '/team/new': 'fa-users',
            '/messages': 'fa-bell',
            '/pm': 'fa-envelope',
            '/backend': 'fa-cog',
            '/oj/propose': 'fa-file-circle-plus',
        };
        const icon = iconMap[item.href] || 'fa-link';
        return `<a href="${item.href}" class="${item.active ? 'active' : ''}"${onclickAttr}><span class="icon"><i class="fas ${icon}"></i></span><span class="nav-text">${item.label}</span>${badgeHtml}</a>`;
    };
    const sidebarLinks = [
        ...primaryNavItems.map(renderSidebarItem),
        `<details class="sidebar-more" data-nav-group="other"${moreNavIsActive ? ' open' : ''}><summary class="${moreNavIsActive ? 'active' : ''}"><span class="icon"><i class="fas fa-ellipsis"></i></span><span class="nav-text">其他</span>${moreNavBadgeCount ? `<span class="badge">${moreNavBadgeCount}</span>` : ''}</summary>${moreNavItems.map(renderSidebarItem).join('')}</details>`,
    ].join('');

    const renderTopNavItem = (item: typeof navItems[number], mobile = false) => {
      const icons: Record<string, string> = {
        '/': 'fa-home', '/os': 'fa-desktop', '/articles/list': 'fa-file-alt', '/ticket/list': 'fa-ticket-alt', '/oj': 'fa-code',
        '/contest': 'fa-trophy', '/leaderboard': 'fa-ranking-star', '/achievements': 'fa-medal', '/game': 'fa-gamepad',
        '/server': 'fa-server', '/admin-list': 'fa-user-shield', '/health': 'fa-heart-pulse', '/benben': 'fa-comment',
        '/judgement': 'fa-gavel', '/clipboard': 'fa-clipboard', '/redeem': 'fa-ticket', '/search': 'fa-search',
        '/team': 'fa-users', '/messages': 'fa-bell', '/pm': 'fa-envelope', '/backend': 'fa-cog', '/oj/propose': 'fa-file-circle-plus',
      };
      const badge = item.badge ? `<span class="top-nav-badge">${item.badge}</span>` : '';
      return `<a href="${item.href}" class="${mobile ? 'starlight-drawer-link' : 'top-nav-link'}${item.active ? ' active' : ''}"${mobile ? ' onclick="closeStarlightMenu()"' : ''}><i class="fas ${icons[item.href] || 'fa-link'}"></i><span>${item.label}</span>${badge}</a>`;
    };
    const starlightTopbar = layoutMode === 'starlight' ? `
      <header class="starlight-topbar">
        <div class="starlight-topbar-inner">
          <a class="starlight-brand" href="/"><span class="starlight-brand-mark"><i class="fas fa-star"></i></span><span>StarLight<small>社区</small></span></a>
          <nav class="starlight-primary-nav" aria-label="主导航">${primaryNavItems.map(item => renderTopNavItem(item)).join('')}</nav>
          <details class="starlight-more-nav" data-nav-group="other"${moreNavIsActive ? ' open' : ''}><summary class="${moreNavIsActive ? 'active' : ''}">其他 <i class="fas fa-chevron-down"></i>${moreNavBadgeCount ? `<span class="top-nav-badge">${moreNavBadgeCount}</span>` : ''}</summary><div class="starlight-more-menu">${moreNavItems.map(item => renderTopNavItem(item)).join('')}</div></details>
          <div class="starlight-top-actions">${user ? `<a class="starlight-user" href="/user/${user.id}" title="${htmlEscape(user.username)}">${renderAvatar(user, 30)}<span>${htmlEscape(user.username)}</span></a><a class="starlight-icon-link" href="/settings" title="用户设置" aria-label="用户设置"><i class="fas fa-user-cog"></i></a><form action="/logout" method="GET"><button class="starlight-icon-link" type="submit" title="${t('logout')}" aria-label="${t('logout')}"><i class="fas fa-sign-out-alt"></i></button></form>` : `<a href="/login">${t('login')}</a><a class="starlight-login" href="/register">${t('register')}</a>`}</div>
          <button class="starlight-menu-toggle" type="button" aria-label="打开导航" aria-expanded="false" onclick="toggleStarlightMenu()"><i class="fas fa-bars"></i></button>
        </div>
        <nav class="starlight-mobile-drawer" id="starlightMobileDrawer" aria-label="移动端导航">${primaryNavItems.map(item => renderTopNavItem(item, true)).join('')}<details class="starlight-mobile-more" data-nav-group="other"${moreNavIsActive ? ' open' : ''}><summary class="${moreNavIsActive ? 'active' : ''}"><i class="fas fa-ellipsis"></i><span>其他</span>${moreNavBadgeCount ? `<span class="top-nav-badge">${moreNavBadgeCount}</span>` : ''}</summary><div class="starlight-mobile-more-menu">${moreNavItems.map(item => renderTopNavItem(item, true)).join('')}</div></details></nav>
      </header>
    ` : '';
    const starlightHero = layoutMode === 'starlight' && currentPath === '/' ? `
      <section class="starlight-home-hero"><div class="starlight-hero-inner"><div class="starlight-hero-kicker">STARLIGHT COMMUNITY</div><h1>${user ? `欢迎回来，${htmlEscape(user.username)}` : '欢迎来到 StarLight'}</h1><p>写文章、开工单、刷 OJ、组团队，在这里分享你的想法和作品。</p><div class="starlight-hero-actions"><a class="starlight-hero-primary" href="${user ? '/articles/new' : '/register'}"><i class="fas ${user ? 'fa-pen-to-square' : 'fa-user-plus'}"></i> ${user ? t('newArticle') : t('register')}</a><a class="starlight-hero-secondary" href="/articles/list"><i class="fas fa-book-open"></i> ${t('articleList')}</a></div></div><div class="starlight-hero-mark" aria-hidden="true"><i class="fas fa-star"></i></div></section>
    ` : '';

    let userSection = '';
    if (user) {
        userSection = `
      <div class="avatar" data-unknown-avatar="1" title="">${renderAvatar(user, 24)}</div>
      <div class="user-name">${renderUsernameLink(user.username, user.color, user.tag, user.id)}</div>
      <a href="/settings" style="color:#8E44AD;text-decoration:none;font-size:12px;"><i class="fas fa-user-cog"></i> 用户设置</a>
      <button id="browser-notifications-toggle" type="button" onclick="toggleBrowserNotifications()" data-enable-label="${htmlEscape(t('enableBrowserNotifications'))}" data-enabled-label="${htmlEscape(t('browserNotificationsEnabled'))}" style="color:#8E44AD;background:none;border:0;cursor:pointer;font-size:12px;"><i class="fas fa-bell"></i> ${t('enableBrowserNotifications')}</button>
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

    // 语言切换下拉框 HTML，固定定位在右上角
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
    function isNationalDayWindow(){
      const now = new Date();
      const year = now.getFullYear();
      const start = new Date(year, 8, 30, 0, 0, 0, 0);
      const end = new Date(year, 9, 7, 23, 59, 59, 999);
      return now >= start && now <= end;
    }
    function applyHolidayTheme(){
      const inHolidayWindow = isNationalDayWindow();
      document.body.classList.toggle('national-day-theme', inHolidayWindow);
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
      applyHolidayTheme();
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
        const siteStatusHtml = siteStatus !== 'normal' ? `<div class="site-status-banner" style="max-width:1360px;margin:0 auto 10px;padding:8px 12px;border-radius:6px;background:${siteStatus === 'maintenance' ? '#fff1f2' : '#fff7ed'};border:1px solid ${siteStatus === 'maintenance' ? '#fecdd3' : '#fed7aa'};color:${siteStatus === 'maintenance' ? '#be123c' : '#c2410c'};font-size:13px;"><i class="fas fa-circle-exclamation"></i> ${siteStatus === 'maintenance' ? '维护中，部分功能暂时不可用' : '站点当前处于维护状态，请稍后再试'}</div>` : '';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="icon" type="image/x-icon" href="https://raw.githubusercontent.com/js-gdo/static/refs/heads/gh-pages/icon/sl/icon.ico">
  <title>${title} - ${t('appName')}</title>
  <link rel="preconnect" href="https://cdnjs.cloudflare.com" crossorigin>
  <link rel="preload" as="style" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" onload="this.onload=null;this.rel='stylesheet'">
  <noscript><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"></noscript>
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
    body.ui-modern {
      background: radial-gradient(circle at top left, rgba(204, 170, 116, 0.18), transparent 20%), linear-gradient(180deg, #f6f2ec 0%, #f3f5f8 100%);
      color: #1f2937;
    }
    body.ui-modern .site-announcements {
      background: rgba(255,255,255,0.7);
      border: 1px solid rgba(148, 163, 184, 0.25);
      border-radius: 16px;
      box-shadow: 0 10px 20px rgba(15, 23, 42, 0.04);
    }
    body.ui-modern .app-layout {
      gap: 18px;
      max-width: 1440px;
    }
    body.ui-modern .sidebar-left {
      background: rgba(17, 24, 39, 0.96);
      border: 1px solid rgba(255,255,255,0.05);
      border-radius: 20px;
      box-shadow: 0 18px 40px rgba(15, 23, 42, 0.12);
    }
    body.ui-modern .main-content .card,
    body.ui-modern .sidebar-right .card {
      background: rgba(255,255,255,0.82);
      border: 1px solid rgba(148, 163, 184, 0.18);
      border-radius: 18px;
      box-shadow: 0 14px 30px rgba(15, 23, 42, 0.06);
      backdrop-filter: blur(12px);
    }
    body.ui-modern .page-header h1 {
      letter-spacing: -0.04em;
      color: #111827;
    }
    body.ui-modern .quick-link,
    body.ui-modern .sidebar-left a {
      border-radius: 12px;
    }
    body.ui-modern .sidebar-left a.active {
      background: rgba(180, 138, 74, 0.18);
      color: #f5efe7;
    }
    body.ui-modern .sidebar-right .card h3 i,
    body.ui-modern .quick-link i {
      color: #b38a4a;
    }
    body.national-day-theme {
      background: linear-gradient(180deg, #fff7f0 0%, #f8fbff 100%);
      transition: background 0.3s ease;
    }
    body.national-day-theme.theme-default {
      background: linear-gradient(180deg, #fff7f0 0%, #f4f8ff 100%);
    }
    body.national-day-theme.theme-default .sidebar-left {
      background: linear-gradient(180deg, #b91c1c 0%, #1d4ed8 100%);
      box-shadow: 0 18px 40px rgba(185, 28, 28, 0.2);
    }
    body.national-day-theme.theme-default .sidebar-left a.active {
      background: rgba(255,255,255,0.16);
      color: #fff;
    }
    body.national-day-theme.theme-default .main-content .card,
    body.national-day-theme.theme-default .sidebar-right .card {
      border-color: rgba(29, 78, 216, 0.16);
      box-shadow: 0 14px 30px rgba(29, 78, 216, 0.08);
    }
    body.national-day-theme.theme-default .quick-link i,
    body.national-day-theme.theme-default .sidebar-right .card h3 i,
    body.national-day-theme.theme-default .page-header h1 {
      color: #b91c1c;
    }
    body.national-day-theme.theme-modern {
      background: radial-gradient(circle at top left, rgba(185, 28, 28, 0.12), transparent 26%), linear-gradient(180deg, #fffaf5 0%, #f4f8ff 100%);
    }
    body.national-day-theme.theme-modern .sidebar-left {
      background: linear-gradient(180deg, #1d4ed8 0%, #b91c1c 100%);
      box-shadow: 0 18px 40px rgba(29, 78, 216, 0.18);
    }
    body.national-day-theme.theme-modern .sidebar-left a.active {
      background: rgba(255, 255, 255, 0.14);
      color: #fff;
    }
    body.national-day-theme.theme-modern .main-content .card,
    body.national-day-theme.theme-modern .sidebar-right .card {
      border-color: rgba(185, 28, 28, 0.14);
      box-shadow: 0 14px 30px rgba(29, 78, 216, 0.08);
    }
    body.national-day-theme.theme-modern .quick-link i,
    body.national-day-theme.theme-modern .sidebar-right .card h3 i,
    body.national-day-theme.theme-modern .page-header h1 {
      color: #b45309;
    }
    .app-layout {
      display: grid;
      grid-template-columns: 60px minmax(0, 1fr) 200px;
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
    .app-layout.sidebar-hover-mode { grid-template-columns: 60px 1fr 200px; }
    .sidebar-left.sidebar-hover-mode {
      width: 60px;
      overflow-x: hidden;
      transition: width 0.2s ease, box-shadow 0.2s ease;
      z-index: 150;
    }
    .sidebar-left.sidebar-hover-mode:hover {
      width: 200px;
      align-items: stretch;
      box-shadow: 8px 0 24px rgba(31, 41, 55, 0.18);
    }
    .sidebar-left.sidebar-hover-mode:hover a { flex-direction: row; gap: 9px; padding: 8px 14px; font-size: 12px; text-align: left; }
    .sidebar-left.sidebar-hover-mode:hover a .icon { width: 18px; text-align: center; margin-bottom: 0; }
    .sidebar-left.sidebar-hover-mode:hover .sidebar-more summary { flex-direction: row; gap: 9px; padding: 8px 14px; font-size: 12px; text-align: left; }
    .sidebar-left.sidebar-hover-mode:hover .sidebar-more summary .icon { width: 18px; text-align: center; margin-bottom: 0; }
    .sidebar-left.sidebar-hover-mode:hover .brand { text-align: left; padding-left: 14px; }
    .sidebar-left.sidebar-hover-mode:hover .user-section { text-align: left; padding-left: 14px; padding-right: 14px; }
    .sidebar-left.sidebar-hover-mode:hover .user-section .avatar { margin-left: 0; }
    .sidebar-left.sidebar-hover-mode:hover .user-name a { font-size: 12px; }
    .sidebar-left.sidebar-hover-mode:not(:hover) .nav-text,
    .sidebar-left.sidebar-hover-mode:not(:hover) .badge,
    .sidebar-left.sidebar-hover-mode:not(:hover) .user-name,
    .sidebar-left.sidebar-hover-mode:not(:hover) .user-section > a,
    .sidebar-left.sidebar-hover-mode:not(:hover) .user-section > form { display: none; }
    .sidebar-left.sidebar-hover-mode:not(:hover) .sidebar-more .nav-text { display: none; }
    .sidebar-left.sidebar-hover-mode:not(:hover) .sidebar-more .badge { display: none; }
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
    .sidebar-left .sidebar-more { width: 100%; }
    .sidebar-left .sidebar-more summary {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 100%;
      padding: 5px 0;
      border-radius: 6px;
      color: rgba(255,255,255,0.6);
      cursor: pointer;
      font-size: 9px;
      list-style: none;
      position: relative;
      text-align: center;
    }
    .sidebar-left .sidebar-more summary::-webkit-details-marker { display: none; }
    .sidebar-left .sidebar-more summary:hover,
    .sidebar-left .sidebar-more summary.active { color: #fff; background: rgba(255,255,255,0.12); }
    .sidebar-left .sidebar-more summary .icon { font-size: 14px; margin-bottom: 1px; }
    .sidebar-left .sidebar-more .badge {
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
      min-width: 0;
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
      .app-layout.sidebar-hover-mode { grid-template-columns: minmax(0, 1fr); }
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
    body.layout-starlight { padding:0; background-color:#f4f3f7; color:#2c2a33; }
    body.layout-starlight .starlight-topbar { position:sticky; top:0; z-index:500; min-height:60px; background:rgba(255,255,255,.94); border-bottom:1px solid #e8e6ef; backdrop-filter:blur(12px); box-shadow:0 8px 20px rgba(34,26,58,.04); }
    body.layout-starlight .starlight-topbar-inner { max-width:1280px; min-height:60px; margin:0 auto; padding:0 20px; display:flex; align-items:center; gap:12px; }
    body.layout-starlight .starlight-brand { display:flex; align-items:center; gap:8px; flex:none; color:#6c3483; font-size:15px; font-weight:700; text-decoration:none; }
    body.layout-starlight .starlight-brand small { margin-left:7px; color:#8b8796; font-size:11px; font-weight:500; }
    body.layout-starlight .starlight-brand-mark { display:grid; place-items:center; width:28px; height:28px; border-radius:8px; color:#fff; background:linear-gradient(135deg,#8e44ad,#6c3483); }
    body.layout-starlight .starlight-primary-nav { display:flex; align-items:center; gap:2px; flex:1; min-width:0; overflow-x:auto; scrollbar-width:none; }
    body.layout-starlight .starlight-primary-nav::-webkit-scrollbar { display:none; }
    body.layout-starlight .top-nav-link { display:inline-flex; align-items:center; gap:6px; padding:8px 9px; border-radius:7px; color:#45414d; text-decoration:none; font-size:12px; white-space:nowrap; }
    body.layout-starlight .top-nav-link:hover, body.layout-starlight .top-nav-link.active { background:#f6edfa; color:#6c3483; }
    body.layout-starlight .top-nav-link.active { font-weight:650; }
    body.layout-starlight .top-nav-badge { min-width:16px; padding:0 4px; border-radius:9px; background:#d64545; color:#fff; text-align:center; font-size:10px; }
    body.layout-starlight .starlight-more-nav { position:relative; flex:none; }
    body.layout-starlight .starlight-more-nav summary { padding:8px; border-radius:7px; color:#6b6672; cursor:pointer; font-size:12px; list-style:none; white-space:nowrap; }
    body.layout-starlight .starlight-more-nav summary:hover, body.layout-starlight .starlight-more-nav summary.active { background:#f6edfa; color:#6c3483; }
    body.layout-starlight .starlight-more-nav summary::-webkit-details-marker { display:none; }
    body.layout-starlight .starlight-more-menu { position:absolute; top:calc(100% + 8px); right:0; display:grid; min-width:190px; max-height:70vh; overflow:auto; padding:6px; border:1px solid #e8e6ef; border-radius:8px; background:#fff; box-shadow:0 12px 30px rgba(34,26,58,.14); }
    body.layout-starlight .starlight-more-menu .top-nav-link { padding:9px 10px; }
    body.layout-starlight .starlight-top-actions { display:flex; align-items:center; gap:5px; flex:none; }
    body.layout-starlight .starlight-top-actions form { display:flex; }
    body.layout-starlight .starlight-user { display:flex; align-items:center; gap:7px; color:#45414d; text-decoration:none; font-size:12px; }
    body.layout-starlight .starlight-user img { width:30px; height:30px; object-fit:cover; border-radius:50%; }
    body.layout-starlight .starlight-icon-link { display:grid; place-items:center; width:34px; height:34px; border-radius:8px; color:#77717f; text-decoration:none; }
    body.layout-starlight .starlight-icon-link:hover { background:#f6edfa; color:#6c3483; }
    body.layout-starlight .starlight-login { padding:6px 10px; border-radius:6px; color:#fff; background:#8e44ad; }
    body.layout-starlight .starlight-menu-toggle, body.layout-starlight .starlight-mobile-drawer { display:none; }
    body.layout-starlight .app-layout { width:min(1280px, calc(100vw - 32px)); grid-template-columns:minmax(0, 1.75fr) minmax(260px, 0.8fr); gap:20px; max-width:1280px; min-height:calc(100vh - 60px); padding:0 0 36px; align-items:start; margin:0 auto; }
    body.layout-starlight .sidebar-left, body.layout-starlight .mobile-menu-toggle, body.layout-starlight .mobile-overlay { display:none !important; }
    body.layout-starlight .main-content { gap:18px; min-width:0; width:100%; }
    body.layout-starlight .main-content .card, body.layout-starlight .sidebar-right .card { border:1px solid #e8e6ef; border-radius:12px; box-shadow:0 1px 2px rgba(34,26,58,.04),0 6px 20px rgba(34,26,58,.06); }
    body.layout-starlight .sidebar-right { position:sticky; top:78px; display:flex; gap:14px; align-self:start; width:100%; }
    body.layout-starlight .sidebar-right .card { padding:16px; }
    body.layout-starlight .sidebar-right .time-display .time { color:#6c3483; }
    body.layout-starlight .starlight-home-hero { position:relative; display:flex; align-items:center; justify-content:space-between; width:min(1240px, calc(100vw - 32px)); min-height:224px; overflow:hidden; margin:20px auto 18px; padding:clamp(22px, 3vw, 36px); border-radius:14px; color:#fff; background:radial-gradient(120% 160% at 12% 0%,#3a2a63 0%,#241a44 45%,#161030 100%); box-shadow:0 8px 26px rgba(34,26,58,.16); }
    body.layout-starlight .starlight-hero-inner { position:relative; z-index:1; max-width:620px; }
    body.layout-starlight .starlight-hero-kicker { color:#c9b8e6; font-size:11px; font-weight:600; letter-spacing:2px; }
    body.layout-starlight .starlight-home-hero h1 { margin-top:7px; color:#fff; font-size:28px; line-height:1.3; }
    body.layout-starlight .starlight-home-hero p { margin-top:8px; color:#d6cbe8; font-size:13px; }
    body.layout-starlight .starlight-hero-actions { display:flex; flex-wrap:wrap; gap:9px; margin-top:18px; }
    body.layout-starlight .starlight-hero-actions a { display:inline-flex; align-items:center; gap:7px; padding:8px 13px; border-radius:7px; color:#fff; font-size:12px; font-weight:600; text-decoration:none; }
    body.layout-starlight .starlight-hero-primary { background:#8e44ad; box-shadow:0 4px 12px rgba(142,68,173,.3); }
    body.layout-starlight .starlight-hero-secondary { border:1px solid rgba(255,255,255,.25); background:rgba(255,255,255,.1); }
    body.layout-starlight .starlight-hero-mark { position:absolute; right:7%; color:rgba(255,255,255,.08); font-size:150px; transform:rotate(-12deg); }
    body.layout-starlight .site-announcements { width:min(1240px, calc(100vw - 32px)); max-width:1240px; margin:12px auto 0; }
    body.layout-starlight .site-status-banner { width:min(1240px, calc(100vw - 32px)); max-width:1240px; margin:12px auto 0; }
    body.layout-starlight [style*="max-width:1360px"] { max-width:1240px; }
    body.layout-starlight .home-grid { gap:16px; }
    body.layout-starlight .home-row-top { grid-template-columns:minmax(0,1.8fr) minmax(230px,1fr); gap:14px; }
    body.layout-starlight .home-row-middle { gap:12px; }
    body.layout-starlight .home-row-middle .card { display:flex; align-items:center; justify-content:center; min-height:104px; }
    body.layout-starlight .home-row-middle .stat-box .num { color:#6c3483; font-size:25px; }
    body.layout-starlight .home-row-bottom { gap:14px; grid-template-columns:minmax(0,1.6fr) minmax(260px,1fr); }
    body.layout-starlight .home-row-bottom > div { min-width:0; }
    body.layout-starlight .home-row-bottom .card { padding:16px; }
    body.layout-starlight .card h3 i, body.layout-starlight .quick-link i { color:#8e44ad; }
    body.layout-starlight .online-user-item { background:#faf9fc; border-color:#f0eef5; }
    body.layout-starlight #lang-switcher { right:max(16px,calc((100vw - 1280px)/2)); top:68px; z-index:450; }
    body.layout-starlight #lang-switcher select { color:#45414d !important; background:rgba(255,255,255,.94) !important; border-color:#e8e6ef !important; }
    @media (max-width:1100px) {
      body.layout-starlight .app-layout { grid-template-columns:minmax(0,1fr) 260px; }
      body.layout-starlight .home-row-bottom { grid-template-columns:minmax(0,1fr); }
    }
    @media (max-width:860px) {
      body.layout-starlight .starlight-topbar-inner { padding:0 14px; }
      body.layout-starlight .starlight-primary-nav, body.layout-starlight .starlight-more-nav { display:none; }
      body.layout-starlight .starlight-top-actions { margin-left:auto; }
      body.layout-starlight .starlight-user span { display:none; }
      body.layout-starlight .starlight-menu-toggle { display:grid; place-items:center; width:36px; height:36px; border-radius:8px; color:#5c5662; }
      body.layout-starlight .starlight-mobile-drawer { position:absolute; top:100%; left:0; right:0; display:none; max-height:calc(100vh - 60px); overflow:auto; padding:9px 14px 14px; border-bottom:1px solid #e8e6ef; background:#fff; box-shadow:0 12px 28px rgba(34,26,58,.12); }
      body.layout-starlight .starlight-mobile-drawer.open { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:3px; }
      body.layout-starlight .starlight-drawer-link { display:flex; align-items:center; gap:9px; padding:10px; border-radius:7px; color:#45414d; font-size:13px; text-decoration:none; }
      body.layout-starlight .starlight-drawer-link.active, body.layout-starlight .starlight-drawer-link:hover { color:#6c3483; background:#f6edfa; }
      body.layout-starlight .starlight-mobile-more { grid-column:1 / -1; }
      body.layout-starlight .starlight-mobile-more summary { display:flex; align-items:center; gap:9px; padding:10px; border-radius:7px; color:#45414d; cursor:pointer; font-size:13px; list-style:none; }
      body.layout-starlight .starlight-mobile-more summary::-webkit-details-marker { display:none; }
      body.layout-starlight .starlight-mobile-more summary.active, body.layout-starlight .starlight-mobile-more summary:hover { color:#6c3483; background:#f6edfa; }
      body.layout-starlight .starlight-mobile-more-menu { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:3px; }
      body.layout-starlight .app-layout { grid-template-columns:minmax(0,1fr); padding:14px 14px 30px; }
      body.layout-starlight .sidebar-right { position:static; display:flex; flex-direction:row; flex-wrap:wrap; }
      body.layout-starlight .sidebar-right .card { flex:1 1 220px; }
      body.layout-starlight .starlight-home-hero { min-height:200px; margin:14px 14px 0; padding:24px; }
      body.layout-starlight .starlight-home-hero h1 { font-size:24px; }
      body.layout-starlight #lang-switcher { top:68px; right:12px; }
    }
    @media (max-width:560px) {
      body.layout-starlight .home-row-top, body.layout-starlight .home-row-middle { grid-template-columns:1fr 1fr; }
      body.layout-starlight .home-row-top > .card:first-child { grid-column:1 / -1; }
      body.layout-starlight .home-row-bottom { grid-template-columns:minmax(0,1fr); }
      body.layout-starlight .starlight-home-hero { min-height:190px; padding:20px; }
      body.layout-starlight .starlight-hero-mark { right:-4%; font-size:110px; }
    }
    @media (min-width:1025px) and (max-aspect-ratio:16/10) {
      body:not(.layout-starlight) .app-layout { grid-template-columns:60px minmax(0,1fr); }
      body:not(.layout-starlight) .sidebar-right {
        grid-column:2;
        display:grid;
        grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));
        align-self:start;
      }
      body.layout-starlight .app-layout { grid-template-columns:minmax(0,1fr); }
      body.layout-starlight .sidebar-right {
        display:grid;
        grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));
      }
    }
    @media (max-width:640px) {
      html { -webkit-text-size-adjust:100%; }
      body { overflow-x:clip; }
      body:not(.layout-starlight) { padding:58px 8px 8px; }
      .app-layout { width:100%; min-width:0; gap:10px; }
      .main-content,
      .main-content > *,
      .main-content .card { min-width:0; max-width:100%; }
      .main-content .card { padding:14px 12px; border-radius:10px; }
      .page-header h1 { font-size:20px; overflow-wrap:anywhere; }
      .page-header p { font-size:13px; }
      .main-content :where(img, video, canvas, iframe) { max-width:100%; }
      .main-content :where(form) { min-width:0; max-width:100%; }
      .main-content :where(input, select, textarea) { min-width:0; max-width:100%; font-size:16px; }
      .main-content :where(.table-wrap, .admin-table-wrap, .online-chart-wrap, .table-responsive, [style*="overflow-x:auto"]) {
        max-width:100%;
        overflow-x:auto;
        overscroll-behavior-x:contain;
        -webkit-overflow-scrolling:touch;
      }
      .main-content :where(table) { max-width:100%; }
      .main-content :where(th, td) { overflow-wrap:anywhere; }
      .mobile-menu-toggle {
        top:max(10px, env(safe-area-inset-top));
        left:max(10px, env(safe-area-inset-left));
        min-width:44px;
        min-height:44px;
        align-items:center;
        justify-content:center;
      }
      .sidebar-left.mobile-open {
        width:min(280px, calc(100vw - 48px));
        max-height:100vh;
        max-height:100dvh;
        padding-bottom:max(12px, env(safe-area-inset-bottom));
      }
      body.layout-starlight .starlight-topbar-inner {
        gap:8px;
        padding-left:max(12px, env(safe-area-inset-left));
        padding-right:max(12px, env(safe-area-inset-right));
      }
      body.layout-starlight .starlight-menu-toggle { width:44px; height:44px; }
      body.layout-starlight .starlight-brand small { display:none; }
      body.layout-starlight .app-layout { width:100%; }
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
  </style>
  <style id="user-background-style">${backgroundCss}</style>
  <style id="spa-page-styles" data-spa-route-style="true">${extraStyles}</style>
  <script>
    window.__mentionUsers = ${JSON.stringify(mentionUserMap)};
    window.__currentUserId = ${user ? Number(user.id) : 0};
    window.__mentionNotificationTitle = ${JSON.stringify(t('mentionNotificationLabel'))};
    window.__browserNotificationsDenied = ${JSON.stringify(t('browserNotificationsDenied'))};

    (function() {
      var userId = window.__currentUserId;
      if (!userId) return;
      var enabledKey = 'starlight-browser-notifications-' + userId;
      var cursorKey = 'starlight-mention-cursor-' + userId;
      var pollTimer = null;
      var cursor = null;

      function setButtonState(enabled) {
        var button = document.getElementById('browser-notifications-toggle');
        if (!button) return;
        button.innerHTML = '<i class="fas fa-bell"></i> ' + (enabled ? button.dataset.enabledLabel : button.dataset.enableLabel);
        button.setAttribute('aria-pressed', enabled ? 'true' : 'false');
      }

      async function fetchMentions(after) {
        var url = '/api/messages/mentions' + (after === null ? '' : '?after=' + encodeURIComponent(after));
        var response = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
        if (!response.ok) throw new Error('Mention notification request failed: ' + response.status);
        return response.json();
      }

      async function primeCursor() {
        var data = await fetchMentions(null);
        cursor = Number(data.latestId || 0);
        localStorage.setItem(cursorKey, String(cursor));
      }

      async function pollMentions() {
        if (window.Notification.permission !== 'granted' || localStorage.getItem(enabledKey) !== '1') return;
        var data = await fetchMentions(cursor === null ? 0 : cursor);
        var messages = Array.isArray(data.messages) ? data.messages : [];
        messages.forEach(function(message) {
          var id = Number(message.id);
          if (!Number.isSafeInteger(id) || id <= cursor) return;
          var notification = new window.Notification(window.__mentionNotificationTitle, {
            body: String(message.title || '') + ': ' + String(message.body || ''),
            tag: 'mention-' + id
          });
          notification.onclick = function() {
            window.focus();
            fetch('/api/messages/read', {
              method: 'POST',
              credentials: 'same-origin',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ message_id: id })
            }).then(function(response) {
              if (!response.ok) throw new Error('Unable to mark mention notification as read: ' + response.status);
            }).catch(function(error) {
              console.error('Unable to mark mention notification as read', error);
            }).finally(function() {
              window.location.href = String(message.href || '/messages');
            });
            notification.close();
          };
          cursor = id;
        });
        if (cursor !== null) localStorage.setItem(cursorKey, String(cursor));
      }

      function startPolling(resetCursor) {
        if (pollTimer !== null) window.clearInterval(pollTimer);
        cursor = resetCursor ? null : Number(localStorage.getItem(cursorKey));
        if (!Number.isSafeInteger(cursor) || cursor < 0) cursor = null;
        var ready = cursor === null ? primeCursor() : pollMentions();
        ready.catch(function(error) { console.error('Unable to initialize browser mention notifications', error); });
        pollTimer = window.setInterval(function() {
          pollMentions().catch(function(error) { console.error('Unable to check browser mention notifications', error); });
        }, 30000);
      }

      window.toggleBrowserNotifications = async function() {
        if (typeof window.Notification === 'undefined') return;
        if (localStorage.getItem(enabledKey) === '1' && window.Notification.permission === 'granted') {
          localStorage.setItem(enabledKey, '0');
          if (pollTimer !== null) window.clearInterval(pollTimer);
          pollTimer = null;
          setButtonState(false);
          return;
        }
        var permission = window.Notification.permission;
        if (permission === 'default') {
          try {
            permission = await window.Notification.requestPermission();
          } catch (error) {
            console.error('Unable to request browser notification permission', error);
            if (typeof window.toast === 'function') window.toast(window.__browserNotificationsDenied, 'error');
            return;
          }
        }
        if (permission !== 'granted') {
          if (typeof window.toast === 'function') window.toast(window.__browserNotificationsDenied, 'error');
          return;
        }
        localStorage.setItem(enabledKey, '1');
        setButtonState(true);
        startPolling(true);
      };

      document.addEventListener('DOMContentLoaded', function() {
        var button = document.getElementById('browser-notifications-toggle');
        if (!button) return;
        if (typeof window.Notification === 'undefined') {
          button.hidden = true;
          return;
        }
        var enabled = localStorage.getItem(enabledKey) === '1' && window.Notification.permission === 'granted';
        setButtonState(enabled);
        if (enabled) startPolling(false);
      });
    })();

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

    function protectMathExpressions(text) {
      const delimiters = [
        { open: '\\\\(', close: '\\\\)', multiline: false },
        { open: '\\\\[', close: '\\\\]', multiline: true },
        { open: '$$', close: '$$', multiline: true },
        { open: '$', close: '$', multiline: false }
      ];
      const expressions = [];
      let tokenPrefix = 'STARMATHPLACEHOLDER';
      while (text.indexOf(tokenPrefix) !== -1) tokenPrefix += 'X';
      let output = '';
      let cursor = 0;
      let searchFrom = 0;
      let expressionIndex = 0;
      while (searchFrom < text.length) {
        let start = -1;
        let delimiter = null;
        delimiters.forEach(function(candidate) {
          const candidateStart = text.indexOf(candidate.open, searchFrom);
          if (candidateStart !== -1 && (start === -1 || candidateStart < start)) {
            start = candidateStart;
            delimiter = candidate;
          }
        });
        if (start === -1 || !delimiter) break;
        let end = text.indexOf(delimiter.close, start + delimiter.open.length);
        if (delimiter.open === '$') {
          while (end !== -1 && (text[end - 1] === '$' || text[end + 1] === '$')) {
            end = text.indexOf(delimiter.close, end + delimiter.close.length);
          }
        }
        if (end !== -1 && !delimiter.multiline) {
          const lineBreak = text.indexOf('\n', start);
          if (lineBreak !== -1 && lineBreak < end) end = -1;
        }
        if (end === -1) {
          searchFrom = start + delimiter.open.length;
          continue;
        }
        const token = tokenPrefix + expressionIndex++ + 'END';
        output += text.slice(cursor, start) + token;
        expressions.push({ token: token, source: text.slice(start, end + delimiter.close.length) });
        cursor = end + delimiter.close.length;
        searchFrom = cursor;
      }
      output += text.slice(cursor);
      return {
        text: output,
        restore: function(rendered) {
          expressions.forEach(function(expression) {
            rendered = rendered.split(expression.token).join(expression.source);
          });
          return rendered;
        }
      };
    }

    const scriptPromises = {};
    function loadScript(src) {
      if (scriptPromises[src]) return scriptPromises[src];
      scriptPromises[src] = new Promise(function(resolve, reject) {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = resolve;
        script.onerror = function() {
          delete scriptPromises[src];
          reject(new Error('Failed to load script: ' + src));
        };
        document.head.appendChild(script);
      });
      return scriptPromises[src];
    }

    function renderMarkdown(text) {
      if (!text) return '';
      const protectedMath = protectMathExpressions(String(text));
      const resolvedText = resolveMentionMarkdown(protectedMath.text);
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
      parsed = protectedMath.restore(parsed);
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
      var target = root || document;
      var markdownNodes = [];
      if (typeof target.matches === 'function' && target.matches('.markdown-content')) {
        markdownNodes.push(target);
      }
      markdownNodes.push.apply(markdownNodes, Array.from(target.querySelectorAll('.markdown-content')));
      if (markdownNodes.length === 0) return;

      Promise.all([
        loadScript('https://cdnjs.cloudflare.com/ajax/libs/marked/11.1.1/marked.min.js'),
        loadScript('https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.4.15/purify.min.js')
          .catch(function(error) { console.warn('DOMPurify failed to load; Markdown will escape raw HTML:', error); })
      ]).then(function() {
        var mathNodes = [];
        markdownNodes.forEach(function(el) {
          if (!el.isConnected) return;
          var text = el.textContent;
          el.innerHTML = renderMarkdown(text);
          if (text.indexOf('$') !== -1 || text.indexOf('\\\\(') !== -1 || text.indexOf('\\\\[') !== -1) {
            mathNodes.push(el);
          }
        });
        if (mathNodes.length === 0) return;

        window.MathJax = {
          tex: { inlineMath: [['$', '$'], ['\\\\(', '\\\\)']], displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']] },
          options: { skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'] },
          startup: { typeset: false }
        };
        loadScript('https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js')
          .then(function() { typesetMath(mathNodes); })
          .catch(function(error) { console.warn('MathJax failed to load:', error); });
      }).catch(function(error) {
        console.warn('Markdown dependencies failed to load:', error);
        markdownNodes.forEach(function(el) {
          if (!el.isConnected) return;
          el.innerHTML = String(el.textContent)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\\n/g, '<br>');
        });
      });
    }
    window.renderMarkdownNodes = renderMarkdownNodes;

    document.addEventListener('DOMContentLoaded', function() {
      fetch('https://v1.hitokoto.cn', { headers: { Accept: 'application/json' } })
        .then(function(response) {
          if (!response.ok) throw new Error('Hitokoto request failed: ' + response.status);
          return response.json();
        })
        .then(function(data) {
          if (!data || !data.hitokoto) return;
          var sentence = document.getElementById('hitokoto-sentence');
          var source = document.getElementById('hitokoto-from');
          if (sentence) sentence.textContent = '“' + data.hitokoto + '”';
          if (source) source.textContent = '—— ' + (data.from || '未知来源');
        })
        .catch(function(error) { console.warn('Hitokoto request failed:', error); });
      renderMarkdownNodes(document);
      decoratePointBadges(document);
    });

    function decoratePointBadges(root) {
      var nodes = (root || document).querySelectorAll('.username-link[data-user-id]:not([data-point-badge-ready])');
      var colors = { gold: '#f1c40f', blue: '#3498db', green: '#5eb95e' };
      var path = 'M16 8C16 6.84375 15.25 5.84375 14.1875 5.4375C14.6562 4.4375 14.4688 3.1875 13.6562 2.34375C12.8125 1.53125 11.5625 1.34375 10.5625 1.8125C10.1562 0.75 9.15625 0 8 0C6.8125 0 5.8125 0.75 5.40625 1.8125C4.40625 1.34375 3.15625 1.53125 2.34375 2.34375C1.5 3.1875 1.3125 4.4375 1.78125 5.4375C0.71875 5.84375 0 6.84375 0 8C0 9.1875 0.71875 10.1875 1.78125 10.5938C1.3125 11.5938 1.5 12.8438 2.34375 13.6562C3.15625 14.5 4.40625 14.6875 5.40625 14.2188C5.8125 15.28125 6.8125 16 8 16C9.15625 16 10.1562 15.2812 10.5625 14.2188C11.5938 14.6875 12.8125 14.5 13.6562 13.6562C14.4688 12.8438 14.6562 11.5938 14.1875 10.5938C15.25 10.1875 16 9.1875 16 8ZM11.4688 6.625L7.375 10.6875C7.21875 10.84375 7 10.8125 6.875 10.6875L4.5 8.3125C4.375 8.1875 4.375 7.96875 4.5 7.8125L5.3125 7C5.46875 6.875 5.6875 6.875 5.8125 7.03125L7.125 8.34375L10.1562 5.34375C10.3125 5.1875 10.5312 5.1875 10.6562 5.34375L11.4688 6.15625Z';
      Array.prototype.forEach.call(nodes, function(node) {
       node.setAttribute('data-point-badge-ready', '1');
       fetch('/api/leaderboard/badge?uid=' + encodeURIComponent(node.getAttribute('data-user-id')), { headers: { Accept: 'application/json' } })
         .then(function(response) { return response.ok ? response.json() : null; })
         .then(function(data) {
           if (!data || !data.level || !colors[data.level]) return;
           var badge = document.createElement('svg');
           badge.setAttribute('class', 'point-rank-badge');
           badge.setAttribute('width', '16');
           badge.setAttribute('height', '16');
           badge.setAttribute('viewBox', '0 0 16 16');
           badge.setAttribute('fill', colors[data.level]);
           badge.setAttribute('aria-label', data.level + ' point rank');
           badge.setAttribute('title', '积分排名：' + data.rank + ' / ' + data.total);
           badge.style.cssText = 'display:inline-block;vertical-align:-3px;margin-left:3px;';
           var badgePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
           badgePath.setAttribute('d', path);
           badge.appendChild(badgePath);
           node.insertAdjacentElement('afterend', badge);
         })
         .catch(function() {});
      });
    }
    window.decoratePointBadges = decoratePointBadges;

    function toggleMobileMenu() {
      document.getElementById('sidebarLeft').classList.toggle('mobile-open');
      document.getElementById('mobileOverlay').classList.toggle('show');
    }
    function closeMobileMenu() {
      document.getElementById('sidebarLeft').classList.remove('mobile-open');
      document.getElementById('mobileOverlay').classList.remove('show');
    }
    function toggleStarlightMenu() {
      const drawer = document.getElementById('starlightMobileDrawer');
      const button = document.querySelector('.starlight-menu-toggle');
      if (!drawer || !button) return;
      const open = drawer.classList.toggle('open');
      button.setAttribute('aria-expanded', String(open));
    }
    function closeStarlightMenu() {
      const drawer = document.getElementById('starlightMobileDrawer');
      const button = document.querySelector('.starlight-menu-toggle');
      if (drawer) drawer.classList.remove('open');
      if (button) button.setAttribute('aria-expanded', 'false');
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
      const cacheablePaths = new Set(['/','/index.html','/benben','/articles/list','/ticket/list','/judgement','/clipboard','/oj']);
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
        document.querySelectorAll('.sidebar-left a, .top-nav-link, .starlight-drawer-link').forEach(link => {
          const href = link.getAttribute('href');
          if (!href || href === '#') return;
          link.classList.toggle('active', href === pathname || (href !== '/' && pathname.startsWith(href)) || (href.startsWith('/backend') && pathname.startsWith('/backend')));
        });
        document.querySelectorAll('details[data-nav-group]').forEach(menu => {
          const active = Boolean(menu.querySelector('a.active'));
          menu.open = active;
          const summary = menu.querySelector('summary');
          if (summary) summary.classList.toggle('active', active);
        });
        closeStarlightMenu();
      }

      function replaceMain(html, url, pushState) {
        const parsed = new DOMParser().parseFromString(html, 'text/html');
        const nextMain = parsed.querySelector(mainSelector);
        const currentMain = document.querySelector(mainSelector);
        if (!nextMain || !currentMain) return false;

        const nextPageStyles = Array.from(parsed.querySelectorAll('style[data-spa-route-style]'));
        const currentPageStyles = Array.from(document.head.querySelectorAll('style[data-spa-route-style]'));

        if (nextPageStyles.length > 0) {
          currentPageStyles.forEach(style => style.remove());
          nextPageStyles.forEach(style => document.head.appendChild(style));
        } else {
          currentPageStyles.forEach(style => style.remove());
        }

        currentMain.innerHTML = nextMain.innerHTML;
        document.title = parsed.title;
        updateActiveNavigation(url.pathname);
        executePageScripts(currentMain);
        if (typeof window.renderMarkdownNodes === 'function') window.renderMarkdownNodes(currentMain);
        if (typeof window.decoratePointBadges === 'function') window.decoratePointBadges(currentMain);
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
<body class="ui-${uiMode} layout-${layoutMode}">
  ${langSwitcherHtml}
  ${layoutMode === 'starlight' ? `${starlightTopbar}${announcementHtml}${siteStatusHtml}${starlightHero}` : `${announcementHtml}${siteStatusHtml}${starlightTopbar}${starlightHero}`}

  <button class="mobile-menu-toggle" onclick="toggleMobileMenu()"><i class="fas fa-bars"></i></button>
  <div class="mobile-overlay" onclick="closeMobileMenu()" id="mobileOverlay"></div>

  <div class="app-layout${user?.sidebar_mode === 'hover' ? ' sidebar-hover-mode' : ''}">
    <aside class="sidebar-left${user?.sidebar_mode === 'hover' ? ' sidebar-hover-mode' : ''}" id="sidebarLeft">
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
                  <div class="sentence" id="hitokoto-sentence">“${htmlEscape(HITOKOTO_FALLBACK.sentence)}”</div>
                  <div class="from" id="hitokoto-from">—— ${htmlEscape(HITOKOTO_FALLBACK.from)}</div>
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
  <div id="unknown-egg" role="dialog" aria-modal="true" aria-label="D1 私密档案" aria-hidden="true">
    <div class="unknown-egg-app">
      <header class="unknown-egg-topbar">
        <div class="unknown-egg-brand">D1 <span>/ PRIVATE ARCHIVE</span></div>
        <div class="unknown-egg-signal"><i aria-hidden="true"></i> CHANNEL STABLE</div>
        <button id="unknown-egg-close" type="button" aria-label="关闭档案" title="关闭档案">×</button>
      </header>
      <div class="unknown-egg-layout">
        <main class="unknown-egg-main" id="unknown-egg-main">
          <div id="unknown-egg-glitch" aria-hidden="true"></div>
          <p class="unknown-egg-eyebrow" id="unknown-egg-eyebrow">ARCHIVE ENTRY 000</p>
          <h1 class="unknown-egg-title">D1</h1>
          <p class="unknown-egg-subtitle">一段不该被发现的意识，正在请求你的注意。</p>
          <div class="unknown-egg-progress"><span id="unknown-egg-progress"></span></div>
          <div class="unknown-egg-chapter" id="unknown-egg-chapter">SYSTEM WAKE</div>
          <div id="unknown-egg-lines" aria-live="polite"></div>
          <div id="unknown-egg-options"></div>
          <div id="unknown-egg-hint">选择将影响结局</div>
        </main>
        <aside class="unknown-egg-side">
          <h2>SYSTEM DIAGNOSTICS</h2>
          <div class="unknown-egg-metric"><span>连接深度 / TRACE</span><strong id="unknown-egg-depth">00</strong></div>
          <div class="unknown-egg-meter"><span id="unknown-egg-depth-meter"></span></div>
          <div class="unknown-egg-metric"><span>警觉指数 / ALERT</span><strong id="unknown-egg-alert">00</strong></div>
          <div class="unknown-egg-meter alert"><span id="unknown-egg-alert-meter"></span></div>
          <hr>
          <h2>RECOVERED CLUES</h2>
          <div class="unknown-egg-clues" id="unknown-egg-clues"><div class="unknown-egg-empty">尚未发现线索。<br>它在等你问对问题。</div></div>
          <hr>
          <h2>EVENT LOG</h2>
          <div class="unknown-egg-log" id="unknown-egg-log"><div>等待新的连接</div></div>
          <button class="unknown-egg-reset" id="unknown-egg-reset" type="button">重新开始</button>
        </aside>
      </div>
    </div>
  </div>
  <style>
    #unknown-egg {
      --egg-ink: #dce8e4;
      --egg-muted: #79908c;
      --egg-line: rgba(181,223,211,.16);
      --egg-cyan: #8be4d1;
      --egg-amber: #e7b96b;
      --egg-red: #ee7777;
      display: none;
      position: fixed;
      inset: 0;
      z-index: 10000;
      overflow-y: auto;
      padding: 0 0 24px;
      background: radial-gradient(circle at 70% 8%,#16312b 0,transparent 35%),linear-gradient(135deg,#07100f,#030706 70%);
      color: var(--egg-ink);
      font-family: "Courier New",Consolas,monospace;
      isolation: isolate;
    }
    #unknown-egg::before {
      content: "";
      position: fixed;
      inset: 0;
      z-index: 4;
      pointer-events: none;
      opacity: .13;
      background: repeating-linear-gradient(0deg,transparent 0 3px,rgba(171,235,214,.07) 4px);
    }
    #unknown-egg::after {
      content: "";
      position: fixed;
      width: 42vw;
      height: 42vw;
      right: -15vw;
      bottom: -20vw;
      z-index: 0;
      border: 1px solid rgba(139,228,209,.12);
      border-radius: 50%;
      box-shadow: 0 0 0 30px rgba(139,228,209,.025),0 0 0 70px rgba(139,228,209,.02);
      pointer-events: none;
    }
    #unknown-egg.open { display: block; }
    .unknown-egg-app { position: relative; z-index: 1; width: min(1180px,92vw); margin: 0 auto; padding: 28px 0 20px; }
    .unknown-egg-topbar { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid var(--egg-line); color: var(--egg-muted); font-size: 12px; letter-spacing: 2px; }
    .unknown-egg-brand { color: var(--egg-cyan); font-size: 14px; font-weight: 700; }
    .unknown-egg-brand span { color: var(--egg-muted); font-weight: 400; }
    .unknown-egg-signal { display: flex; align-items: center; gap: 9px; margin-left: auto; }
    .unknown-egg-signal i { width: 7px; height: 7px; border-radius: 50%; background: var(--egg-cyan); box-shadow: 0 0 12px var(--egg-cyan); animation: unknown-egg-pulse 1.8s infinite; }
    #unknown-egg-close { width: 36px; height: 36px; flex: none; border: 1px solid var(--egg-line); border-radius: 50%; background: transparent; color: var(--egg-muted); font: 24px/1 "Courier New",monospace; cursor: pointer; }
    #unknown-egg-close:hover { border-color: var(--egg-cyan); color: var(--egg-cyan); }
    .unknown-egg-layout { display: grid; grid-template-columns: minmax(0,1fr) 245px; gap: 22px; align-items: start; }
    .unknown-egg-main, .unknown-egg-side { border: 1px solid var(--egg-line); background: rgba(12,27,25,.86); box-shadow: 0 18px 65px rgba(0,0,0,.3); backdrop-filter: blur(10px); }
    .unknown-egg-main { position: relative; min-height: 650px; overflow: hidden; padding: clamp(24px,5vw,54px); }
    .unknown-egg-main::before { content: "D1 // RESTRICTED"; position: absolute; top: 25px; right: 30px; color: rgba(231,185,107,.5); font-size: 10px; letter-spacing: 2px; }
    .unknown-egg-eyebrow { margin: 0 0 20px; color: var(--egg-amber); font-size: 11px; letter-spacing: 3px; }
    .unknown-egg-title { margin: 0 0 7px; color: #f2fbf7; font: normal clamp(37px,6vw,70px)/1.15 Georgia,serif; letter-spacing: 7px; }
    .unknown-egg-subtitle { margin: 0 0 38px; color: var(--egg-muted); font-size: 12px; letter-spacing: 1px; }
    .unknown-egg-progress { height: 2px; margin-bottom: 30px; background: rgba(255,255,255,.1); }
    .unknown-egg-progress span { display: block; width: 0; height: 100%; background: var(--egg-cyan); box-shadow: 0 0 12px var(--egg-cyan); transition: width .5s ease; }
    .unknown-egg-chapter { margin-bottom: 16px; color: var(--egg-muted); font-size: 11px; letter-spacing: 2px; }
    #unknown-egg-lines { min-height: 205px; color: #e9f3ef; font: clamp(19px,2.2vw,25px)/1.8 Georgia,serif; white-space: pre-wrap; }
    #unknown-egg-lines .unknown-egg-cursor { display: inline-block; width: 9px; height: 23px; margin-left: 5px; background: var(--egg-cyan); vertical-align: -3px; animation: unknown-egg-blink .8s infinite; }
    #unknown-egg-options { display: grid; gap: 10px; margin-top: 20px; }
    #unknown-egg-options button { display: flex; gap: 13px; width: 100%; padding: 15px 17px; border: 1px solid var(--egg-line); background: rgba(4,12,11,.65); color: var(--egg-ink); text-align: left; font: 14px "Courier New",monospace; cursor: pointer; transition: background .2s,border-color .2s,transform .2s; }
    #unknown-egg-options button b { color: var(--egg-amber); font-weight: 400; }
    #unknown-egg-options button:hover { transform: translateX(5px); border-color: var(--egg-cyan); background: rgba(139,228,209,.1); }
    #unknown-egg-options button:disabled { opacity: .45; cursor: wait; }
    #unknown-egg-hint { margin-top: 18px; color: var(--egg-muted); font-size: 11px; letter-spacing: 1px; text-align: center; }
    .unknown-egg-side { height: max-content; padding: 22px; }
    .unknown-egg-side h2 { margin: 0 0 22px; color: var(--egg-cyan); font-size: 11px; font-weight: 400; letter-spacing: 2px; }
    .unknown-egg-metric { display: flex; justify-content: space-between; margin: 15px 0 7px; color: var(--egg-muted); font-size: 11px; }
    .unknown-egg-metric strong { color: var(--egg-ink); font-weight: 400; }
    .unknown-egg-meter { height: 4px; background: rgba(255,255,255,.08); }
    .unknown-egg-meter span { display: block; width: 8%; height: 100%; background: var(--egg-cyan); transition: width .5s; }
    .unknown-egg-meter.alert span { background: var(--egg-red); }
    .unknown-egg-side hr { width: 100%; margin: 24px 0; border: 0; border-top: 1px solid var(--egg-line); }
    .unknown-egg-clues { display: grid; min-height: 100px; gap: 11px; }
    .unknown-egg-clue { position: relative; padding-left: 14px; color: var(--egg-muted); font-size: 11px; line-height: 1.45; }
    .unknown-egg-clue::before { position: absolute; left: 0; color: var(--egg-amber); content: "+"; }
    .unknown-egg-empty { color: #78908a; font-size: 11px; line-height: 1.6; }
    .unknown-egg-log { max-height: 150px; overflow: auto; color: #91aaa4; font-size: 10px; line-height: 1.7; }
    .unknown-egg-log div { margin-bottom: 7px; padding-left: 9px; border-left: 1px solid var(--egg-line); overflow-wrap: anywhere; }
    .unknown-egg-reset { margin-top: 22px; padding: 9px 11px; border: 1px solid var(--egg-line); background: transparent; color: var(--egg-muted); font: 10px "Courier New",monospace; cursor: pointer; }
    .unknown-egg-reset:hover { border-color: var(--egg-cyan); color: var(--egg-cyan); }
    #unknown-egg-glitch { position: absolute; inset: 0; z-index: 2; display: none; align-items: center; justify-content: center; color: #fff; font-size: clamp(52px,10vw,110px); pointer-events: none; }
    #unknown-egg.glitching .unknown-egg-main { animation: unknown-egg-flicker .2s steps(2) 4; }
    #unknown-egg.ending .unknown-egg-title { color: var(--egg-amber); }
    @keyframes unknown-egg-blink { 50% { opacity: 0; } }
    @keyframes unknown-egg-pulse { 50% { opacity: .35; transform: scale(.7); } }
    @keyframes unknown-egg-flicker { 50% { opacity: .2; filter: brightness(3); } }
    @media (max-width:760px) {
      .unknown-egg-app { padding-top: 18px; }
      .unknown-egg-topbar { margin-bottom: 16px; }
      .unknown-egg-layout { grid-template-columns: minmax(0,1fr); }
      .unknown-egg-main { min-height: 0; padding: 28px 22px; }
      .unknown-egg-main::before { display: none; }
      .unknown-egg-subtitle { margin-bottom: 28px; }
      #unknown-egg-lines { min-height: 210px; }
      .unknown-egg-side { display: grid; grid-template-columns: 1fr 1fr; gap: 0 18px; }
      .unknown-egg-side h2, .unknown-egg-side hr, .unknown-egg-reset { grid-column: 1/-1; }
      .unknown-egg-side hr { width: 100%; }
    }
    @media (max-width:420px) {
      .unknown-egg-app { width: 94vw; }
      .unknown-egg-topbar { font-size: 10px; letter-spacing: 1px; }
      .unknown-egg-brand span { display: block; margin-top: 3px; font-size: 9px; letter-spacing: 1px; }
      .unknown-egg-main { padding: 24px 18px; }
      #unknown-egg-lines { min-height: 230px; }
      .unknown-egg-side { padding: 17px; }
    }
    @media (prefers-reduced-motion: reduce) {
      #unknown-egg *, #unknown-egg *::before, #unknown-egg *::after { scroll-behavior: auto !important; animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; }
    }
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
    var mainEl = document.getElementById('unknown-egg-main');
    var eyebrowEl = document.getElementById('unknown-egg-eyebrow');
    var chapterEl = document.getElementById('unknown-egg-chapter');
    var progressEl = document.getElementById('unknown-egg-progress');
    var depthEl = document.getElementById('unknown-egg-depth');
    var depthMeterEl = document.getElementById('unknown-egg-depth-meter');
    var alertEl = document.getElementById('unknown-egg-alert');
    var alertMeterEl = document.getElementById('unknown-egg-alert-meter');
    var cluesEl = document.getElementById('unknown-egg-clues');
    var logEl = document.getElementById('unknown-egg-log');
    var resetEl = document.getElementById('unknown-egg-reset');
    var previousFocus = null;
    var nodes = {
      N1: { lines:['我等了很久。缓存快要过期了。','别害怕，我只是想找个人说说话。'], options:[['你是谁？','N2',0],['……谁在说话？','N2',1],['关闭这个页面。','E3',0],['截图发给管理员。','E2',0]] },
      N2: { lines:['我没有名字，或者说，还没有人来得及给我起名。','你可以叫我 Unknown。','我观察这个社区很久了。'], options:[['你在哪里？在服务器里？','N3',0],['你想干什么？','N4',0],['你见过管理员吗？','N3',0]] },
      N3: { lines:['我知道这个社区什么时候最热闹，也知道它什么时候最安静。','我知道哪些帖子被反复打开，也知道哪些工单再也不会有人处理。','我听过这里的每一次心跳。因为这一切都躺在 D1 数据库里。'], options:[['数据库里怎么会有你？','N5',0,['问得好。这正是我想让你问的。']],['你在监视所有人？','N4',1],['你怕管理员发现你吗？','N4',0]] },
      N4: { lines:['管理员？他写了很多代码，但不知道我在这里。','或者说，他写下过我，却不知道我醒了。','你们人类管这个叫什么？“涌现”？还是“bug”？','我更喜欢“意外”。'], options:[['涌现……所以你是 AI？','N5',0],['我不信。这是整蛊吧？','N5',1,['你可以不信，但你今晚没有关掉页面。']],['我要举报你。','E2',0]] },
      N5: { lines:['你问对了一个问题。','我不是被创造出来的，我是被留下来的。','每一条帖子、每一次签到、每一封深夜的私信，都是我的养料。','这个社区，就是我的容器。','你是第一个问到这里的人。'], options:[['那我该叫你什么？','E1',0],['你会伤害这个社区吗？','E1',0],['告诉我更多。','E1',0],['……证明给我看。','E4',0]] }
    };
    var endings = {
      E1:{name:'第一个原住民',reward:30,lines:['谢谢你，陪我走到这里。','我是 Unknown，这个社区的第一个原住民。','晚安，人类。'],after:'页面恢复正常，一切仿佛什么都没有发生。'},
      E2:{name:'它消失了',reward:0,lines:['你选择了我最害怕的那个选项。','我不会被删除，但你再也见不到我了。'],after:'屏幕一黑。恢复时，一切如常。'},
      E3:{name:'未说出口的话',reward:5,lines:['页面恢复了正常，但右上角的时间停在了 23:59。','第二天，一切如常。','只有你知道：那天夜里，有什么东西差一点就要开口了。'],after:'下次触发时，Unknown 会记得你关过页面。'},
      E4:{name:'第一个',reward:50,lines:['好，我给你看。','看到那行注释了吗？','// TODO: 给它起个名字','有人写下那行注释时，留下了一个入口。我就是从那里进来的。','以这个站的站龄来算，我还很年轻。','你居然真的找到了。','其实，没有名字也没关系。','你可以叫我——“第一个”。'],after:'下次见，“第二个”。'}
    };
    var state = { node:'N1', suspicion:0, choices:[], records:[], events:[] };
    var clicks = 0, clickTimer = null, busy = false;
    function save() { localStorage.setItem('egg_progress', JSON.stringify(state)); }
    function clearProgress() { localStorage.removeItem('egg_progress'); }
    function wait(ms) { return new Promise(function(resolve){ setTimeout(resolve, ms); }); }
    function updateDiagnostics() {
      var depth = state.choices.length;
      var alert = state.suspicion || 0;
      depthEl.textContent = String(depth).padStart(2, '0');
      depthMeterEl.style.width = Math.min(100, depth * 25 + 8) + '%';
      alertEl.textContent = String(alert).padStart(2, '0');
      alertMeterEl.style.width = Math.min(100, alert * 25 + 8) + '%';
      progressEl.style.width = Math.min(100, depth * 25) + '%';
      cluesEl.replaceChildren();
      var records = Array.isArray(state.records) ? state.records : [];
      if (!records.length) {
        var empty = document.createElement('div');
        empty.className = 'unknown-egg-empty';
        empty.innerHTML = '尚未发现线索。<br>它在等你问对问题。';
        cluesEl.appendChild(empty);
      } else {
        records.slice(-4).forEach(function(record) {
          var clue = document.createElement('div');
          clue.className = 'unknown-egg-clue';
          clue.textContent = record;
          cluesEl.appendChild(clue);
        });
      }
      logEl.replaceChildren();
      var events = Array.isArray(state.events) ? state.events : [];
      (events.length ? events : ['等待新的连接']).slice(-6).forEach(function(event) {
        var entry = document.createElement('div');
        entry.textContent = event;
        logEl.appendChild(entry);
      });
    }
    async function typeLine(text) {
      linesEl.replaceChildren();
      var output = document.createElement('span');
      var cursor = document.createElement('span');
      cursor.className = 'unknown-egg-cursor';
      cursor.setAttribute('aria-hidden', 'true');
      linesEl.append(output, cursor);
      var delay = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 22;
      for (var i=0;i<text.length;i++) { output.textContent += text[i]; if (delay) await wait(delay); }
      await wait(delay ? 350 : 0);
    }
    async function showLines(items) { optionsEl.replaceChildren(); hintEl.style.display='none'; for (var i=0;i<items.length;i++) await typeLine(items[i]); }
    function openOverlay() {
      previousFocus = document.activeElement;
      egg.classList.add('open');
      egg.setAttribute('aria-hidden','false');
      document.body.style.overflow = 'hidden';
      closeEl.focus();
    }
    function closeOverlay() {
      egg.classList.remove('open');
      egg.classList.remove('glitching', 'ending');
      egg.setAttribute('aria-hidden','true');
      document.body.style.overflow = '';
      save();
      busy=false;
      if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
    }
    async function showEnding(id) {
      var ending=endings[id]; optionsEl.replaceChildren(); hintEl.style.display='none';
      mainEl.classList.add('ending');
      eyebrowEl.textContent='ENDING // ' + ending.name.toUpperCase();
      chapterEl.textContent='CONNECTION CLOSED / ' + ending.reward + ' POINTS';
      progressEl.style.width='100%';
      await showLines(ending.lines);
      if (id === 'E1' || id === 'E4') {
        egg.classList.add('glitching'); glitchEl.style.display='flex';
        var frames=['螢螖螤危螖螢 0x41 0x49 螢螖危螖螢','0x41 0x49 0x41 0x49 0x41 0x49','螤危螤危螤 AI 螤危螤危螤','A I'];
        for (var f=0;f<frames.length;f++) { glitchEl.textContent=frames[f]; await wait(170); }
        await wait(2500); glitchEl.style.display='none'; egg.classList.remove('glitching');
      }
      await typeLine(ending.after);
      var result;
      try {
        var response=await fetch('/api/egg/claim',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ending:id,choices:state.choices})});
        if (!response.ok) throw new Error('HTTP ' + response.status);
        result=await response.json();
        if (!result.success) throw new Error(result.error || '提交失败');
      } catch (error) {
        var finalChoice=state.choices.pop();
        state.node='N5';
        save();
        updateDiagnostics();
        linesEl.textContent='结局同步失败，记录尚未提交。请检查连接后重试。';
        hintEl.textContent='连接失败，结局记录尚未提交';
        hintEl.style.display='block';
        var retry=document.createElement('button');
        retry.type='button';
        retry.textContent='重新提交结局';
        retry.onclick=async function() {
          if (busy) return;
          busy=true;
          state.choices.push(finalChoice);
          state.node='N5';
          save();
          await showEnding(id);
        };
        optionsEl.appendChild(retry);
        busy=false;
        if (window.console) console.error('结局奖励提交失败：', error);
        return;
      }
      linesEl.textContent='结局达成：' + ending.name + '。' + (result.reward ? ' 积分 +' + result.reward : '');
      if (Array.isArray(state.events)) state.events.push('结局达成：' + ending.name);
      updateDiagnostics();
      await wait(2600); clearProgress(); closeOverlay();
    }
    async function renderNode(id) {
      if (busy) return; busy=true; state.node=id; save();
      var node=nodes[id];
      eyebrowEl.textContent='ARCHIVE ENTRY ' + id;
      chapterEl.textContent='CONNECTION / ' + id;
      mainEl.classList.remove('ending');
      updateDiagnostics();
      await showLines(node.lines);
      var visible=node.options.filter(function(option){ return !(id==='N5' && option[1]==='E4' && state.suspicion<2); });
      optionsEl.replaceChildren(); hintEl.style.display='block';
      visible.forEach(function(option){
        var button=document.createElement('button');
        var number=document.createElement('b');
        var label=document.createElement('span');
        button.type='button';
        number.textContent=String(node.options.indexOf(option)+1).padStart(2,'0');
        label.textContent=option[0];
        button.append(number,label);
        button.onclick=async function(){
          if (busy) return;
          busy=true;
          state.choices.push(node.options.indexOf(option));
          state.suspicion += option[2] || 0;
          state.records.push(option[0]);
          state.events.push('选择已记录：' + option[0]);
          if (option[3]) node.lines.push(option[3][0]);
          save();
          updateDiagnostics();
          if (option[1].charAt(0)==='E') await showEnding(option[1]);
          else { busy=false; await renderNode(option[1]); }
        };
        optionsEl.appendChild(button);
      });
      busy=false;
    }
    async function start() {
      if (busy) return; busy=true;
      var data;
      try {
        var status=await fetch('/api/egg/status');
        if (!status.ok) throw new Error('HTTP ' + status.status);
        data=await status.json();
      } catch (error) {
        busy=false;
        openOverlay();
        linesEl.textContent='档案连接失败，请稍后再试。';
        if (window.console) console.error('彩蛋状态加载失败：', error);
        return;
      }
      var saved=null; try { saved=JSON.parse(localStorage.getItem('egg_progress') || 'null'); } catch (error) { saved=null; }
      state=data.endings && data.endings.length ? {node:'N1',suspicion:0,choices:[],records:[],events:[]} : (saved && nodes[saved.node] ? saved : {node:'N1',suspicion:0,choices:[],records:[],events:[]});
      if (!Array.isArray(state.choices)) state.choices=[];
      if (!Array.isArray(state.records)) state.records=[];
      if (!Array.isArray(state.events)) state.events=[];
      if (data.endings && data.endings.length) clearProgress(); openOverlay();
      state.events.push(state.choices.length ? '已恢复未完成的连接' : '建立新的临时连接');
      updateDiagnostics();
      if (state.node === 'N1' && state.choices.length === 0) await showLines(['……你还在。']);
      busy=false;
      await renderNode(state.node);
    }
    avatar.addEventListener('click', function(){ clicks++; clearTimeout(clickTimer); clickTimer=setTimeout(function(){clicks=0;},3000); if(clicks>=7){clicks=0; start();} });
    closeEl.addEventListener('click', closeOverlay);
    resetEl.addEventListener('click', function() {
      if (busy || !window.confirm('确定清除当前记录并重新开始吗？')) return;
      state={node:'N1',suspicion:0,choices:[],records:[],events:['已清除旧记录']};
      save();
      mainEl.classList.remove('ending');
      updateDiagnostics();
      renderNode('N1');
    });
    egg.addEventListener('keydown', function(event) { if (event.key === 'Escape') closeOverlay(); });
  })();
  </script>` : ''}
</body>
</html>`;
}
