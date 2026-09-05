import { getSessionUser } from '../utils/auth';
import { getLayout } from '../utils/layout';
import { getTranslator } from '../utils/i18n';
import type { Env } from '../env.d';

export async function renderClipboard(env: Env, req: Request) {
    const t = getTranslator(req);
    const user = await getSessionUser(env, req);

    const content = `
        <div class="page-header">
            <h1><i class="fas fa-clipboard"></i> ${t('clipboard')}</h1>
            <p style="margin-top:4px;">${t('clipboardDesc')}</p>
        </div>
        <div class="card">
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:14px;">
                <div style="display:flex;gap:6px;align-items:center;flex:1;min-width:240px;">
                    <label style="font-size:13px;color:#666;white-space:nowrap;">${t('keyLabel')}:</label>
                    <input type="text" id="clipKey" placeholder="${t('keyPlaceholder')}" maxlength="5"
                        style="flex:1;padding:6px 10px;border:1px solid #ddd;border-radius:4px;font-size:14px;font-family:monospace;text-transform:lowercase;letter-spacing:2px;">
                    <button onclick="clipNew()" style="background:#3498db;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:13px;" title="${t('generateKey')}"><i class="fas fa-magic"></i></button>
                    <button onclick="clipLoad()" style="background:#2ecc71;color:#fff;border:none;padding:6px 14px;border-radius:4px;cursor:pointer;font-size:13px;"><i class="fas fa-download"></i> ${t('load')}</button>
                </div>
                <div style="display:flex;gap:6px;align-items:center;">
                    <button onclick="clipSave()" style="background:#8E44AD;color:#fff;border:none;padding:6px 16px;border-radius:4px;cursor:pointer;font-size:13px;font-weight:500;"><i class="fas fa-save"></i> ${t('saveClip')}</button>
                    <button onclick="clipDelete()" style="background:#e74c3c;color:#fff;border:none;padding:6px 14px;border-radius:4px;cursor:pointer;font-size:13px;"><i class="fas fa-trash-alt"></i> ${t('deleteClip')}</button>
                    <button onclick="clipShare()" style="background:#f39c12;color:#fff;border:none;padding:6px 14px;border-radius:4px;cursor:pointer;font-size:13px;"><i class="fas fa-share-alt"></i> ${t('shareClip')}</button>
                </div>
            </div>
            <div id="clipStatus" style="font-size:13px;margin-bottom:10px;min-height:18px;"></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <div>
                    <div style="font-size:12px;color:#999;margin-bottom:4px;"><i class="fas fa-edit"></i> ${t('markdownEditor')}</div>
                    <textarea id="clipEditor" placeholder="${t('markdownEditor')}" rows="20"
                        style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;resize:vertical;font-size:13px;font-family:'SF Mono',Monaco,'Courier New',monospace;line-height:1.6;"></textarea>
                </div>
                <div>
                    <div style="font-size:12px;color:#999;margin-bottom:4px;"><i class="fas fa-eye"></i> ${t('markdownPreview')}</div>
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
                        if (typeof typesetMath === 'function') typesetMath(clipPreview);
                    } else {
                        clipPreview.innerHTML = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\\n/g,'<br>');
                    }
                } catch(e) { clipPreview.textContent = text; }
            }
            clipEditor.addEventListener('input', clipRenderPreview);

            function clipValidKey(k) { return /^[a-z]{5}$/.test(k); }

            async function clipNew() {
                try {
                    clipSetStatus('${t('loading')}');
                    var res = await fetch(CLIP_API + '/new');
                    var data = await res.json();
                    if (data.ok && data.key) {
                        clipKeyInput.value = data.key;
                        clipEditor.value = '';
                        clipRenderPreview();
                        clipSetStatus('${t('generateKey')}: ' + data.key + '，${t('clipSaved')}', 'success');
                        history.replaceState(null, '', '/clipboard?k=' + data.key);
                    } else {
                        clipSetStatus('${t('error')}: ' + (data.msg || '${t('unknown')}'), 'error');
                    }
                } catch(e) { clipSetStatus('${t('networkError')}: ' + e.message, 'error'); }
            }

            async function clipLoad() {
                var key = clipKeyInput.value.trim().toLowerCase();
                if (!clipValidKey(key)) { clipSetStatus('${t('keyInvalid')}', 'error'); return; }
                try {
                    clipSetStatus('${t('loading')}');
                    var res = await fetch(CLIP_API + '/api/' + key);
                    if (res.status === 404) { clipSetStatus('${t('clipboardNotFound')}', 'error'); return; }
                    if (!res.ok) { clipSetStatus('${t('error')} (' + res.status + ')', 'error'); return; }
                    var text = await res.text();
                    clipEditor.value = text;
                    clipRenderPreview();
                    clipSetStatus('${t('clipLoaded')}', 'success');
                    history.replaceState(null, '', '/clipboard?k=' + key);
                } catch(e) { clipSetStatus('${t('networkError')}: ' + e.message, 'error'); }
            }

            async function clipSave() {
                var key = clipKeyInput.value.trim().toLowerCase();
                if (!clipValidKey(key)) { clipSetStatus('${t('keyInvalid')}', 'error'); return; }
                var content = clipEditor.value;
                try {
                    clipSetStatus('${t('loading')}');
                    var res = await fetch(CLIP_API + '/api/' + key, { method: 'POST', body: content });
                    var data = await res.json();
                    if (data.ok) {
                        clipSetStatus('${t('clipSaved')}', 'success');
                        history.replaceState(null, '', '/clipboard?k=' + key);
                    } else {
                        clipSetStatus('${t('error')}: ' + (data.msg || '${t('unknown')}'), 'error');
                    }
                } catch(e) { clipSetStatus('${t('networkError')}: ' + e.message, 'error'); }
            }

            async function clipDelete() {
                var key = clipKeyInput.value.trim().toLowerCase();
                if (!clipValidKey(key)) { clipSetStatus('${t('keyInvalid')}', 'error'); return; }
                if (!confirm('${t('deleteClip')} ' + key + '？${t('confirm')}')) return;
                try {
                    clipSetStatus('${t('loading')}');
                    var res = await fetch(CLIP_API + '/api/' + key, { method: 'DELETE' });
                    var data = await res.json();
                    if (data.ok) {
                        clipSetStatus('${t('clipDeleted')}', 'success');
                        clipEditor.value = '';
                        clipRenderPreview();
                    } else {
                        clipSetStatus('${t('error')}: ' + (data.msg || '${t('unknown')}'), 'error');
                    }
                } catch(e) { clipSetStatus('${t('networkError')}: ' + e.message, 'error'); }
            }

            function clipShare() {
                var key = clipKeyInput.value.trim().toLowerCase();
                if (!clipValidKey(key)) { clipSetStatus('${t('keyInvalid')}', 'error'); return; }
                var url = location.origin + '/clipboard?k=' + key;
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(url).then(function() {
                        clipSetStatus('${t('clipShareCopied')}: ' + url, 'success');
                    }).catch(function() { prompt('${t('copyFailed')}:', url); });
                } else {
                    prompt('${t('copyFailed')}:', url);
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
    return await getLayout(env, user, t('clipboard'), content, '', req);
}