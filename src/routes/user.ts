import { getSessionUser } from '../utils/auth';
import { getLayout } from '../utils/layout';
import { renderAvatar, renderUsernameLink, htmlEscape } from '../utils/html';
import { getUserTagStyle } from '../utils/constants';
import { getTranslator } from '../utils/i18n';
import { ADMIN_ROLE_LABELS, parseAdminRoles } from '../utils/adminRoles';
import { getAchievementBadges } from '../utils/achievements';
import { formatTimeToChina } from '../utils/time';
import type { Env } from '../env.d';

function getLoginDeviceLabel(userAgent: string): string {
    const browser = /Edg\//.test(userAgent) ? 'Edge'
        : /Firefox\//.test(userAgent) ? 'Firefox'
        : /Chrome\//.test(userAgent) ? 'Chrome'
        : /Safari\//.test(userAgent) && !/Chrome\//.test(userAgent) ? 'Safari'
        : '未知浏览器';
    const platform = /Windows/i.test(userAgent) ? 'Windows'
        : /Android/i.test(userAgent) ? 'Android'
        : /iPhone|iPad|iPod/i.test(userAgent) ? 'iOS'
        : /Mac OS/i.test(userAgent) ? 'macOS'
        : /Linux/i.test(userAgent) ? 'Linux'
        : '未知设备';
    return `${browser} · ${platform}`;
}

