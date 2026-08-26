import { getSessionUser } from '../utils/auth';
import { getLayout } from '../utils/layout';
import { renderUsernameLink, htmlEscape } from '../utils/html';
import { getUserColor, getUserColorTextStyle } from '../utils/constants';
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
        <div class="page-header"><h1 style="${getUserColorTextStyle(user.color)}"><i class="fas fa-user-circle"></i> ${htmlEscape(user.username)}</h1></div>
        <div style="display:grid;gap:16px;">
            <div class="card">
                ${user.tag ? `<span style="background:${getUserColor(user.color)};color:#fff;padding:0 12px;border-radius:3px;display:inline-block;font-size:13px;">${htmlEscape(user.tag)}</span>` : ''}
                <p style="margin-top:8px;font-size:14px;"><i class="fas fa-quote-left" style="color:#999;"></i> ${htmlEscape(user.bio || '')}</p>
                <p style="font-size:13px;color:#999;">UID: ${user.id} · ${user.admin ? t('roleAdmin') : t('roleUser')} · ${t('points')}: ${user.points || 0} · ${t('violationCount')}: <span style="color:${user.violation_count > 0 ? '#e74c3c' : '#999'};font-weight:600;">${user.violation_count || 0}</span></p>
                ${currentUser && currentUser.id == user.id ? `
                    <div style="margin-top:10px;padding-top:10px;border-top:1px solid #f0f0f0;">
                        <h4 style="font-size:14px;margin-bottom:6px;"><i class="fas fa-pen"></i> ${t('bio')}</h4>
                        <form action="/api/user/bio" method="POST" style="display:flex;gap:6px;flex-wrap:wrap;">
                            <input type="text" name="bio" placeholder="${t('bioPlaceholder')}" value="${htmlEscape(user.bio || '')}" style="flex:1;min-width:180px;padding:6px 10px;border:1px solid #ddd;border-radius:4px;font-size:14px;">
                            <button type="submit" style="background:#8E44AD;color:#fff;padding:6px 16px;border:none;border-radius:4px;cursor:pointer;">${t('updateBio')}</button>
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