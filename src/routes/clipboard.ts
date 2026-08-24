import { getSessionUser } from '../utils/auth';
import { getLayout } from '../utils/layout';
export async function renderClipboard(env, req) {
    const user = await getSessionUser(env, req);
    const content = `
    <div class="page-header">
      <h1><i class="fas fa-clipboard"></i> 云剪贴板</h1>
      <p style="margin-top:4px;">基于 Markdown 的在线剪贴板，5位密钥即可存取，支持分享链接</p>
    </div>
    <div class="card">
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:14px;">
        <div style="display:flex;gap:6px;align-items:center;flex:1;min-width:240px;">
          <label style="font-size:13px;color:#666;white-space:nowrap;">密钥:</label>
          <input type="text" id="clipKey" placeholder="5位小写字母" maxlength="5"
            style="flex:1;padding:6px 10px;border:1px solid #ddd;border-radius:4px;font-size:14px;font-family:monospace;text-transform:lowercase;letter-spacing:2px;">
          <button onclick="clipNew()" style="background:#3498db;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:13px;" title="生成新密钥"><i class="fas fa-magic"></i></button>
          <button onclick="clipLoad()" style="background:#2ecc71;color:#fff;border:none;padding:6px 14px;border-radius:4px;cursor:pointer;font-size:13px;"><i class="fas fa-download"></i> 读取</button>
        </div>
        <div style="display:flex;gap:6px;align-items:center;">
          <button onclick="clipSave()" style="background:#8E44AD;color:#fff;border:none;padding:6px 16px;border-radius:4px;cursor:pointer;font-size:13px;font-weight:500;"><i class="fas fa-save"></i> 保存</button>
          <button onclick="clipDelete()" style="background:#e74c3c;color:#fff;border:none;padding:6px 14px;border-radius:4px;cursor:pointer;font-size:13px;"><i class="fas fa-trash-alt"></i> 删除</button>
          <button onclick="clipShare()" style="background:#f39c12;color:#fff;border:none;padding:6px 14px;border-radius:4px;cursor:pointer;font-size:13px;"><i class="fas fa-share-alt"></i> 分享</button>
        </div>
      </div>
      <div id="clipStatus" style="font-size:13px;margin-bottom:10px;min-height:18px;"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div>
          <div style="font-size:12px;color:#999;margin-bottom:4px;"><i class="fas fa-edit"></i> Markdown 编辑</div>
          <textarea id="clipEditor" placeholder="在此输入 Markdown 内容..." rows="20"
            style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;resize:vertical;font-size:13px;font-family:'SF Mono',Monaco,'Courier New',monospace;line-height:1.6;"></textarea>
        </div>
        <div>
          <div style="font-size:12px;color:#999;margin-bottom:4px;"><i class="fas fa-eye"></i> 实时预览</div>
          <div id="clipPreview" class="markdown-body" style="padding:10px;border:1px solid #eee;border-radius:6px;min-height:400px;background:#fafbfc;"></div>
        </div>
      </div>
    </div>
    <script>
      const CLIP_API = 'https://api.slc.lj1.cc.cd';
      const clipEditor = document.getElementById('clipEditor');
      const clipPreview = document.getElementById('clipPreview');
      const clipKeyInput = document.getElementById('clipKey');
      const clipStatus = document.getElementById('clipStatus');

      function clipSetStatus(msg, type) {
        clipStatus.innerHTML = '<span style="color:' + (type === 'error' ? '#e74c3c' : type === 'success' ? '#2ecc71' : '#999') + ';">' + msg + '</span>';
        if (type) setTimeout(function(){ clipStatus.innerHTML = ''; }, 4000);
      }

      function clipRenderPreview() {
        var text = clipEditor.value;
        try {
          if (typeof marked !== 'undefined' && typeof marked.parse === 'function') {
            marked.setOptions({ breaks: true, gfm: true, sanitize: false, headerIds: false, mangle: false });
            clipPreview.innerHTML = marked.parse(text);
          } else {
            clipPreview.innerHTML = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\\n/g,'<br>');
          }
        } catch(e) { clipPreview.textContent = text; }
      }
      clipEditor.addEventListener('input', clipRenderPreview);

      function clipValidKey(k) { return /^[a-z]{5}$/.test(k); }

      async function clipNew() {
        try {
          clipSetStatus('生成中...');
          var res = await fetch(CLIP_API + '/new');
          var data = await res.json();
          if (data.ok && data.key) {
            clipKeyInput.value = data.key;
            clipEditor.value = '';
            clipRenderPreview();
            clipSetStatus('已生成新密钥: ' + data.key + '，编辑内容后点击保存', 'success');
            history.replaceState(null, '', '/clipboard?k=' + data.key);
          } else {
            clipSetStatus('生成失败: ' + (data.msg || '未知错误'), 'error');
          }
        } catch(e) { clipSetStatus('网络错误: ' + e.message, 'error'); }
      }

      async function clipLoad() {
        var key = clipKeyInput.value.trim().toLowerCase();
        if (!clipValidKey(key)) { clipSetStatus('密钥必须是5位小写字母', 'error'); return; }
        try {
          clipSetStatus('读取中...');
          var res = await fetch(CLIP_API + '/api/' + key);
          if (res.status === 404) { clipSetStatus('该密钥剪贴板不存在', 'error'); return; }
          if (!res.ok) { clipSetStatus('读取失败 (' + res.status + ')', 'error'); return; }
          var text = await res.text();
          clipEditor.value = text;
          clipRenderPreview();
          clipSetStatus('读取成功', 'success');
          history.replaceState(null, '', '/clipboard?k=' + key);
        } catch(e) { clipSetStatus('网络错误: ' + e.message, 'error'); }
      }

      async function clipSave() {
        var key = clipKeyInput.value.trim().toLowerCase();
        if (!clipValidKey(key)) { clipSetStatus('密钥必须是5位小写字母', 'error'); return; }
        var content = clipEditor.value;
        try {
          clipSetStatus('保存中...');
          var res = await fetch(CLIP_API + '/api/' + key, { method: 'POST', body: content });
          var data = await res.json();
          if (data.ok) {
            clipSetStatus('保存成功', 'success');
            history.replaceState(null, '', '/clipboard?k=' + key);
          } else {
            clipSetStatus('保存失败: ' + (data.msg || '未知错误'), 'error');
          }
        } catch(e) { clipSetStatus('网络错误: ' + e.message, 'error'); }
      }

      async function clipDelete() {
        var key = clipKeyInput.value.trim().toLowerCase();
        if (!clipValidKey(key)) { clipSetStatus('密钥必须是5位小写字母', 'error'); return; }
        if (!confirm('确定删除密钥 ' + key + ' 的剪贴板？此操作不可恢复！')) return;
        try {
          clipSetStatus('删除中...');
          var res = await fetch(CLIP_API + '/api/' + key, { method: 'DELETE' });
          var data = await res.json();
          if (data.ok) {
            clipSetStatus('已删除', 'success');
            clipEditor.value = '';
            clipRenderPreview();
          } else {
            clipSetStatus('删除失败: ' + (data.msg || '未知错误'), 'error');
          }
        } catch(e) { clipSetStatus('网络错误: ' + e.message, 'error'); }
      }

      function clipShare() {
        var key = clipKeyInput.value.trim().toLowerCase();
        if (!clipValidKey(key)) { clipSetStatus('密钥必须是5位小写字母', 'error'); return; }
        var url = location.origin + '/clipboard?k=' + key;
        if (navigator.clipboard) {
          navigator.clipboard.writeText(url).then(function() {
            clipSetStatus('分享链接已复制: ' + url, 'success');
          }).catch(function() { prompt('复制以下链接分享:', url); });
        } else {
          prompt('复制以下链接分享:', url);
        }
      }

      (function() {
        var params = new URLSearchParams(location.search);
        var k = params.get('k');
        if (k && clipValidKey(k)) {
          clipKeyInput.value = k;
          clipLoad();
        }
      })();
    </script>
  `;
    return await getLayout(env, user, '云剪贴板', content);
}