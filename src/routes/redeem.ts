import { getSessionUser } from '../utils/auth';
import { getLayout } from '../utils/layout';
import type { Env } from '../env.d';

export async function renderRedeem(env: Env, req: Request) {
    const user = await getSessionUser(env, req);
    const content = `
      <div class="page-header"><h1><i class="fas fa-ticket"></i> 积分兑换码</h1><p style="margin-top:4px;">兑换码由服务器发布，每个账号只能使用同一兑换码一次。</p></div>
      <div class="card" style="max-width:560px;">
        <form id="redeemForm" style="display:flex;gap:8px;flex-wrap:wrap;">
          <input name="code" maxlength="64" required placeholder="输入兑换码" style="flex:1;min-width:220px;padding:10px;border:1px solid #ddd;border-radius:6px;text-transform:uppercase;">
          <button style="background:#8E44AD;color:#fff;border:0;border-radius:6px;padding:0 18px;cursor:pointer;">立即兑换</button>
        </form>
        <p id="redeemStatus" style="margin-top:12px;color:#777;"></p>
      </div>
      <script>
        document.getElementById('redeemForm').addEventListener('submit', async function(event) {
          event.preventDefault();
          var status = document.getElementById('redeemStatus');
          var response = await fetch('/api/redeem', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({code:event.target.code.value}) });
          var data = await response.json();
          status.textContent = response.ok ? ('兑换成功：+' + data.points + ' 积分，+' + data.server_coin + ' Server 币') : (data.error || '兑换失败');
          status.style.color = response.ok ? '#27ae60' : '#e74c3c';
        });
      </script>`;
    return getLayout(env, user, '积分兑换码', content, '', req);
}