export async function renderUser(env: Env, req: Request, path: string) {
    const t = getTranslator(req);
    const uid = parseInt(path.split('/')[2]);
    if (!uid) return t('invalidUserId');

    const db = env.DB;
    const user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(uid).first<any>();
    if (!user) return t('userNotFound');
    if (!user.use) return t('userDisabled');

    const currentUser = await getSessionUser(env, req);

    const followers = await db.prepare('SELECT u.* FROM follows f JOIN users u ON f.follower_id = u.id WHERE f.followee_id = ?').bind(uid).all<any>();
    const followees = await db.prepare('SELECT u.* FROM follows f JOIN users u ON f.followee_id = u.id WHERE f.follower_id = ?').bind(uid).all<any>();
    const isFollowing = currentUser ? await db.prepare('SELECT * FROM follows WHERE follower_id = ? AND followee_id = ?').bind(currentUser.id, uid).first() : null;
    const achievementBadges = await getAchievementBadges(db, uid);

    const content = `
        <div class="page-header" style="display:flex;align-items:center;gap:10px;"><h1 style="display:flex;align-items:center;gap:10px;">${renderAvatar(user, 48)} ${renderUsernameLink(user.username, user.color, '', user.id)}${achievementBadges}</h1></div>
        <div style="display:grid;gap:16px;">
            <div class="card">
                ${user.tag ? `<span style="${getUserTagStyle(user.color)};padding:0 12px;font-size:13px;">${htmlEscape(user.tag)}</span>` : ''}
                <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:12px;">
                    ${user.real_name ? `<span style="font-size:14px;color:#444;"><i class="fas fa-user"></i> ${htmlEscape(user.real_name)}</span>` : ''}
                    ${user.location ? `<span style="font-size:14px;color:#666;"><i class="fas fa-map-marker-alt"></i> ${htmlEscape(user.location)}</span>` : ''}
                    ${user.profile_link ? `<a href="${htmlEscape(user.profile_link)}" target="_blank" rel="noopener noreferrer" style="font-size:14px;color:#8E44AD;text-decoration:none;"><i class="fas fa-link"></i> 主页</a>` : ''}
                </div>
                <p style="margin-top:8px;font-size:14px;"><i class="fas fa-quote-left" style="color:#999;"></i> ${htmlEscape(user.bio || '')}</p>
                <p style="font-size:13px;color:#999;">UID: ${user.id} · ${user.admin ? t('roleAdmin') : t('roleUser')} · ${t('points')}: ${user.points || 0}</p>
                ${user.admin ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">${parseAdminRoles(user.admin_roles).map(role => `<span style="display:inline-block;padding:4px 8px;border-radius:999px;background:#f3e8ff;color:#6b21a8;font-size:12px;">${ADMIN_ROLE_LABELS[role]}</span>`).join('')}</div>` : ''}
                <p style="margin-top:10px;font-size:13px;color:#777;">成就：${achievementBadges || '暂无成就'} <a href="/achievements" style="color:#8E44AD;text-decoration:none;">查看全部</a></p>
                ${currentUser && currentUser.id == user.id ? `<a href="/settings" style="display:inline-block;margin-top:12px;color:#8E44AD;text-decoration:none;"><i class="fas fa-user-cog"></i> 用户设置</a>` : ''}
                ${currentUser && currentUser.id != user.id ? `
                    <div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap;">
                        <button onclick="follow(${user.id})" style="background:#8E44AD;color:#fff;padding:5px 14px;border:none;border-radius:4px;cursor:pointer;">${isFollowing ? t('unfollow') : t('follow')}</button>
                        <button onclick="reportUser(${user.id})" style="background:#fff;color:#c0392b;padding:5px 14px;border:1px solid #e6b0aa;border-radius:4px;cursor:pointer;"><i class="fas fa-flag"></i> 举报资料</button>
                    </div>
                ` : ''}
            </div>
            <div class="card">
                <h3 style="font-size:15px;font-weight:600;"><i class="fas fa-users"></i> ${t('followers')} (${followers.results.length})</h3>
                ${followers.results.map((f: any) => renderUsernameLink(f.username, f.color, f.tag, f.id)).join(' ') || t('noFollowers')}
            </div>
            <div class="card">
                <h3 style="font-size:15px;font-weight:600;"><i class="fas fa-user-friends"></i> ${t('following')} (${followees.results.length})</h3>
                ${followees.results.map((f: any) => renderUsernameLink(f.username, f.color, f.tag, f.id)).join(' ') || t('noFollowing')}
            </div>
        </div>
        <script>
            async function follow(uid) {
                const res = await fetch('/api/follow', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({followee_id: uid}) });
                const data = await res.json();
                toast(data.message);
                location.reload();
            }
            async function reportUser(uid) {
                const reason = prompt('举报原因：请输入具体违规说明（如违规内容、诈骗链接、恶意冒充等）', '');
                if (!reason || !reason.trim()) return;
                const evidence = prompt('补充证据（可选，如链接/截图说明，留空则不填）', '');
                const form = new FormData();
                form.set('target_type', 'avatar');
                form.set('target_id', String(uid));
                form.set('reason', reason.trim());
                form.set('evidence', evidence ? evidence.trim() : '');
                const response = await fetch('/api/reports', { method: 'POST', body: form });
                const data = await response.json();
                toast(data.error || '举报已提交', data.error ? 'error' : 'success');
            }
        </script>
    `;
    return await getLayout(env, currentUser, t('userProfile'), content, '', req);
}

export async function renderUserSettings(env: Env, req: Request) {
    const t = getTranslator(req);
    const user = await getSessionUser(env, req);
    if (!user) return t('apiNotLoggedIn');
    const loginHistory = await env.DB.prepare(
        'SELECT ip_address, user_agent, created_at FROM login_history WHERE user_id = ? ORDER BY id DESC LIMIT 10'
    ).bind(user.id).all<any>();

    const content = `
        <div class="page-header"><h1><i class="fas fa-user-cog"></i> 用户设置</h1></div>
        <div class="card" style="max-width:720px;">
            <h3 style="font-size:16px;margin-bottom:12px;">个人资料</h3>
            <form action="/api/user/bio" method="POST" style="display:flex;flex-direction:column;gap:10px;">
                <label>真实姓名 / 昵称<input type="text" name="real_name" value="${htmlEscape(String(user.real_name || ''))}" style="width:100%;margin-top:4px;padding:8px 10px;border:1px solid #ddd;border-radius:4px;"></label>
                <label>所在地<input type="text" name="location" value="${htmlEscape(String(user.location || ''))}" style="width:100%;margin-top:4px;padding:8px 10px;border:1px solid #ddd;border-radius:4px;"></label>
                <label>个人主页链接<input type="url" name="profile_link" value="${htmlEscape(String(user.profile_link || ''))}" style="width:100%;margin-top:4px;padding:8px 10px;border:1px solid #ddd;border-radius:4px;"></label>
                <label>个人签名<textarea name="bio" rows="4" maxlength="180" placeholder="${t('bioPlaceholder')}" style="width:100%;margin-top:4px;padding:8px 10px;border:1px solid #ddd;border-radius:4px;resize:vertical;">${htmlEscape(String(user.bio || ''))}</textarea></label>
                <label>头像 URL<input type="url" name="avatar_url" value="${htmlEscape(String(user.avatar_url || ''))}" placeholder="https://example.com/avatar.png" style="width:100%;margin-top:4px;padding:8px 10px;border:1px solid #ddd;border-radius:4px;"></label>
                <label>侧栏样式<select name="sidebar_mode" style="width:100%;margin-top:4px;padding:8px 10px;border:1px solid #ddd;border-radius:4px;">
                    <option value="classic" ${user.sidebar_mode !== 'hover' ? 'selected' : ''}>经典侧栏：固定显示</option>
                    <option value="hover" ${user.sidebar_mode === 'hover' ? 'selected' : ''}>悬停侧栏：鼠标移入展开</option>
                </select></label>
                <label>界面样式<select name="ui_mode" style="width:100%;margin-top:4px;padding:8px 10px;border:1px solid #ddd;border-radius:4px;">
                    <option value="classic" ${String(user.ui_mode || 'classic') !== 'modern' ? 'selected' : ''}>旧 UI：经典简洁</option>
                    <option value="modern" ${String(user.ui_mode || 'classic') === 'modern' ? 'selected' : ''}>新 UI：简约大气</option>
                </select></label>
                <label>页面布局<select name="layout_mode" style="width:100%;margin-top:4px;padding:8px 10px;border:1px solid #ddd;border-radius:4px;">
                    <option value="classic" ${String(user.layout_mode || 'classic') !== 'starlight' ? 'selected' : ''}>经典侧栏布局</option>
                    <option value="starlight" ${String(user.layout_mode || 'classic') === 'starlight' ? 'selected' : ''}>StarLight 新布局：顶部导航与信息栏</option>
                </select></label>
                <label>自定义背景图片 URL<input type="url" name="background_url" value="${htmlEscape(String(user.background_url || ''))}" maxlength="2048" placeholder="https://example.com/background.jpg" style="width:100%;margin-top:4px;padding:8px 10px;border:1px solid #ddd;border-radius:4px;"><small style="color:#888;display:block;margin-top:4px;">留空恢复默认背景。请使用可公开访问的 HTTP 或 HTTPS 图片链接。</small></label>
                <label>背景显示方式<select name="background_mode" style="width:100%;margin-top:4px;padding:8px 10px;border:1px solid #ddd;border-radius:4px;">
                    <option value="tile" ${String(user.background_mode || 'cover') === 'tile' ? 'selected' : ''}>平铺：原始尺寸重复</option>
                    <option value="cover" ${String(user.background_mode || 'cover') === 'cover' ? 'selected' : ''}>等比伸展：铺满并裁切多余部分</option>
                    <option value="stretch" ${String(user.background_mode || 'cover') === 'stretch' ? 'selected' : ''}>不等比延展：拉伸至整个窗口</option>
                </select></label>
                <div id="backgroundPreview" role="img" aria-label="背景图片预览" style="height:120px;display:grid;place-items:center;overflow:hidden;border:1px solid #ddd;border-radius:6px;background-color:#f4f3f7;background-image:linear-gradient(45deg,#e8e6ef 25%,transparent 25%),linear-gradient(-45deg,#e8e6ef 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e8e6ef 75%),linear-gradient(-45deg,transparent 75%,#e8e6ef 75%);background-size:20px 20px;background-position:0 0,0 10px,10px -10px,-10px 0;color:#777;font-size:12px;">背景预览</div>
                <label>操作结果返回时间<select name="redirect_delay_seconds" style="width:100%;margin-top:4px;padding:8px 10px;border:1px solid #ddd;border-radius:4px;">
                    <option value="5" ${Number(user.redirect_delay_seconds) === 5 || user.redirect_delay_seconds === null || user.redirect_delay_seconds === undefined ? 'selected' : ''}>5 秒</option>
                    <option value="10" ${Number(user.redirect_delay_seconds) === 10 ? 'selected' : ''}>10 秒</option>
                    <option value="15" ${Number(user.redirect_delay_seconds) === 15 ? 'selected' : ''}>15 秒</option>
                    <option value="30" ${Number(user.redirect_delay_seconds) === 30 ? 'selected' : ''}>30 秒</option>
                    <option value="60" ${Number(user.redirect_delay_seconds) === 60 ? 'selected' : ''}>60 秒</option>
                    <option value="0" ${Number(user.redirect_delay_seconds) === 0 && user.redirect_delay_seconds !== null && user.redirect_delay_seconds !== undefined ? 'selected' : ''}>不自动返回</option>
                </select><small style="color:#888;">状态页标题在 3 秒内点击三次，可临时暂停自动返回。</small></label>
                <button type="submit" style="background:#8E44AD;color:#fff;padding:8px 16px;border:none;border-radius:4px;cursor:pointer;align-self:flex-start;"><i class="fas fa-save"></i> ${t('updateBio')}</button>
            </form>
        </div>
        <div class="card" style="max-width:720px;margin-top:14px;">
            <h3 style="font-size:16px;margin-bottom:12px;">账号安全</h3>
            <div style="margin-bottom:18px;padding:12px;background:#f7f8fa;border-radius:6px;">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
                    <div><strong>登录设备</strong><div style="font-size:12px;color:#777;margin-top:4px;">最多保留最近 10 次登录。退出其他设备会保留当前设备。</div></div>
                    <button id="revokeOtherSessions" type="button" style="background:#fff;color:#b42318;padding:7px 12px;border:1px solid #f0b8b3;border-radius:4px;cursor:pointer;"><i class="fas fa-right-from-bracket"></i> 退出其他设备</button>
                </div>
                <div id="sessionStatus" role="status" style="font-size:13px;margin-top:8px;"></div>
                <div style="margin-top:10px;">
                    ${loginHistory.results.length ? loginHistory.results.map((record: any) => `
                        <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:9px 0;border-top:1px solid #e5e7eb;font-size:13px;">
                            <div><strong>${htmlEscape(getLoginDeviceLabel(String(record.user_agent || '')))}</strong><div style="color:#777;margin-top:3px;">IP：${htmlEscape(String(record.ip_address || '未知'))}</div></div>
                            <time style="color:#777;">${htmlEscape(formatTimeToChina(record.created_at))}</time>
                        </div>
                    `).join('') : '<div style="padding:10px 0;color:#777;font-size:13px;">暂无登录记录</div>'}
                </div>
            </div>
            <form id="passwordForm" style="display:flex;flex-direction:column;gap:10px;">
                <input name="current_password" type="password" autocomplete="current-password" placeholder="当前密码" required style="padding:8px 10px;border:1px solid #ddd;border-radius:4px;">
                <input name="new_password" type="password" autocomplete="new-password" minlength="6" maxlength="128" placeholder="新密码（至少 6 位）" required style="padding:8px 10px;border:1px solid #ddd;border-radius:4px;">
                <button type="submit" style="background:#8E44AD;color:#fff;padding:8px 16px;border:none;border-radius:4px;cursor:pointer;align-self:flex-start;">更新密码</button>
                <span id="passwordStatus" style="font-size:13px;"></span>
            </form>
        </div>
        <script>
            (function() {
                var form = document.querySelector('form[action="/api/user/bio"]');
                var input = form && form.querySelector('[name="background_url"]');
                var mode = form && form.querySelector('[name="background_mode"]');
                var preview = document.getElementById('backgroundPreview');
                if (!input || !mode || !preview) return;
                function updatePreview() {
                    try {
                        var url = new URL(input.value);
                        if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Invalid image URL');
                        preview.style.backgroundImage = 'url("' + url.href + '")';
                    } catch {
                        preview.style.backgroundImage = 'linear-gradient(135deg,#f2edf5,#e9eff5)';
                    }
                    preview.style.backgroundRepeat = mode.value === 'tile' ? 'repeat' : 'no-repeat';
                    preview.style.backgroundSize = mode.value === 'tile' ? 'auto' : mode.value === 'stretch' ? '100% 100%' : 'cover';
                    preview.textContent = input.value ? '' : '背景预览';
                }
                input.addEventListener('input', updatePreview);
                mode.addEventListener('change', updatePreview);
                updatePreview();
            })();
            document.getElementById('revokeOtherSessions').addEventListener('click', async function() {
                if (!confirm('退出其他设备的登录状态？当前设备会保持登录。')) return;
                const button = this;
                const status = document.getElementById('sessionStatus');
                button.disabled = true;
                try {
                    const response = await fetch('/api/user/sessions/revoke-others', { method: 'POST' });
                    const data = await response.json();
                    status.textContent = data.message || data.error || '操作完成';
                    status.style.color = response.ok ? '#16803c' : '#b42318';
                } catch {
                    status.textContent = '请求失败，请稍后重试';
                    status.style.color = '#b42318';
                } finally {
                    button.disabled = false;
                }
            });
            document.getElementById('passwordForm').addEventListener('submit', async function(event) {
                event.preventDefault();
                var status = document.getElementById('passwordStatus');
                var response = await fetch('/api/user/password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(event.target))) });
                var data = await response.json();
                status.textContent = data.message || data.error || '操作完成';
                status.style.color = response.ok ? '#27ae60' : '#e74c3c';
            });
        </script>
    `;
    return await getLayout(env, user, '用户设置', content, '', req);
}