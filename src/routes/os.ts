import { getSessionUser } from '../utils/auth';
import { getLayout } from '../utils/layout';
import type { Env } from '../env.d';

export async function renderOS(env: Env, req: Request) {
    const user = await getSessionUser(env, req);

    const apps = [
        { id: 'home', name: '主页', icon: 'fa-house', color: '#8e44ad', src: '/' },
        { id: 'articles', name: '文章', icon: 'fa-newspaper', color: '#2e86de', src: '/articles/list' },
        { id: 'tickets', name: '工单', icon: 'fa-ticket', color: '#f39c12', src: '/ticket/list' },
        { id: 'oj', name: 'OJ', icon: 'fa-code', color: '#16a085', src: '/oj' },
        { id: 'team', name: '团队', icon: 'fa-users', color: '#9b59b6', src: '/team' },
        { id: 'messages', name: '消息', icon: 'fa-bell', color: '#e67e22', src: '/messages' },
        { id: 'pm', name: '私信', icon: 'fa-envelope', color: '#27ae60', src: '/pm' },
        { id: 'leaderboard', name: '排行榜', icon: 'fa-ranking-star', color: '#e74c3c', src: '/leaderboard' },
        { id: 'search', name: '搜索', icon: 'fa-magnifying-glass', color: '#34495e', src: '/search' },
        { id: 'settings', name: '设置', icon: 'fa-gear', color: '#7f8c8d', src: user ? '/settings' : '/login' },
        { id: 'backend', name: '后台', icon: 'fa-shield-halved', color: '#c0392b', src: '/backend' },
    ];

    const desktopAppHtml = apps.map((app) => {
        return '<button class="desktop-app" type="button" data-app-id="' + app.id + '" data-app-name="' + app.name + '" data-app-src="' + app.src + '"><div class="desktop-app-icon" style="background: linear-gradient(135deg, ' + app.color + ', rgba(255,255,255,0.25));"><i class="fas ' + app.icon + '"></i></div><div class="desktop-app-label">' + app.name + '</div></button>';
    }).join('');

    const startMenuHtml = apps.map((app) => {
        return '<button class="start-menu-item" type="button" data-app-id="' + app.id + '" data-app-name="' + app.name + '" data-app-src="' + app.src + '"><div class="desktop-app-icon" style="background: linear-gradient(135deg, ' + app.color + ', rgba(255,255,255,0.25));"><i class="fas ' + app.icon + '"></i></div><div>' + app.name + '</div></button>';
    }).join('');

    const content = `
    <style>
      body.layout-classic .app-layout,
      body.layout-starlight .app-layout {
        display: block !important;
        max-width: none !important;
        width: 100% !important;
        min-height: 100vh !important;
        margin: 0 !important;
        padding: 0 !important;
        background: transparent !important;
      }
      body.layout-classic .sidebar-left,
      body.layout-starlight .sidebar-left,
      body.layout-classic .sidebar-right,
      body.layout-starlight .sidebar-right,
      body.layout-classic .mobile-menu-toggle,
      body.layout-starlight .mobile-menu-toggle,
      body.layout-classic .mobile-overlay,
      body.layout-starlight .mobile-overlay,
      body.layout-classic .site-announcements,
      body.layout-starlight .site-announcements,
      body.layout-classic .site-status-banner,
      body.layout-starlight .site-status-banner,
      body.layout-classic .starlight-topbar,
      body.layout-starlight .starlight-topbar,
      body.layout-classic .starlight-home-hero,
      body.layout-starlight .starlight-home-hero,
      body.layout-classic #lang-switcher,
      body.layout-starlight #lang-switcher {
        display: none !important;
      }
      body.layout-classic .main-content,
      body.layout-starlight .main-content {
        width: 100% !important;
        max-width: none !important;
        min-width: 0 !important;
        padding: 0 !important;
        background: transparent !important;
      }
      body.layout-classic,
      body.layout-starlight {
        background: linear-gradient(180deg, #cfe4ff 0%, #dfe9f7 14%, #eef3fb 100%);
      }
      .os-shell {
        position: relative;
        min-height: calc(100vh - 120px);
        overflow: hidden;
        border-radius: 18px;
        background: linear-gradient(180deg, rgba(12, 26, 52, 0.18), rgba(12,26,52,0.04));
      }
      .desktop-grid {
        position: relative;
        display: grid;
        grid-auto-flow: column;
        grid-template-rows: repeat(auto-fill, minmax(96px, 1fr));
        grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
        gap: 14px 12px;
        padding: 18px 18px 96px;
        align-content: start;
      }
      .desktop-app {
        appearance: none;
        border: 0;
        background: rgba(255,255,255,0.08);
        border-radius: 14px;
        padding: 10px 8px 8px;
        color: #fff;
        text-align: center;
        cursor: pointer;
        transition: transform 0.16s ease, background 0.16s ease, box-shadow 0.16s ease;
        box-shadow: inset 0 0 0 1px rgba(255,255,255,0.08);
      }
      .desktop-app:hover {
        transform: translateY(-2px);
        background: rgba(255,255,255,0.14);
        box-shadow: 0 10px 18px rgba(15, 23, 42, 0.12);
      }
      .desktop-app-icon {
        width: 54px;
        height: 54px;
        margin: 0 auto 8px;
        border-radius: 14px;
        display: grid;
        place-items: center;
        font-size: 24px;
        color: #fff;
        box-shadow: inset 0 0 0 1px rgba(255,255,255,0.15), 0 10px 18px rgba(0, 0, 0, 0.16);
      }
      .desktop-app-label {
        font-size: 12px;
        line-height: 1.3;
        font-weight: 600;
        word-break: break-word;
        color: #f7fbff;
        text-shadow: 0 2px 8px rgba(24, 36, 54, 0.35);
      }
      .window-layer {
        position: absolute;
        inset: 0;
        pointer-events: none;
      }
      .window {
        --app-w: min(72vw, 980px);
        --app-h: min(70vh, 620px);
        position: absolute;
        left: 50%;
        top: 52%;
        transform: translate(-50%, -50%);
        width: var(--app-w);
        height: var(--app-h);
        background: rgba(255,255,255,0.78);
        border: 1px solid rgba(148, 163, 184, 0.35);
        border-radius: 18px;
        backdrop-filter: blur(12px);
        box-shadow: 0 30px 80px rgba(15, 23, 42, 0.22);
        display: flex;
        flex-direction: column;
        pointer-events: auto;
        overflow: hidden;
        transition: transform 0.2s ease, width 0.2s ease, height 0.2s ease, opacity 0.2s ease;
      }
      .window.hidden {
        display: none;
      }
      .window.minimized {
        display: none;
      }
      .window.maximized {
        width: calc(100vw - 80px);
        height: calc(100vh - 160px);
        left: 50%;
        top: 50%;
      }
      .window-header {
        height: 42px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 12px 0 14px;
        background: linear-gradient(180deg, rgba(15,23,42,0.06), rgba(15,23,42,0.02));
        border-bottom: 1px solid rgba(148, 163, 184, 0.22);
        cursor: move;
        user-select: none;
      }
      .window-header-left {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .window-title {
        font-size: 13px;
        font-weight: 700;
        color: #1f2937;
      }
      .window-controls {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .window-control {
        width: 28px;
        height: 28px;
        border-radius: 8px;
        border: none;
        cursor: pointer;
        background: rgba(148, 163, 184, 0.18);
        display: inline-grid;
        place-items: center;
        color: #ffffff;
        font-size: 12px;
        box-shadow: inset 0 0 0 1px rgba(255,255,255,0.2);
      }
      .window-control.close { background: #ef4444; }
      .window-control.minimize { background: #fbbf24; color: #3b2f00; }
      .window-control.maximize { background: #22c55e; }
      .window-control i { pointer-events: none; }
      .window-body {
        flex: 1;
        background: rgba(255,255,255,0.3);
      }
      .window-body iframe {
        width: 100%;
        height: 100%;
        border: 0;
        background: #fff;
      }
      .taskbar {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        height: 58px;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 0 12px 10px;
        z-index: 15;
      }
      .taskbar-bar {
        width: min(1280px, calc(100% - 8px));
        margin: 0 auto;
        height: 48px;
        display: flex;
        align-items: center;
        border-radius: 16px;
        background: rgba(255,255,255,0.58);
        border: 1px solid rgba(148,163,184,0.26);
        box-shadow: 0 10px 26px rgba(15, 23, 42, 0.08);
        backdrop-filter: blur(16px);
      }
      .start-button {
        border: 0;
        background: linear-gradient(180deg, #1d4ed8 0%, #1e3a8a 100%);
        color: #fff;
        padding: 0 18px;
        height: 100%;
        border-radius: 16px 0 0 16px;
        font-weight: 700;
        cursor: pointer;
      }
      .taskbar-apps {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1;
        padding: 0 8px;
        overflow-x: auto;
      }
      .taskbar-app {
        border: 0;
        background: rgba(15,23,42,0.04);
        color: #1f2937;
        height: 36px;
        padding: 0 12px;
        border-radius: 10px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        white-space: nowrap;
      }
      .taskbar-app.active {
        background: rgba(59,130,246,0.12);
        color: #1d4ed8;
      }
      .tray {
        padding-right: 12px;
        color: #334155;
        font-size: 12px;
        font-weight: 700;
      }
      .start-menu {
        position: absolute;
        left: 18px;
        bottom: 64px;
        width: min(360px, calc(100vw - 32px));
        display: none;
        background: rgba(255,255,255,0.8);
        border: 1px solid rgba(148,163,184,0.24);
        border-radius: 18px;
        box-shadow: 0 30px 80px rgba(15, 23, 42, 0.18);
        padding: 12px;
        backdrop-filter: blur(14px);
        z-index: 18;
      }
      .start-menu.open {
        display: block;
      }
      .start-menu-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
      }
      .start-menu-item {
        border: 0;
        background: rgba(15,23,42,0.04);
        border-radius: 12px;
        padding: 12px 8px;
        text-align: center;
        color: #1f2937;
        cursor: pointer;
      }
      .start-menu-item .desktop-app-icon {
        width: 42px;
        height: 42px;
        margin-bottom: 6px;
        font-size: 20px;
      }
      @media (max-width: 720px) {
        .desktop-grid {
          grid-template-columns: repeat(auto-fill, minmax(82px, 1fr));
          padding: 16px 12px 80px;
        }
        .desktop-app-icon {
          width: 44px;
          height: 44px;
          font-size: 20px;
        }
        .window {
          --app-w: calc(100vw - 18px);
          --app-h: min(78vh, 540px);
        }
        .window.maximized {
          width: calc(100vw - 20px);
          height: calc(100vh - 140px);
        }
      }
    </style>

    <div class="os-shell">
      <div class="desktop-grid" id="desktopGrid">
        ${desktopAppHtml}
      </div>

      <div class="window-layer" id="windowLayer"></div>

      <div class="taskbar">
        <div class="taskbar-bar">
          <button class="start-button" type="button" id="startButton">开始</button>
          <div class="taskbar-apps" id="taskbarApps"></div>
          <div class="tray">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
      </div>

      <div class="start-menu" id="startMenu">
        <div class="start-menu-grid">
          ${startMenuHtml}
        </div>
      </div>
    </div>

    <script>
      const appDefinitions = ${JSON.stringify(apps)};
      const openWindows = new Map();
      const taskbarApps = document.getElementById('taskbarApps');
      const windowLayer = document.getElementById('windowLayer');
      const startMenu = document.getElementById('startMenu');
      const startButton = document.getElementById('startButton');

      function renderTaskbar() {
        const entries = Array.from(openWindows.values());
        taskbarApps.innerHTML = entries.map(function (item) {
          return '<button class="taskbar-app ' + (item.active ? 'active' : '') + '" type="button" data-window-id="' + item.id + '"><i class="fas ' + item.icon + '"></i><span>' + item.name + '</span></button>';
        }).join('');

        taskbarApps.querySelectorAll('.taskbar-app').forEach(function (button) {
          button.addEventListener('click', function () {
            const id = button.dataset.windowId;
            const item = openWindows.get(id);
            if (!item) return;
            if (item.minimized) {
              item.minimized = false;
              item.window.classList.remove('minimized');
            } else if (item.active) {
              item.minimized = true;
              item.window.classList.add('minimized');
            }
            setActiveWindow(id);
          });
        });
      }

      function setActiveWindow(id) {
        Array.from(openWindows.values()).forEach(function (item) {
          item.active = item.id === id;
          item.window.style.zIndex = item.id === id ? 12 : 10;
          if (item.id === id) {
            item.window.classList.remove('minimized');
          }
        });
        renderTaskbar();
      }

      function createWindow(app) {
        const existing = openWindows.get(app.id);
        if (existing) {
          existing.minimized = false;
          setActiveWindow(existing.id);
          return;
        }

        const win = document.createElement('div');
        win.className = 'window';
        win.innerHTML = '<div class="window-header"><div class="window-header-left"><div class="desktop-app-icon" style="width: 22px; height: 22px; margin: 0; border-radius: 8px; font-size: 11px; background: linear-gradient(135deg, ' + app.color + ', rgba(255,255,255,0.25));"><i class="fas ' + app.icon + '"></i></div><span class="window-title">' + app.name + '</span></div><div class="window-controls"><button class="window-control minimize" type="button" aria-label="最小化" title="最小化"><i class="fas fa-minus"></i></button><button class="window-control maximize" type="button" aria-label="最大化" title="最大化"><i class="fas fa-window-maximize"></i></button><button class="window-control close" type="button" aria-label="关闭" title="关闭"><i class="fas fa-xmark"></i></button></div></div><div class="window-body"><iframe src="' + app.src + '" title="' + app.name + '"></iframe></div>';

        const frame = win.querySelector('iframe');
        frame.addEventListener('load', function () {
          if (frame.contentWindow && frame.contentWindow.document) {
            const doc = frame.contentWindow.document;
            const body = doc.body;
            if (body) {
              body.style.background = '#f7f9fb';
            }
          }
        });

        const state = {
          id: app.id,
          name: app.name,
          icon: app.icon,
          active: true,
          minimized: false,
          maximized: false,
          window: win,
        };

        openWindows.set(app.id, state);
        windowLayer.appendChild(win);
        renderTaskbar();
        setActiveWindow(app.id);

        const closeBtn = win.querySelector('.window-control.close');
        closeBtn.addEventListener('click', function () {
          openWindows.delete(app.id);
          win.remove();
          renderTaskbar();
        });

        const minimizeBtn = win.querySelector('.window-control.minimize');
        minimizeBtn.addEventListener('click', function () {
          state.minimized = true;
          win.classList.add('minimized');
          setActiveWindow(Array.from(openWindows.keys()).slice(-1)[0] || app.id);
        });

        const maximizeBtn = win.querySelector('.window-control.maximize');
        const updateMaximizeButton = function () {
          const icon = state.maximized ? 'fa-window-restore' : 'fa-window-maximize';
          maximizeBtn.innerHTML = '<i class="fas ' + icon + '"></i>';
        };
        updateMaximizeButton();
        maximizeBtn.addEventListener('click', function () {
          state.maximized = !state.maximized;
          win.classList.toggle('maximized', state.maximized);
          updateMaximizeButton();
        });

        win.addEventListener('pointerdown', function () {
          setActiveWindow(app.id);
        });

        let dragging = false;
        const header = win.querySelector('.window-header');
        header.addEventListener('pointerdown', function (event) {
          if (event.target.closest('button')) return;
          dragging = true;
          const rect = win.getBoundingClientRect();
          const offsetX = event.clientX - rect.left;
          const offsetY = event.clientY - rect.top;
          const onMove = function (moveEvent) {
            if (!dragging) return;
            if (state.maximized) {
              state.maximized = false;
              win.classList.remove('maximized');
            }
            const left = Math.min(Math.max(moveEvent.clientX - offsetX, 10), window.innerWidth - win.offsetWidth - 10);
            const top = Math.min(Math.max(moveEvent.clientY - offsetY, 40), window.innerHeight - win.offsetHeight - 80);
            win.style.left = left + 'px';
            win.style.top = top + 'px';
            win.style.transform = 'none';
          };
          const onUp = function () {
            dragging = false;
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
          };
          window.addEventListener('pointermove', onMove);
          window.addEventListener('pointerup', onUp);
        });
      }

      document.querySelectorAll('[data-app-id]').forEach(function (el) {
        el.addEventListener('click', function () {
          const app = appDefinitions.find(function (item) {
            return item.id === el.dataset.appId;
          });
          if (!app) return;
          createWindow(app);
          startMenu.classList.remove('open');
        });
      });

      startButton.addEventListener('click', function () {
        startMenu.classList.toggle('open');
      });

      document.addEventListener('click', function (event) {
        const clickedInsideMenu = event.target.closest('#startMenu');
        const clickedStart = event.target.closest('#startButton');
        if (!clickedInsideMenu && !clickedStart) {
          startMenu.classList.remove('open');
        }
      });

      const timeTray = document.querySelector('.tray');
      const updateTrayTime = function () {
        if (timeTray) {
          timeTray.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
      };
      setInterval(updateTrayTime, 15000);
    </script>
    `;

    return getLayout(env, user, '桌面', content, '', req, false);
}
