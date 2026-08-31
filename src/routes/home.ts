// @ts-nocheck
import { getSessionUser } from '../utils/auth';
import { getLayout } from '../utils/layout';
import { formatTimeToChina } from '../utils/time';
import { htmlEscape, renderUsernameLink } from '../utils/html';
import { getUserColor } from '../utils/constants';
import { getTranslator } from '../utils/i18n';
import type { Env } from '../env.d';

export async function renderHome(env: Env, req: Request) {
    const t = getTranslator(req);
    const user = await getSessionUser(env, req);
    const db = env.DB;

    const articles = await db.prepare(
        `SELECT a.*, u.username, u.color, u.tag
     FROM articles a JOIN users u ON a.author_id = u.id
     ORDER BY a.is_pinned DESC, a.created_at DESC LIMIT 10`
    ).all();

    const benben = await db.prepare(
        `SELECT b.*, u.username, u.color, u.tag
     FROM benben b JOIN users u ON b.author_id = u.id
     WHERE u.use = 1
     ORDER BY b.created_at DESC LIMIT 5`
    ).all();

    const articleCount = await db.prepare('SELECT COUNT(*) as count FROM articles').first();
    const ticketCount = await db.prepare('SELECT COUNT(*) as count FROM tickets').first();
    const banners = await db.prepare('SELECT * FROM banners ORDER BY sort_order ASC, id ASC').all();

    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const onlineResult = await db.prepare('SELECT COUNT(*) as cnt FROM users WHERE last_active_at > ?').bind(fiveMinAgo).first();
    const onlineCount = onlineResult ? onlineResult.cnt : 0;
    const onlineUsers = await db.prepare(
        `SELECT id, username, color, tag, last_active_at
         FROM users
         WHERE last_active_at > ?
         ORDER BY last_active_at DESC
         LIMIT 12`
    ).bind(fiveMinAgo).all();

    const today = new Date().toISOString().split('T')[0];
    let isCheckedIn = false;
    let fortuneDisplay = '';
    let fortuneDetail = '';
    let userPoints = 0;

    if (user) {
        userPoints = user.points || 0;
        if (user.checkin_date === today && user.last_fortune) {
            isCheckedIn = true;
            try {
                const fortune = JSON.parse(user.last_fortune);
                fortuneDisplay = `<span style="color:${fortune.color};font-weight:700;font-size:18px;margin-left:6px;">${fortune.level}</span>`;
                if (fortune.activities && fortune.activities.length) {
                    const yiList = fortune.activities.filter((a: any) => a.type === '宜');
                    const jiList = fortune.activities.filter((a: any) => a.type === '忌');
                    fortuneDetail = `
            <div style="margin-top:14px;padding-top:12px;border-top:1px solid #f0f0f0;">
              <div style="text-align:center;margin-bottom:10px;">
                <div style="font-size:22px;font-weight:700;color:${fortune.color};">${fortune.level}</div>
                <div style="font-size:12px;color:#bbb;margin-top:2px;">${t('checkinMessage')}</div>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <div>
                  ${yiList.map((a: any) => `
                    <div style="margin-bottom:10px;">
                      <div style="color:#e74c3c;font-weight:700;font-size:15px;">宜：${htmlEscape(a.name)}</div>
                      <div style="color:#e74c3c;font-size:13px;margin-top:2px;">${htmlEscape(a.desc)}</div>
                    </div>
                  `).join('')}
                </div>
                <div>
                  ${jiList.map((a: any) => `
                    <div style="margin-bottom:10px;">
                      <div style="color:#333;font-weight:700;font-size:15px;">忌：${htmlEscape(a.name)}</div>
                      <div style="color:#555;font-size:13px;margin-top:2px;">${htmlEscape(a.desc)}</div>
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>
          `;
                }
            } catch { }
        }
    }

    const content = `
    <style>
      .home-grid { display: grid; grid-template-columns: 1fr; gap: 16px; }
      .home-row-top { display: grid; grid-template-columns: 2fr 1fr; gap: 16px; }
      .home-row-middle { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
      .home-row-bottom { display: grid; grid-template-columns: 2fr 1fr; gap: 16px; align-items: stretch; }
      .card { background: #fff; border-radius: 8px; padding: 16px 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
      .card h3 { font-size: 15px; font-weight: 600; margin-bottom: 10px; color: #333; }
      .card h3 i { margin-right: 6px; color: #8E44AD; }
      .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
      .card-header h3 { margin-bottom: 0; }
      .banner-carousel { position: relative; width: 100%; aspect-ratio: 16/9; overflow: hidden; border-radius: 6px; background: #e8ecf1; }
      .banner-slides { display: flex; width: 100%; height: 100%; transition: transform 0.5s ease; }
      .banner-slide { min-width: 100%; height: 100%; }
      .banner-slide img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .banner-slide a { display: block; width: 100%; height: 100%; }
      .banner-arrow { position: absolute; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,0.4); color: #fff; border: none; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center; transition: background 0.2s; z-index: 2; }
      .banner-arrow:hover { background: rgba(0,0,0,0.6); }
      .banner-arrow.prev { left: 10px; }
      .banner-arrow.next { right: 10px; }
      .banner-dots { position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%); display: flex; gap: 6px; z-index: 2; }
      .banner-dot { width: 8px; height: 8px; border-radius: 50%; background: rgba(255,255,255,0.5); cursor: pointer; transition: all 0.2s; }
      .banner-dot.active { background: #fff; width: 20px; border-radius: 4px; }
      .checkin-btn {
        background: #8E44AD; color: #fff; padding: 6px 18px; border: none; border-radius: 4px; cursor: pointer;
        font-weight: 500; font-size: 14px; transition: background 0.2s;
      }
      .checkin-btn:hover { background: #7d3c98; }
      .checkin-btn:disabled { opacity: 0.6; cursor: not-allowed; }
      .stat-box { text-align: center; padding: 12px 0; }
      .stat-box .num { font-size: 28px; font-weight: 700; color: #8E44AD; }
      .stat-box .label { font-size: 13px; color: #999; margin-top: 4px; }
      .discuss-item { padding: 8px 0; border-bottom: 1px solid #f5f5f5; }
      .discuss-item:last-child { border: none; }
      .discuss-item .title { font-size: 14px; }
      .discuss-item .title a { color: #333; text-decoration: none; }
      .discuss-item .title a:hover { color: #8E44AD; }
      .discuss-item .meta { font-size: 12px; color: #999; margin-top: 2px; }
      .pin-tag { background: #f39c12; color: #fff; font-size: 10px; padding: 1px 8px; border-radius: 3px; margin-left: 4px; }
      .right-side { display: flex; flex-direction: column; gap: 16px; height: 100%; }
      .right-side .card-dynamic { flex: 1; }
      .fortune-display { font-size: 14px; color: #666; margin-top: 4px; }
      .checked-in-badge {
        background: #2ecc71; color: #fff; padding: 4px 14px; border-radius: 4px; font-size: 14px;
        display: inline-flex; align-items: center; gap: 6px;
      }
      .points-display {
        font-size: 14px;
        color: #666;
        margin-top: 4px;
      }
      .points-display strong { color: #8E44AD; }
      .online-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: rgba(46, 204, 113, 0.12);
        color: #27ae60;
        border: 1px solid rgba(46, 204, 113, 0.25);
        border-radius: 999px;
        padding: 2px 10px;
        font-size: 12px;
        font-weight: 600;
      }
      .online-user-list { display: flex; flex-direction: column; gap: 8px; }
      .online-user-item {
        display: flex; align-items: center; gap: 10px;
        padding: 7px 8px; border-radius: 8px; background: #faf7fc; border: 1px solid #f0e7f8;
      }
      .online-status-dot {
        width: 8px; height: 8px; border-radius: 50%; background: #2ecc71; box-shadow: 0 0 0 3px rgba(46,204,113,0.15);
      }
      .online-avatar {
        width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
        color: #fff; font-size: 12px; font-weight: 700; flex-shrink: 0;
      }
      .online-user-meta { display: flex; flex-direction: column; min-width: 0; }
      .online-user-name { font-size: 13px; line-height: 1.2; }
      .online-user-time { font-size: 11px; color: #999; margin-top: 2px; }
      @media (max-width: 768px) {
        .home-row-top, .home-row-middle, .home-row-bottom { grid-template-columns: 1fr; }
      }
    </style>

    <div class="home-grid">
      <div class="home-row-top">
        <div class="card" style="padding:0;overflow:hidden;">
          <div class="banner-carousel" id="bannerCarousel">
            <div class="banner-slides" id="bannerSlides">
              ${banners.results.map((b: any, i: number) => `
                <div class="banner-slide">
                  ${b.link_url ? `<a href="${htmlEscape(b.link_url)}" target="_blank" rel="noopener"><img src="${htmlEscape(b.image_url)}" alt="Banner ${i + 1}" onerror="this.parentElement.parentElement.innerHTML='<div style=\\'padding:40px;text-align:center;color:#999;\\'>${t('appName')}</div>';"></a>` : `<img src="${htmlEscape(b.image_url)}" alt="Banner ${i + 1}" onerror="this.parentElement.innerHTML='<div style=\\'padding:40px;text-align:center;color:#999;\\'>${t('appName')}</div>';">`}
                </div>
              `).join('')}
              ${banners.results.length > 1 ? `
                <div class="banner-slide">
                  ${banners.results[0].link_url ? `<a href="${htmlEscape(banners.results[0].link_url)}" target="_blank" rel="noopener"><img src="${htmlEscape(banners.results[0].image_url)}" alt="Banner clone" onerror="this.parentElement.parentElement.innerHTML='<div style=\\'padding:40px;text-align:center;color:#999;\\'>${t('appName')}</div>';"></a>` : `<img src="${htmlEscape(banners.results[0].image_url)}" alt="Banner clone" onerror="this.parentElement.innerHTML='<div style=\\'padding:40px;text-align:center;color:#999;\\'>${t('appName')}</div>';">`}
                </div>
              ` : ''}
            </div>
            ${banners.results.length > 1 ? `
              <button class="banner-arrow prev" onclick="bannerPrev()"><i class="fas fa-chevron-left"></i></button>
              <button class="banner-arrow next" onclick="bannerNext()"><i class="fas fa-chevron-right"></i></button>
              <div class="banner-dots">
                ${banners.results.map((_: any, i: number) => `<div class="banner-dot ${i === 0 ? 'active' : ''}" onclick="bannerGoTo(${i})"></div>`).join('')}
              </div>
            ` : ''}
          </div>
        </div>
        <div class="card" style="display:flex;flex-direction:column;justify-content:center;text-align:center;gap:6px;">
          <div style="font-size:14px;color:#666;"><i class="fas fa-calendar-check"></i> ${t('checkinTitle')}</div>
          ${user ? `
            <div>
              ${isCheckedIn ? `
                <div style="display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;">
                  <span class="checked-in-badge">
                    <i class="fas fa-check-circle"></i> ${t('alreadyCheckedin')}
                  </span>
                  ${fortuneDisplay}
                </div>
              ` : `
                <button class="checkin-btn" onclick="checkin()">
                  <i class="fas fa-check"></i> ${t('checkinTitle')} (+10 ${t('points')})
                </button>
                <div id="checkin-status" style="font-size:13px;color:#999;margin-top:4px;"></div>
              `}
            </div>
            <div class="fortune-display">${isCheckedIn ? t('fortuneDisplay') : t('checkinToGetFortune')}</div>
            <div class="points-display"><i class="fas fa-coins"></i> ${t('points')}：<strong>${userPoints}</strong></div>
            ${fortuneDetail}
          ` : `
            <div style="color:#999;font-size:13px;">${t('loginRequired')}</div>
          `}
        </div>
      </div>

      <div class="home-row-middle">
        <div class="card">
          <div class="stat-box">
            <div class="num">${articleCount ? articleCount.count : 0}</div>
            <div class="label"><i class="fas fa-file-alt"></i> ${t('totalArticles')}</div>
          </div>
        </div>
        <div class="card">
          <div class="stat-box">
            <div class="num">${ticketCount ? ticketCount.count : 0}</div>
            <div class="label"><i class="fas fa-ticket-alt"></i> ${t('totalTickets')}</div>
          </div>
        </div>
        <div class="card">
          <div class="stat-box">
            <div class="num">${onlineCount}</div>
            <div class="label"><i class="fas fa-users"></i> ${t('onlineUsers')}</div>
          </div>
        </div>
      </div>

      <div class="home-row-bottom">
        <div style="display:flex;flex-direction:column;gap:16px;">
          <div class="card">
            <div class="card-header">
              <h3><i class="fas fa-thumbtack"></i> ${t('latestDiscussions')}</h3>
              <a href="/articles/list" style="font-size:13px;color:#8E44AD;text-decoration:none;">${t('viewAll')} →</a>
            </div>
            ${articles.results.slice(0, 8).map((a: any) => `
              <div class="discuss-item">
                <div class="title">
                  <a href="/articles/${a.hex_id}">${htmlEscape(a.title)}</a>
                  ${a.is_pinned ? `<span class="pin-tag">${t('articlePinned')}</span>` : ''}
                  ${a.is_locked ? `<span class="pin-tag" style="background:#e74c3c;">${t('articleLocked')}</span>` : ''}
                </div>
                <div class="meta">
                  ${renderUsernameLink(a.username, a.color, a.tag, a.author_id)}
                  · ${formatTimeToChina(a.created_at)}
                </div>
              </div>
            `).join('')}
            ${articles.results.length === 0 ? `<div style="color:#999;padding:12px 0;text-align:center;">${t('noArticles')}</div>` : ''}
          </div>
        </div>

        <div class="right-side">
          <div class="card">
            <div class="card-header">
              <h3><i class="fas fa-user-friends"></i> ${t('onlineUsers')}</h3>
              <span class="online-pill"><i class="fas fa-circle" style="font-size:8px;"></i> ${onlineCount} ${t('onlineCount')}</span>
            </div>
            <div class="online-user-list">
              ${onlineUsers.results.length > 0 ? onlineUsers.results.map((u: any) => `
                <div class="online-user-item">
                  <span class="online-status-dot"></span>
                  <div class="online-avatar" style="background:${getUserColor(u.color)}">${htmlEscape(u.username).charAt(0).toUpperCase()}</div>
                  <div class="online-user-meta">
                    <div class="online-user-name">${renderUsernameLink(u.username, u.color, u.tag, u.id)}</div>
                    <div class="online-user-time">${u.last_active_at ? t('activeAt') + ' ' + formatTimeToChina(u.last_active_at) : t('justNow')}</div>
                  </div>
                </div>
              `).join('') : `<div style="color:#999;padding:6px 0;text-align:center;">${t('noOnlineUsers')}</div>`}
            </div>
          </div>
          <div class="card">
            <div class="card-header">
              <h3><i class="fas fa-comment-dots"></i> ${t('benben')}</h3>
              <a href="/benben" style="font-size:13px;color:#8E44AD;text-decoration:none;">${t('viewAll')} →</a>
            </div>
            ${user ? `
              <form action="/api/benben" method="POST" style="display:flex;gap:6px;margin-bottom:10px;">
                <input type="text" name="content" placeholder="${t('benbenPlaceholder')}" required style="flex:1;padding:6px 10px;border:1px solid #ddd;border-radius:4px;font-size:13px;">
                <button type="submit" style="background:#8E44AD;color:#fff;padding:6px 14px;border:none;border-radius:4px;cursor:pointer;font-size:13px;">${t('submit')}</button>
              </form>
            ` : `
              <div style="color:#999;font-size:13px;margin-bottom:10px;">${t('loginRequired')}</div>
            `}
            ${benben.results.map((b: any) => `
              <div class="benben-item">
                ${renderUsernameLink(b.username, b.color, b.tag, b.author_id)}
                <span style="font-size:11px;color:#999;margin-left:6px;">${formatTimeToChina(b.created_at)}</span>
                <div class="markdown-body markdown-content" style="margin-top:4px;font-size:14px;">${htmlEscape(b.content)}</div>
              </div>
            `).join('')}
            ${benben.results.length === 0 ? `<div style="color:#999;padding:6px 0;text-align:center;">${t('noBenben')}</div>` : ''}
          </div>
        </div>
      </div>
    </div>

    <script>
      async function checkin() {
        const res = await fetch('/api/checkin', { method: 'POST' });
        const data = await res.json();
        const statusEl = document.getElementById('checkin-status');
        if (data.message) {
          statusEl.innerHTML = '<span style="color:#2ecc71;"><i class="fas fa-check-circle"></i> ' + data.message + '</span>';
          if (data.points !== undefined) {
            statusEl.innerHTML += '<br><span style="color:#8E44AD;">+ ' + data.points + ' ${t('points')}</span>';
          }
          setTimeout(() => location.reload(), 1500);
        }
      }
      let bannerIndex = 0;
      const bannerTotal = ${banners.results.length};
      let bannerAnimating = false;
      function bannerUpdate(animate) {
        const slides = document.getElementById('bannerSlides');
        if (slides) {
          if (animate === false) {
            slides.style.transition = 'none';
            slides.style.transform = 'translateX(-' + (bannerIndex * 100) + '%)';
            slides.offsetHeight;
            slides.style.transition = '';
          } else {
            slides.style.transform = 'translateX(-' + (bannerIndex * 100) + '%)';
          }
        }
        const realIndex = bannerIndex % bannerTotal;
        document.querySelectorAll('.banner-dot').forEach((d, i) => d.classList.toggle('active', i === realIndex));
      }
      function bannerNext() {
        if (bannerAnimating) return;
        bannerAnimating = true;
        bannerIndex++;
        bannerUpdate();
        if (bannerIndex === bannerTotal) {
          setTimeout(function() { bannerIndex = 0; bannerUpdate(false); bannerAnimating = false; }, 550);
        } else {
          setTimeout(function() { bannerAnimating = false; }, 550);
        }
      }
      function bannerPrev() {
        if (bannerAnimating) return;
        bannerAnimating = true;
        if (bannerIndex === 0) {
          bannerIndex = bannerTotal;
          bannerUpdate(false);
          setTimeout(function() {
            bannerIndex = bannerTotal - 1;
            bannerUpdate();
            setTimeout(function() { bannerAnimating = false; }, 550);
          }, 50);
        } else {
          bannerIndex--;
          bannerUpdate();
          setTimeout(function() { bannerAnimating = false; }, 550);
        }
      }
      function bannerGoTo(i) { bannerIndex = i; bannerUpdate(); }
      if (bannerTotal > 1) setInterval(bannerNext, 5000);
    </script>
  `;

    return await getLayout(env, user, t('home'), content, '', req);
}
