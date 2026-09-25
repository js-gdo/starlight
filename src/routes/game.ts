import { getSessionUser } from '../utils/auth';
import { getLayout } from '../utils/layout';
import type { Env } from '../env.d';

export async function renderGame(env: Env, req: Request) {
    const user = await getSessionUser(env, req);
    const content = `
      <div class="page-header"><h1><i class="fas fa-paw"></i> 星光牧场</h1><p style="margin-top:4px;">照顾你的星光伙伴，每天训练和探索，逐步成长。</p></div>
      <div class="card" style="max-width:640px;">
        <div id="petState">加载中...</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px;">
          <button data-action="feed">喂养</button><button data-action="train">训练</button><button data-action="explore">探索</button>
        </div><p id="gameMessage" style="color:#777;"></p>
      </div>
      <script>
        var state = document.getElementById('petState'), message = document.getElementById('gameMessage');
        function draw(pet) { state.innerHTML = '<h2 style="font-size:20px;">' + pet.name + ' Lv.' + pet.level + '</h2><p>经验：' + pet.experience + ' / ' + (pet.level * 100) + '</p><p>精力：' + pet.energy + ' / 100</p>'; }
        async function load() { var response = await fetch('/api/game/state'); var data = await response.json(); if (response.ok) draw(data.pet); else state.textContent = data.error || '加载失败'; }
        document.querySelectorAll('[data-action]').forEach(function(button) { button.addEventListener('click', async function() { var response = await fetch('/api/game/' + button.dataset.action, {method:'POST'}); var data = await response.json(); message.textContent = response.ok ? ('完成成功！' + (data.reward ? '获得 ' + data.reward + ' 积分。' : '')) : (data.error || '操作失败'); if (data.pet) draw(data.pet); }); });
        load();
      </script>
      <style>[data-action]{border:0;border-radius:6px;padding:10px 18px;background:#8E44AD;color:#fff;cursor:pointer}</style>`;
    return getLayout(env, user, '星光牧场', content, '', req);
}
