import { getUserColor } from './constants';
import { htmlEscape, renderUsernameLink } from './html';
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
    request?: Request
) {
    const t = getTranslator(request);
    const lang = getLanguage(request);

    let systemUnread = 0;
    let pmUnread = 0;
    if (user && env?.DB) {
        systemUnread = await getSystemUnreadCount(env.DB, user.id);
        pmUnread = await getPmUnreadCount(env.DB, user.id);
    }
    const chinaTime = getChinaTime();
    const hitokoto = await getHitokoto();

    const navItems = [
        { href: '/', label: t('home'), active: title === t('home') },
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
      <div class="avatar" style="background:${getUserColor(user.color)}">${user.username.charAt(0).toUpperCase()}</div>
      <div class="user-name">${renderUsernameLink(user.username, user.color, user.tag, user.id)}</div>
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
    <a href="/articles/new" class="quick-link"><i class="fas fa-plus-circle"></i> ${t('newArticle')}</a>
    <a href="/ticket/new" class="quick-link"><i class="fas fa-plus-circle"></i> ${t('newTicket')}</a>
    <a href="/judgement" class="quick-link"><i class="fas fa-gavel"></i> ${t('judgement')}</a>
    ${user ? `<a href="/user/${user.id}" class="quick-link"><i class="fas fa-user"></i> ${t('userProfile')}</a>` : ''}
  `;

    const footerNote = user && user.admin
        ? `<span class="admin-entry"><i class="fas fa-crown"></i> ${t('adminPanel')}</span><br><a href="/backend" style="color:#8E44AD;text-decoration:none;font-size:12px;">→ ${t('adminPanel')}</a>`
        : `<i class="fas fa-users"></i> ${t('registerToJoin')}`;

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
        <option value="zh" ${lang === 'zh' ? 'selected' : ''}>中文</option>
        <option value="tw" ${lang === 'tw' ? 'selected' : ''}>繁體中文</option>
        <option value="en" ${lang === 'en' ? 'selected' : ''}>English</option>
      </select>
    </div>
    <script>
    function switchLanguage(lang) {
      document.cookie = 'lang=' + lang + '; path=/; max-age=31536000';
      window.location.reload();
    }
    </script>
  `;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="icon" type="image/x-icon" href="https://raw.githubusercontent.com/js-gdo/static/refs/heads/gh-pages/icon/sl/icon.ico">
  <title>${title} - ${t('appName')}</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/marked/11.1.1/marked.min.js" defer></script>
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
    ${extraStyles}
  </style>
  <script>
    function renderMarkdown(text) {
      if (!text) return '';
      try {
        if (typeof marked !== 'undefined' && typeof marked.parse === 'function') {
          marked.setOptions({
            breaks: true,
            gfm: true,
            sanitize: false,
            headerIds: false,
            mangle: false
          });
          return marked.parse(text);
        }
      } catch(e) {
        console.warn('Markdown parse error:', e);
      }
      return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\\n/g, '<br>');
    }

    document.addEventListener('DOMContentLoaded', function() {
      document.querySelectorAll('.markdown-content').forEach(function(el) {
        var text = el.textContent;
        el.innerHTML = renderMarkdown(text);
      });
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
  </script>
</head>
<body>
  ${langSwitcherHtml}

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

    <main class="main-content">
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
</body>
</html>`;
}