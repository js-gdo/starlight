import { getSessionUser } from '../utils/auth';
import { getLayout } from '../utils/layout';
import { renderUsernameLink, htmlEscape } from '../utils/html';
import { getTranslator } from '../utils/i18n';
import type { Env } from '../env.d';

export async function renderPmIndex(env: Env, req: Request) {
    const t = getTranslator(req);
    const user = await getSessionUser(env, req);
    if (!user) return t('loginRequired');

    const db = env.DB;
    const convRows = await db.prepare(`
        SELECT DISTINCT CASE WHEN from_user_id = ? THEN to_user_id ELSE from_user_id END AS other_uid
        FROM messages WHERE type = 'pm_chat' AND (from_user_id = ? OR to_user_id = ?)
    `).bind(user.id, user.id, user.id).all();

    let convHtml = '';
    for (const row of convRows.results) {
        const oUid = row.other_uid;
        if (!oUid) continue;
        const other = await db.prepare('SELECT * FROM users WHERE id = ?').bind(oUid).first();
        if (!other) continue;

        const lastMsg = await db.prepare(`
            SELECT * FROM messages WHERE type = 'pm_chat' AND
                ((from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?))
            ORDER BY id DESC LIMIT 1
        `).bind(user.id, oUid, oUid, user.id).first();

        const unread = await db.prepare(`
            SELECT COUNT(*) AS cnt FROM messages WHERE type = 'pm_chat' AND from_user_id = ? AND to_user_id = ? AND is_read = 0
        `).bind(oUid, user.id).first();
        const unreadCnt = unread ? unread.cnt : 0;

        convHtml += `
        <div onclick="location.href='/pm/${oUid}'" style="display:block;padding:10px;border-bottom:1px solid #f5f5f5;color:#333;border-radius:4px;cursor:pointer;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <div>${renderUsernameLink(other.username, other.color, other.tag, other.id)}</div>
                ${unreadCnt > 0 ? `<span style="background:#e74c3c;color:#fff;font-size:11px;border-radius:10px;padding:1px 8px;">${unreadCnt}</span>` : ''}
            </div>
            <div style="font-size:12px;color:#999;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${lastMsg ? htmlEscape(lastMsg.content) : ''}</div>
        </div>
        `;
    }

    if (!convHtml) {
        convHtml = `<div style="color:#999;padding:20px 0;text-align:center;">${t('noConversations')}</div>`;
    }

    const content = `
        <div class="page-header"><h1><i class="fas fa-envelope"></i> ${t('privateMessage')}</h1>
        <p style="margin-top:4px;">${t('newConversation')}</p></div>
        <div class="card">
            <h3 style="margin-bottom:10px;font-size:15px;"><i class="fas fa-paper-plane" style="color:#8E44AD;"></i> ${t('newConversation')}</h3>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px;">
                <input id="pm-target-input" placeholder="${t('enterUsernameOrUid')}" style="flex:1;min-width:220px;padding:8px 12px;border:1px solid #ddd;border-radius:4px;font-size:14px;">
                <button onclick="openPmChat()" style="background:#8E44AD;color:#fff;border:none;border-radius:4px;padding:8px 18px;cursor:pointer;font-size:14px;">${t('openChat')}</button>
            </div>
            <h3 style="margin-bottom:8px;font-size:15px;"><i class="fas fa-comments" style="color:#8E44AD;"></i> ${t('recentConversations')}</h3>
            ${convHtml}
        </div>
        <script>
            async function openPmChat() {
                const val = document.getElementById('pm-target-input').value.trim();
                if (!val) { toast('${t('enterUsernameOrUid')}', 'warning'); return; }
                let targetUid = null;
                if (/^\\d+$/.test(val)) {
                    targetUid = parseInt(val);
                } else {
                    try {
                        const res = await fetch('/api/user/find?username=' + encodeURIComponent(val));
                        const json = await res.json();
                        if (!res.ok || !json.uid) { toast('${t('userNotFoundByName')}', 'error'); return; }
                        targetUid = json.uid;
                    } catch (e) { toast('${t('networkError')}', 'error'); return; }
                }
                window.location.href = '/pm/' + targetUid;
            }
            document.getElementById('pm-target-input').addEventListener('keydown', function(e) {
                if (e.key === 'Enter') openPmChat();
            });
        </script>
    `;
    return await getLayout(env, user, t('privateMessage'), content, '', req);
}

