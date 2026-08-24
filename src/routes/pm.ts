import { getSessionUser } from '../utils/auth';
import { getLayout } from '../utils/layout';
import { renderUsernameLink, htmlEscape } from '../utils/html';
export async function renderPmIndex(env, req) {
    const user = await getSessionUser(env, req);
    if (!user) return '请先登录';
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
    if (!convHtml) convHtml = '<div style="color:#999;padding:20px 0;text-align:center;">暂无私信会话，在上方输入用户名开始聊天</div>';
    const content = `
    <div class="page-header"><h1><i class="fas fa-envelope"></i> 私信</h1>
    <p style="margin-top:4px;">与其他用户的私人聊天</p></div>
    <div class="card">
      <h3 style="margin-bottom:10px;font-size:15px;"><i class="fas fa-paper-plane" style="color:#8E44AD;"></i> 发起新对话</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px;">
        <input id="pm-target-input" placeholder="输入用户名或UID" style="flex:1;min-width:220px;padding:8px 12px;border:1px solid #ddd;border-radius:4px;font-size:14px;">
        <button onclick="openPmChat()" style="background:#8E44AD;color:#fff;border:none;border-radius:4px;padding:8px 18px;cursor:pointer;font-size:14px;">打开对话</button>
      </div>
      <h3 style="margin-bottom:8px;font-size:15px;"><i class="fas fa-comments" style="color:#8E44AD;"></i> 最近会话</h3>
      ${convHtml}
    </div>
    <script>
      async function openPmChat(){
        const val = document.getElementById('pm-target-input').value.trim();
        if(!val) { toast('请输入用户名或UID','warning'); return; }
        let targetUid = null;
        if(/^\\d+$/.test(val)){
          targetUid = parseInt(val);
        } else {
          try {
            const res = await fetch('/api/user/find?username=' + encodeURIComponent(val));
            const json = await res.json();
            if(!res.ok || !json.uid){ toast('找不到该用户','error'); return; }
            targetUid = json.uid;
          } catch(e){ toast('查询失败','error'); return; }
        }
        window.location.href = '/pm/' + targetUid;
      }
      document.getElementById('pm-target-input').addEventListener('keydown', function(e){
        if(e.key === 'Enter') openPmChat();
      });
    </script>
  `;
    return await getLayout(env, user, '私信', content);
}

export async function renderPmChat(env: Env, req: Request, path: string) {
    const user = await getSessionUser(env, req);
    if (!user) return '请先登录';
    const db = env.DB;
    const targetUid = parseInt(path.split('/')[2]);
    if (!targetUid) return '用户ID错误';
    if (targetUid === user.id) return '不能和自己聊天';
    const targetUser = await db.prepare('SELECT * FROM users WHERE id = ?').bind(targetUid).first();
    if (!targetUser) return '该用户不存在';

    // 标记已读
    await db.prepare(`UPDATE messages SET is_read = 1 WHERE type = 'pm_chat' AND from_user_id = ? AND to_user_id = ? AND is_read = 0`)
        .bind(targetUid, user.id).run();

    const content = `
    <div class="page-header">
      <h1><i class="fas fa-envelope"></i> 与 ${htmlEscape(targetUser.username)} 的对话</h1>
      <p style="margin-top:4px;">UID: ${targetUid} &nbsp;|&nbsp; <a href="/pm" style="color:#8E44AD;text-decoration:none;">← 返回私信列表</a> &nbsp;|&nbsp; <a href="/user/${targetUid}" style="color:#8E44AD;text-decoration:none;" target="_blank">查看主页</a></p>
    </div>
    <div class="card" style="padding:0;overflow:hidden;">
      <div id="pm-chat-box" style="height:460px;overflow-y:auto;padding:14px;background:#fafbfc;"></div>
      <div style="display:flex;gap:8px;padding:12px;border-top:1px solid #eee;background:#fff;">
        <textarea id="pm-textarea" placeholder="输入消息，按 Enter 发送，Shift+Enter 换行..." rows="2" style="flex:1;padding:8px 12px;border:1px solid #ddd;border-radius:6px;resize:none;font-size:14px;font-family:inherit;"></textarea>
        <button onclick="sendPmMessage()" style="background:#8E44AD;color:#fff;border:none;border-radius:6px;padding:0 20px;cursor:pointer;font-size:14px;font-weight:500;white-space:nowrap;"><i class="fas fa-paper-plane"></i> 发送</button>
      </div>
    </div>
    <script>
      const PM_TARGET_UID = ${targetUid};
      const PM_MY_UID = ${user.id};
      let pmLastId = 0;            // 当前已显示的最大消息ID
      let pmIsLoading = false;     // 防止并发请求
      let pmPolling = null;        // 定时器句柄
      const pmChatBox = document.getElementById('pm-chat-box');

      // 追加单条消息到聊天框
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
        bubble.textContent = m.content;
        wrap.appendChild(bubble);
        pmChatBox.appendChild(wrap);
      }

      // 加载新消息（轮询调用）
      async function loadPmMessages() {
        if (pmIsLoading) return; // 防止重复请求
        pmIsLoading = true;
        try {
          const res = await fetch('/api/pm/chat?to_uid=' + PM_TARGET_UID + '&after=' + pmLastId);
          const json = await res.json();
          if (json.messages && json.messages.length > 0) {
            // 只追加新消息（id > pmLastId）
            for (const m of json.messages) {
              if (m.id > pmLastId) {
                appendPmMessage(m);
                // 更新最大ID
                if (m.id > pmLastId) pmLastId = m.id;
              }
            }
            // 滚动到底部
            pmChatBox.scrollTop = pmChatBox.scrollHeight;
          }
          // 如果没有新消息，pmLastId 保持不变，但服务器返回的消息一定都 > 旧值，所以不会重复
        } catch (e) {
          console.warn('轮询失败', e);
        } finally {
          pmIsLoading = false;
        }
      }

      // 发送消息
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
          // 发送成功后立即拉取新消息（包括自己刚发的）
          await loadPmMessages();
        } catch (e) {
          toast('发送失败', 'error');
        }
      }

      // 键盘事件
      document.getElementById('pm-textarea').addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendPmMessage();
        }
      });

      // 初始加载
      loadPmMessages();

      // 启动轮询（每2秒）
      pmPolling = setInterval(loadPmMessages, 2000);

      // 页面不可见时停止轮询，节省资源
      document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
          if (pmPolling) {
            clearInterval(pmPolling);
            pmPolling = null;
          }
        } else {
          if (!pmPolling) {
            pmPolling = setInterval(loadPmMessages, 2000);
            // 回到页面时立即刷新一次
            loadPmMessages();
          }
        }
      });

      // 页面卸载时清除定时器
      window.addEventListener('beforeunload', function() {
        if (pmPolling) {
          clearInterval(pmPolling);
          pmPolling = null;
        }
      });
    </script>
  `;

    return await getLayout(env, user, '私信', content);
}