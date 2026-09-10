import { getSessionUser } from '../utils/auth';
import { getLayout } from '../utils/layout';
import { renderUsernameLink, htmlEscape } from '../utils/html';
import { formatTimeToChina } from '../utils/time';
import { getUserColor, getTicketStatus } from '../utils/constants';
import { getTranslator } from '../utils/i18n';
import type { Env } from '../env.d';

export async function renderBackend(env: Env, req: Request) {
    const t = getTranslator(req);
    const user = await getSessionUser(env, req);
    if (!user || !user.admin) return t('permissionDenied');

    const db = env.DB;
    const users = await db.prepare('SELECT * FROM users ORDER BY id').all();
    const articles = await db.prepare('SELECT * FROM articles ORDER BY id DESC').all();
    const tickets = await db.prepare('SELECT * FROM tickets ORDER BY id DESC').all();
    const banners = await db.prepare('SELECT * FROM banners ORDER BY sort_order ASC, id ASC').all();
    const statsNow = new Date();
    const statsEnd = new Date(statsNow);
    statsEnd.setUTCMinutes(0, 0, 0);
    const statsStart = new Date(statsEnd.getTime() - 29 * 24 * 60 * 60 * 1000);
    const onlineStats = await db.prepare(
        'SELECT hour_start, peak_count FROM online_hourly_stats WHERE hour_start >= ? AND hour_start <= ? ORDER BY hour_start'
    ).bind(statsStart.toISOString(), statsEnd.toISOString()).all();
    const onlineStatMap = new Map(onlineStats.results.map((row: any) => [row.hour_start, Number(row.peak_count)]));
    const onlineStatsFeatureStart = new Date('2026-09-10T00:00:00.000Z');
    const onlineStatsPoints: Array<{ hour: string; value: number | null; legacy: boolean }> = [];
    for (let cursor = new Date(statsStart); cursor <= statsEnd; cursor.setUTCHours(cursor.getUTCHours() + 1)) {
        const hour = cursor.toISOString();
        const legacy = cursor < onlineStatsFeatureStart;
        onlineStatsPoints.push({
            hour,
            value: legacy ? null : (onlineStatMap.get(hour) ?? null),
            legacy,
        });
    }

    // 颜色名称映射
    const colorNames: Record<string, string> = {
        purple: t('colorPurple'),
        red: t('colorRed'),
        orange: t('colorOrange'),
        yellow: t('colorYellow'),
        green: t('colorGreen'),
        cyan: t('colorCyan'),
        blue: t('colorBlue'),
        rainbow: t('colorRainbow'),
        gray: t('colorGray'),
    };

    const content = `
    <style>
        .table-wrap { overflow-x: auto; }
        .admin-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
            background: #fff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }
        .admin-table th {
            background: #f8f6fa;
            color: #4a3f5e;
            font-weight: 600;
            padding: 10px 12px;
            text-align: left;
            border-bottom: 2px solid #e8e3ed;
        }
        .admin-table td {
            padding: 10px 12px;
            border-bottom: 1px solid #f0edf3;
            vertical-align: middle;
        }
        .admin-table tr:last-child td { border-bottom: none; }
        .admin-table tr:hover td { background: #faf8fc; }

        .user-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
            align-items: center;
        }
        .user-actions select, .user-actions input {
            font-size: 12px;
            padding: 4px 6px;
            border-radius: 4px;
            border: 1px solid #ddd;
            background: #fff;
            transition: 0.15s;
        }
        .user-actions select:focus, .user-actions input:focus {
            border-color: #8E44AD;
            outline: none;
            box-shadow: 0 0 0 2px rgba(142,68,173,0.15);
        }
        .field-group {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
            align-items: center;
        }
        .field-group.hidden { display: none; }

        .btn-sm {
            padding: 4px 12px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 500;
            font-size: 13px;
            transition: 0.15s;
            color: #fff;
        }
        .btn-sm:hover { opacity: 0.85; }
        .btn-primary { background: #8E44AD; color: #fff; }
        .btn-danger { background: #e74c3c; color: #fff; }
        .btn-success { background: #27ae60; color: #fff; }
        .btn-warning { background: #f39c12; color: #fff; }
        .btn-outline {
            background: transparent;
            color: #555;
            border: 1px solid #ddd;
        }

        .card {
            background: #fff;
            border-radius: 8px;
            padding: 16px 20px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.06);
            margin-bottom: 16px;
        }
        .card:last-child { margin-bottom: 0; }
        .section-title {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .section-title i { color: #8E44AD; }

        .article-item, .ticket-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 6px 0;
            border-bottom: 1px solid #f0edf3;
            flex-wrap: wrap;
            gap: 6px;
        }
        .article-item:last-child, .ticket-item:last-child { border-bottom: none; }
        .article-item .title, .ticket-item .title {
            font-size: 14px;
            color: #333;
        }
        .article-item .meta, .ticket-item .meta {
            color: #999;
            font-size: 12px;
        }
        .action-group {
            display: flex;
            gap: 4px;
            flex-wrap: wrap;
        }

        .banner-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 10px 0;
            border-bottom: 1px solid #f0edf3;
        }
        .banner-item:last-child { border-bottom: none; }
        .banner-thumb {
            width: 80px;
            height: 45px;
            object-fit: cover;
            border-radius: 4px;
            background: #eee;
            flex-shrink: 0;
        }
        .banner-info {
            flex: 1;
            min-width: 0;
            font-size: 13px;
        }
        .banner-info .url { word-break: break-all; color: #333; }
        .banner-info .meta { color: #999; font-size: 12px; margin-top: 2px; }

        .add-banner-form {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            background: #f8f6fa;
            padding: 14px 16px;
            border-radius: 8px;
            margin-bottom: 16px;
            align-items: center;
        }
        .add-banner-form input {
            flex: 1;
            min-width: 150px;
            padding: 6px 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 13px;
        }
        .add-banner-form input:focus {
            border-color: #8E44AD;
            outline: none;
        }
        .add-banner-form button {
            background: #8E44AD;
            color: #fff;
            border: none;
            padding: 6px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            white-space: nowrap;
        }
        .add-banner-form button:hover { background: #7d3c98; }
        .online-chart-toolbar { display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap; }
        .online-chart-buttons { display:flex; gap:4px; }
        .online-chart-buttons button { padding:5px 10px; border:1px solid #ddd; border-radius:4px; background:#fff; color:#666; cursor:pointer; font-size:12px; }
        .online-chart-buttons button.active { background:#8E44AD; border-color:#8E44AD; color:#fff; }
        .online-chart-wrap { width:100%; overflow-x:auto; }
        #onlineStatsCanvas { display:block; width:100%; min-width:680px; height:260px; }
        .online-chart-dates { display:flex; justify-content:space-between; gap:8px; min-width:680px; color:#777; font-size:11px; }
        .online-chart-dates .legacy { color:#e74c3c; }
        .online-chart-note { margin-top:8px; color:#999; font-size:12px; }
    </style>

    <div class="page-header"><h1><i class="fas fa-cog"></i> ${t('adminPanel')}</h1></div>

    <div class="card">
        <div class="online-chart-toolbar">
            <div class="section-title" style="margin-bottom:0;"><i class="fas fa-chart-line"></i> 在线人数小时峰值</div>
            <div class="online-chart-buttons">
                <button type="button" class="active" data-range="1">最近24小时</button>
                <button type="button" data-range="30">最近1个月</button>
            </div>
        </div>
        <div class="online-chart-wrap">
            <canvas id="onlineStatsCanvas" height="260"></canvas>
            <div id="onlineStatsDates" class="online-chart-dates"></div>
        </div>
        <div class="online-chart-note"><span style="color:#e74c3c;">红色 NaN</span>：功能上线前没有历史数据；空白点表示该小时尚未采集到数据。</div>
    </div>

    <div class="card">
        <div class="section-title"><i class="fas fa-users"></i> ${t('userManagement')}</div>
        <div class="table-wrap">
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>${t('username')}</th>
                        <th>${t('userPermissions')}</th>
                        <th>${t('userColor')}</th>
                        <th>${t('userTag')}</th>
                        <th>${t('violationCount')}</th>
                        <th>${t('recentLogin')}</th>
                        <th>${t('execute')}</th>
                    </tr>
                </thead>
                <tbody>
                    ${users.results.map((u: any) => `
                        <tr>
                            <td>${u.id}</td>
                            <td>${renderUsernameLink(u.username, u.color, u.tag, u.id)}</td>
                            <td style="font-size:12px;">${t('userStats', { use: u.use, speak: u.speak, admin: u.admin })}</td>
                            <td>
                                <span style="display:inline-block;width:12px;height:12px;border-radius:2px;background:${getUserColor(u.color)};vertical-align:middle;margin-right:4px;"></span>
                                ${colorNames[u.color] || u.color}
                            </td>
                            <td>${u.tag || t('noTag')}</td>
                            <td><span style="color:${u.violation_count > 0 ? '#e74c3c' : '#999'};font-weight:600;">${u.violation_count || 0}</span></td>
                            <td style="font-size:12px;color:#666;line-height:1.5;">
                                ${u.last_ip ? `<div><i class="fas fa-network-wired" style="color:#8E44AD;"></i> ${htmlEscape(u.last_ip)}</div>` : `<div style="color:#bbb;">${t('noRecord')}</div>`}
                                ${u.last_login_at ? `<div style="color:#999;">${formatTimeToChina(u.last_login_at)}</div>` : ''}
                            </td>
                            <td>
                                <form action="/api/admin/user/${u.id}" method="POST" class="user-actions">
                                    <select name="mode" onchange="toggleFields(this)" style="width:auto;">
                                        <option value="profile" selected>${t('changeProfile')}</option>
                                        <option value="permission">${t('changePermission')}</option>
                                    </select>

                                    <span class="field-group profile-fields">
                                        <select name="color" style="width:auto;">
                                            <option value="purple" ${u.color === 'purple' ? 'selected' : ''}>${t('colorPurple')}</option>
                                            <option value="red" ${u.color === 'red' ? 'selected' : ''}>${t('colorRed')}</option>
                                            <option value="orange" ${u.color === 'orange' ? 'selected' : ''}>${t('colorOrange')}</option>
                                            <option value="yellow" ${u.color === 'yellow' ? 'selected' : ''}>${t('colorYellow')}</option>
                                            <option value="green" ${u.color === 'green' ? 'selected' : ''}>${t('colorGreen')}</option>
                                            <option value="cyan" ${u.color === 'cyan' ? 'selected' : ''}>${t('colorCyan')}</option>
                                            <option value="blue" ${u.color === 'blue' ? 'selected' : ''}>${t('colorBlue')}</option>
                                            <option value="rainbow" ${u.color === 'rainbow' ? 'selected' : ''}>${t('colorRainbow')}</option>
                                            <option value="gray" ${u.color === 'gray' ? 'selected' : ''}>${t('colorGray')}</option>
                                        </select>
                                        <input type="text" name="tag" placeholder="${t('userTagPlaceholder')}" value="${u.tag || ''}" style="width:70px;">
                                    </span>

                                    <span class="field-group permission-fields hidden">
                                        <select name="permission" style="width:auto;">
                                            <option value="">${t('permissionSelect')}</option>
                                            <option value="use">${t('permissionUse')}</option>
                                            <option value="speak">${t('permissionSpeak')}</option>
                                            <option value="admin">${t('permissionAdmin')}</option>
                                        </select>
                                        <select name="action" style="width:auto;">
                                            <option value="">${t('actionSelect')}</option>
                                            <option value="grant">${t('actionGrant')}</option>
                                            <option value="revoke">${t('actionRevoke')}</option>
                                        </select>
                                        <input type="text" name="reason" placeholder="${t('reasonPlaceholder')}" style="width:80px;">
                                    </span>

                                    <button type="submit" class="btn-sm btn-primary" style="font-size:13px; color:#fff;">${t('execute')}</button>
                                </form>

                                <button type="button" class="btn-sm btn-danger" style="font-size:13px; color:#fff; margin-top:4px;" onclick="confirmDelete(${u.id}, '${htmlEscape(u.username)}')">
                                    <i class="fas fa-trash-alt"></i> ${t('deleteUser')}
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    </div>

    <div class="card">
        <div class="section-title"><i class="fas fa-file-alt"></i> ${t('articleManagement')}</div>
        ${articles.results.map((a: any) => `
            <div class="article-item">
                <div>
                        <a class="title" href="/articles/${encodeURIComponent(a.hex_id)}">${htmlEscape(a.title)}</a>
                    <span class="meta">· ${formatTimeToChina(a.created_at)}</span>
                </div>
                <div class="action-group">
                    <form action="/api/admin/article/${a.id}/delete" method="POST" style="display:inline;">
                        <button type="submit" class="btn-sm btn-danger">${t('delete')}</button>
                    </form>
                    <form action="/api/admin/article/${a.id}/pin" method="POST" style="display:inline;">
                        <button type="submit" class="btn-sm ${a.is_pinned ? 'btn-outline' : 'btn-primary'}">${a.is_pinned ? t('unpin') : t('pin')}</button>
                    </form>
                    <form action="/api/admin/article/${a.id}/lock" method="POST" style="display:inline;">
                        <button type="submit" class="btn-sm ${a.is_locked ? 'btn-success' : 'btn-warning'}">${a.is_locked ? t('unlock') : t('lock')}</button>
                    </form>
                </div>
            </div>
        `).join('')}
        ${articles.results.length === 0 ? `<div style="color:#999;padding:12px 0;text-align:center;">${t('noArticles')}</div>` : ''}
    </div>

    <div class="card">
        <div class="section-title"><i class="fas fa-ticket-alt"></i> ${t('ticketManagement')}</div>
        ${tickets.results.map((ticket: any) => {
            const statusInfo = getTicketStatus(ticket.status);
            return `
                <div class="ticket-item">
                    <div>
                        <a class="title" href="/ticket/${ticket.id}">#${ticket.id} ${htmlEscape(ticket.title)}</a>
                        <span class="meta">
                            <i class="fas ${statusInfo.icon}"></i> ${statusInfo.label} · ${formatTimeToChina(ticket.created_at)}
                        </span>
                    </div>
                    <div class="action-group">
                        <form action="/api/admin/ticket/${ticket.id}/delete" method="POST" style="display:inline;">
                            <button type="submit" class="btn-sm btn-danger">${t('delete')}</button>
                        </form>
                    </div>
                </div>
            `;
        }).join('')}
        ${tickets.results.length === 0 ? `<div style="color:#999;padding:12px 0;text-align:center;">${t('noTickets')}</div>` : ''}
    </div>

    <div class="card">
        <div class="section-title"><i class="fas fa-images"></i> ${t('bannerManagement')}</div>
        <form action="/api/admin/banner/add" method="POST" class="add-banner-form">
            <input type="url" name="image_url" placeholder="${t('imageUrl')}" required>
            <input type="url" name="link_url" placeholder="${t('linkUrl')}">
            <input type="number" name="sort_order" placeholder="${t('sortOrder')}" value="0" style="width:80px;">
            <button type="submit"><i class="fas fa-plus"></i> ${t('addBanner')}</button>
        </form>
        ${banners.results.length === 0 ? `<div style="color:#999;padding:12px 0;text-align:center;">${t('noBanners')}</div>` : ''}
        ${banners.results.map((b: any) => `
            <div class="banner-item">
                <img src="${htmlEscape(b.image_url)}" class="banner-thumb" onerror="this.style.display='none'">
                <div class="banner-info">
                    <div class="url">${htmlEscape(b.image_url)}</div>
                    <div class="meta">
                        ${b.link_url ? `<i class="fas fa-link"></i> ${htmlEscape(b.link_url)}` : `<i class="fas fa-link-slash"></i> ${t('noLink')}`}
                        · ${t('sortOrder')}: ${b.sort_order}
                    </div>
                </div>
                <form action="/api/admin/banner/${b.id}/delete" method="POST">
                    <button type="submit" class="btn-sm btn-danger"><i class="fas fa-trash-alt"></i> ${t('delete')}</button>
                </form>
            </div>
        `).join('')}
    </div>

    <script>
        const onlineStatsData = ${JSON.stringify(onlineStatsPoints)};
        const onlineStatsCanvas = document.getElementById('onlineStatsCanvas');
        const onlineStatsDates = document.getElementById('onlineStatsDates');
        const onlineStatsContext = onlineStatsCanvas.getContext('2d');

        function drawOnlineStats(rangeDays) {
            const points = onlineStatsData.slice(rangeDays === 1 ? -24 : 0);
            const width = onlineStatsCanvas.clientWidth || 680;
            const height = 260;
            const ratio = window.devicePixelRatio || 1;
            onlineStatsCanvas.width = width * ratio;
            onlineStatsCanvas.height = height * ratio;
            onlineStatsContext.setTransform(ratio, 0, 0, ratio, 0, 0);
            onlineStatsContext.clearRect(0, 0, width, height);

            const left = 36;
            const right = 12;
            const top = 16;
            const bottom = 32;
            const plotWidth = Math.max(1, width - left - right);
            const plotHeight = height - top - bottom;
            const values = points.map(point => point.value).filter(value => value !== null);
            const maxValue = Math.max(1, ...(values.length ? values : [1]));
            const x = index => left + (points.length <= 1 ? 0 : index * plotWidth / (points.length - 1));
            const y = value => top + plotHeight - (value / maxValue) * plotHeight;

            onlineStatsContext.font = '11px sans-serif';
            onlineStatsContext.textAlign = 'right';
            onlineStatsContext.strokeStyle = '#eee';
            onlineStatsContext.fillStyle = '#999';
            for (let tick = 0; tick <= 4; tick++) {
                const tickValue = Math.round(maxValue * tick / 4);
                const tickY = top + plotHeight - plotHeight * tick / 4;
                onlineStatsContext.beginPath();
                onlineStatsContext.moveTo(left, tickY);
                onlineStatsContext.lineTo(width - right, tickY);
                onlineStatsContext.stroke();
                onlineStatsContext.fillText(String(tickValue), left - 6, tickY + 4);
            }

            function drawSegment(predicate, color, dashed) {
                onlineStatsContext.beginPath();
                onlineStatsContext.strokeStyle = color;
                onlineStatsContext.lineWidth = 2;
                onlineStatsContext.setLineDash(dashed ? [5, 4] : []);
                let drawing = false;
                points.forEach((point, index) => {
                    if (!predicate(point)) { drawing = false; return; }
                    const pointY = point.legacy ? top + plotHeight : y(point.value);
                    if (!drawing) onlineStatsContext.moveTo(x(index), pointY);
                    else onlineStatsContext.lineTo(x(index), pointY);
                    drawing = true;
                });
                onlineStatsContext.stroke();
                onlineStatsContext.setLineDash([]);
            }

            drawSegment(point => point.legacy, '#e74c3c', true);
            drawSegment(point => !point.legacy && point.value !== null, '#8E44AD', false);
            points.forEach((point, index) => {
                if (point.value === null && !point.legacy) return;
                onlineStatsContext.beginPath();
                onlineStatsContext.fillStyle = point.legacy ? '#e74c3c' : '#8E44AD';
                onlineStatsContext.arc(x(index), point.legacy ? top + plotHeight : y(point.value), 3, 0, Math.PI * 2);
                onlineStatsContext.fill();
            });

            const dateGroups = [];
            points.forEach(point => {
                const date = new Date(point.hour).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit' });
                const last = dateGroups[dateGroups.length - 1];
                if (!last || last.date !== date) dateGroups.push({ date, legacy: point.legacy });
                else last.legacy = last.legacy && point.legacy;
            });
            onlineStatsDates.innerHTML = dateGroups.map(group => '<span class="' + (group.legacy ? 'legacy' : '') + '">' + group.date + (group.legacy ? ' NaN' : '') + '</span>').join('');
        }

        document.querySelectorAll('.online-chart-buttons button').forEach(button => {
            button.addEventListener('click', () => {
                document.querySelectorAll('.online-chart-buttons button').forEach(item => item.classList.remove('active'));
                button.classList.add('active');
                drawOnlineStats(Number(button.dataset.range));
            });
        });
        drawOnlineStats(1);
        window.addEventListener('resize', () => {
            const activeButton = document.querySelector('.online-chart-buttons button.active');
            drawOnlineStats(Number(activeButton?.dataset.range || 1));
        });

        function toggleFields(select) {
            const row = select.closest('tr');
            const profileGroup = row.querySelector('.profile-fields');
            const permissionGroup = row.querySelector('.permission-fields');
            if (select.value === 'profile') {
                profileGroup.classList.remove('hidden');
                permissionGroup.classList.add('hidden');
            } else {
                profileGroup.classList.add('hidden');
                permissionGroup.classList.remove('hidden');
            }
        }

        function confirmDelete(userId, username) {
            if (typeof Swal === 'undefined') {
                if (confirm('${t('confirmDeleteUser', { username: '' })}' + username + '？')) {
                    const form = document.createElement('form');
                    form.method = 'POST';
                    form.action = '/api/admin/user/' + userId + '/delete';
                    document.body.appendChild(form);
                    form.submit();
                }
                return;
            }

            let countdown = 10;
            let timer = null;

            Swal.fire({
                title: '${t('deleteUserConfirm')}',
                html: \`
                    <div style="text-align:left; font-size:15px; line-height:1.8;">
                        <p><strong>${t('username')}：</strong>\${username} (ID: \${userId})</p>
                        <p><strong>${t('warning')}：</strong>${t('deleteUserWarning')}</p>
                        <p style="margin-top:16px; font-weight:500;">${t('confirm')}？</p>
                        <p style="margin-top:8px; color:#999; font-size:14px;">
                            <span id="countdownDisplay">\${countdown}</span> ${t('waitingSeconds', { seconds: '' })}
                        </p>
                    </div>
                \`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: '${t('confirmDeleteButton')}',
                cancelButtonText: '${t('cancelDeleteButton')}',
                confirmButtonColor: '#e74c3c',
                cancelButtonColor: '#95a5a6',
                allowOutsideClick: false,
                allowEscapeKey: false,
                didOpen: () => {
                    const confirmBtn = Swal.getConfirmButton();
                    confirmBtn.disabled = true;
                    confirmBtn.innerHTML = '${t('loading')} ' + countdown + 's';

                    timer = setInterval(() => {
                        countdown--;
                        if (countdown <= 0) {
                            clearInterval(timer);
                            confirmBtn.disabled = false;
                            confirmBtn.innerHTML = '${t('confirmDeleteButton')}';
                            document.getElementById('countdownDisplay').innerText = '0';
                        } else {
                            confirmBtn.innerHTML = '${t('loading')} ' + countdown + 's';
                            document.getElementById('countdownDisplay').innerText = countdown;
                        }
                    }, 1000);
                },
                willClose: () => {
                    if (timer) clearInterval(timer);
                }
            }).then((result) => {
                if (result.isConfirmed) {
                    const form = document.createElement('form');
                    form.method = 'POST';
                    form.action = '/api/admin/user/' + userId + '/delete';
                    document.body.appendChild(form);
                    form.submit();
                }
            });
        }
    </script>
    `;

    return await getLayout(env, user, t('adminPanel'), content, '', req);
}