export async function renderPmChat(env: Env, req: Request, path: string) {
    const t = getTranslator(req);
    const user = await getSessionUser(env, req);
    if (!user) return t('loginRequired');

    const db = env.DB;
    const targetUid = parseInt(path.split('/')[2]);
    if (!targetUid) return t('invalidUserId');
    if (targetUid === user.id) return t('cannotMessageSelf');

    const targetUser = await db.prepare('SELECT * FROM users WHERE id = ?').bind(targetUid).first();
    if (!targetUser) return t('userNotFound');

    await db.prepare(`UPDATE messages SET is_read = 1 WHERE type = 'pm_chat' AND from_user_id = ? AND to_user_id = ? AND is_read = 0`)
        .bind(targetUid, user.id).run();

    const content = `
        <div class="page-header">
            <h1><i class="fas fa-envelope"></i> ${t('chatWith', { username: targetUser.username })}</h1>
            <p style="margin-top:4px;">UID: ${targetUid} &nbsp;|&nbsp; <a href="/pm" style="color:#8E44AD;text-decoration:none;">${t('backToPmList')}</a> &nbsp;|&nbsp; <a href="/user/${targetUid}" style="color:#8E44AD;text-decoration:none;" target="_blank">${t('viewProfile')}</a></p>
        </div>
        <div class="card" style="padding:0;overflow:hidden;">
            <div id="pm-chat-box" style="height:460px;overflow-y:auto;padding:14px;background:#fafbfc;"></div>
            <div style="display:flex;gap:8px;padding:12px;border-top:1px solid #eee;background:#fff;">
                <textarea id="pm-textarea" placeholder="${t('typeMessage')}..." rows="2" style="flex:1;padding:8px 12px;border:1px solid #ddd;border-radius:6px;resize:none;font-size:14px;font-family:inherit;"></textarea>
                <button onclick="sendPmMessage()" style="background:#8E44AD;color:#fff;border:none;border-radius:6px;padding:0 20px;cursor:pointer;font-size:14px;font-weight:500;white-space:nowrap;"><i class="fas fa-paper-plane"></i> ${t('sendMessage')}</button>
            </div>
        </div>
        <script>
            const PM_TARGET_UID = ${targetUid};
            const PM_MY_UID = ${user.id};
            let pmLastId = 0;
            let pmIsLoading = false;
            let pmPolling = null;
            const pmChatBox = document.getElementById('pm-chat-box');

            function escapeHtml(text) {
                return String(text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            }

            function renderAtMentions(text) {
               const byId = (window.__mentionUsers && window.__mentionUsers.byId) || {};
               const byName = (window.__mentionUsers && window.__mentionUsers.byName) || {};
               return escapeHtml(text).replace(/(^|\s)@([A-Za-z0-9_]+)(?=\s|$)/g, function(match, prefix, token) {
                   const idInfo = byId[String(token)];
                   if (idInfo) {
                       return prefix + '<a href="/user/' + idInfo.uid + '" style="color:#8E44AD;font-weight:600;">' + escapeHtml(idInfo.username) + '</a>';
                   }
                   const nameInfo = byName[String(token).toLowerCase()];
                   if (nameInfo) {
                       return prefix + '<a href="/user/' + nameInfo.uid + '" style="color:#8E44AD;font-weight:600;">' + escapeHtml(nameInfo.username) + '</a>';
                   }
                   return prefix + '<span style="color:#8E44AD;font-weight:600;">@' + token + '</span>';
               });
            }

            function appendPmMessage(m) {
                const isMe = m.from_user_id === PM_MY_UID;
                const wrap = document.createElement('div');
                wrap.style.display = 'flex';
                wrap.style.justifyContent = isMe ? 'flex-end' : 'flex-start';
                wrap.style.margin = '6px 0';
                const bubble = document.createElement('div');
                bubble.style.maxWidth = '70%';
                bubble.style.padding = '8px 14px';
                bubble.style.borderRadius = isMe ? '14px 14px 2px 14px' : '14px 14px 14px 2px';
                bubble.style.wordBreak = 'break-word';
                bubble.style.whiteSpace = 'pre-wrap';
                bubble.style.fontSize = '14px';
                bubble.style.lineHeight = '1.5';
                if (isMe) {
                    bubble.style.background = '#8E44AD';
                    bubble.style.color = '#fff';
                } else {
                    bubble.style.background = '#fff';
                    bubble.style.color = '#333';
                    bubble.style.border = '1px solid #e0e0e0';
                }
                bubble.innerHTML = renderAtMentions(m.content || '');
                wrap.appendChild(bubble);
                pmChatBox.appendChild(wrap);
            }

            async function loadPmMessages() {
                if (pmIsLoading) return;
                pmIsLoading = true;
                try {
                    const res = await fetch('/api/pm/chat?to_uid=' + PM_TARGET_UID + '&after=' + pmLastId);
                    const json = await res.json();
                    if (json.messages && json.messages.length > 0) {
                        for (const m of json.messages) {
                            if (m.id > pmLastId) {
                                appendPmMessage(m);
                                if (m.id > pmLastId) pmLastId = m.id;
                            }
                        }
                        pmChatBox.scrollTop = pmChatBox.scrollHeight;
                    }
                } catch (e) {
                    console.warn('${t('error')}', e);
                } finally {
                    pmIsLoading = false;
                }
            }

            async function sendPmMessage() {
                const ta = document.getElementById('pm-textarea');
                const text = ta.value.trim();
                if (!text) return;
                ta.value = '';
                try {
                    await fetch('/api/pm/send', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({to_uid: PM_TARGET_UID, content: text})
                    });
                    await loadPmMessages();
                } catch (e) {
                    toast('${t('messageFailed')}', 'error');
                }
            }

            document.getElementById('pm-textarea').addEventListener('keydown', function(e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendPmMessage();
                }
            });

            loadPmMessages();
            pmPolling = setInterval(loadPmMessages, 2000);

            document.addEventListener('visibilitychange', function() {
                if (document.hidden) {
                    if (pmPolling) {
                        clearInterval(pmPolling);
                        pmPolling = null;
                    }
                } else {
                    if (!pmPolling) {
                        pmPolling = setInterval(loadPmMessages, 2000);
                        loadPmMessages();
                    }
                }
            });

            window.addEventListener('beforeunload', function() {
                if (pmPolling) {
                    clearInterval(pmPolling);
                    pmPolling = null;
                }
            });
        </script>
    `;
    return await getLayout(env, user, t('privateMessage'), content, '', req);
}