import { getSessionUser } from '../utils/auth';
import { getLayout } from '../utils/layout';
import { renderAvatar, renderUsernameLink, htmlEscape } from '../utils/html';
import { getUserTagStyle } from '../utils/constants';
import { getTranslator } from '../utils/i18n';
import type { Env } from '../env.d';

export async function renderUser(env: Env, req: Request, path: string) {
    const t = getTranslator(req);
    const uid = parseInt(path.split('/')[2]);
    if (!uid) return t('invalidUserId');

    const db = env.DB;
    const user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(uid).first();
    if (!user) return t('userNotFound');
    if (!user.use) return t('userDisabled');

    const currentUser = await getSessionUser(env, req);

    const followers = await db.prepare('SELECT u.* FROM follows f JOIN users u ON f.follower_id = u.id WHERE f.followee_id = ?').bind(uid).all();
    const followees = await db.prepare('SELECT u.* FROM follows f JOIN users u ON f.followee_id = u.id WHERE f.follower_id = ?').bind(uid).all();
    const isFollowing = currentUser ? await db.prepare('SELECT * FROM follows WHERE follower_id = ? AND followee_id = ?').bind(currentUser.id, uid).first() : null;

    const content = `
        <div class="page-header" style="display:flex;align-items:center;gap:10px;"><h1 style="display:flex;align-items:center;gap:10px;">${renderAvatar(user, 48)} ${renderUsernameLink(user.username, user.color, '', user.id)}</h1></div>
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
                ${currentUser && currentUser.id == user.id ? `
                    <div style="margin-top:10px;padding-top:10px;border-top:1px solid #f0f0f0;">
                        <h4 style="font-size:14px;margin-bottom:6px;"><i class="fas fa-pen"></i> ${t('bio')}</h4>
                        <form action="/api/user/bio" method="POST" style="display:flex;flex-direction:column;gap:8px;">
                            <input type="text" name="real_name" value="${htmlEscape(user.real_name || '')}" placeholder="真实姓名 / 昵称" style="padding:6px 10px;border:1px solid #ddd;border-radius:4px;font-size:14px;">
                            <input type="text" name="location" value="${htmlEscape(user.location || '')}" placeholder="所在地" style="padding:6px 10px;border:1px solid #ddd;border-radius:4px;font-size:14px;">
                            <input type="url" name="profile_link" value="${htmlEscape(user.profile_link || '')}" placeholder="个人主页链接" style="padding:6px 10px;border:1px solid #ddd;border-radius:4px;font-size:14px;">
                            <textarea name="bio" rows="3" placeholder="${t('bioPlaceholder')}" style="padding:8px 10px;border:1px solid #ddd;border-radius:4px;font-size:14px;resize:vertical;">${htmlEscape(user.bio || '')}</textarea>
                            <input type="url" name="avatar_url" placeholder="头像外链 URL" value="${htmlEscape(user.avatar_url || '')}" style="padding:6px 10px;border:1px solid #ddd;border-radius:4px;font-size:14px;">
                            <button type="submit" style="background:#8E44AD;color:#fff;padding:6px 16px;border:none;border-radius:4px;cursor:pointer;max-width:140px;">${t('updateBio')}</button>
                        </form>
                    </div>
                ` : ''}
                ${currentUser && currentUser.id != user.id ? `
                    <button onclick="follow(${user.id})" style="margin-top:10px;background:#8E44AD;color:#fff;padding:5px 14px;border:none;border-radius:4px;cursor:pointer;">${isFollowing ? t('unfollow') : t('follow')}</button>
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
        </script>
    `;
    return await getLayout(env, currentUser, t('userProfile'), content, '', req);
}