import { getSessionUser } from '../utils/auth';
import { getLayout } from '../utils/layout';
import { getTranslator } from '../utils/i18n';
import type { Env } from '../env.d';

const hardwareCatalog = [
    { name: 'AMD EPYC 9755', score: 162675, price: 65.0 },
    { name: 'AMD EPYC 9965', score: 160778, price: 64.4 },
    { name: 'AMD EPYC 9B45', score: 158843, price: 63.6 },
    { name: 'AMD EPYC 9655', score: 156001, price: 62.4 },
    { name: 'AMD EPYC 9655P', score: 155878, price: 62.4 },
    { name: 'AMD EPYC 9845', score: 152985, price: 61.2 },
    { name: 'Intel Xeon 6980P', score: 145000, price: 58.0 },
    { name: 'Intel Xeon 6781P', score: 117946, price: 35.4 },
    { name: 'Intel Platinum 8480+', score: 98200, price: 23.5 },
    { name: 'Intel Gold 6747P', score: 78100, price: 18.7 },
    { name: '16GB DDR4', score: 16, price: 1.0 },
    { name: '32GB DDR4', score: 32, price: 2.0 },
    { name: '64GB DDR4', score: 64, price: 4.0 },
    { name: '128GB DDR4', score: 128, price: 8.0 },
    { name: '256GB DDR5', score: 256, price: 16.0 },
    { name: '1TB HDD', score: 8000, price: 1.6 },
    { name: '1TB SATA SSD', score: 24000, price: 4.8 },
    { name: '2TB NVMe SSD', score: 50000, price: 12.0 },
    { name: 'X99 主板', score: 0, price: 2.0 },
];

export async function renderServer(env: Env, req: Request) {
    const t = getTranslator(req);
    const user = await getSessionUser(env, req);
    const db = env.DB;

    let userStats: any = null;
    if (user) {
        userStats = await db.prepare(
            `SELECT id, username, color, tag, points, server_coin, server_hardware_score, server_cpu, server_motherboard, server_ram, server_storage, avatar_url
             FROM users WHERE id = ?`
        ).bind(user.id).first<any>();
    }

    const [hardwareRankings, coinRankings] = await Promise.all([
        db.prepare(
            `SELECT id, username, color, tag, server_hardware_score, server_cpu, server_motherboard, server_ram, server_storage
             FROM users
             WHERE use = 1
             ORDER BY server_hardware_score DESC, server_coin DESC, id ASC
             LIMIT 10`
        ).all<any>(),
        db.prepare(
            `SELECT id, username, color, tag, server_coin, points
             FROM users
             WHERE use = 1
             ORDER BY server_coin DESC, points DESC, id ASC
             LIMIT 10`
        ).all<any>(),
    ]);

    const currentServerCoin = Number(userStats?.server_coin ?? user?.server_coin ?? 0);
    const currentPoints = Number(userStats?.points ?? user?.points ?? 0);
    const hardwareScore = Number(userStats?.server_hardware_score ?? user?.server_hardware_score ?? 0);

    const content = `
      <style>
        .server-layout { display: grid; gap: 16px; }
        .server-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
        .server-card { background: #fff; border-radius: 10px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
        .server-card h3 { font-size: 15px; margin-bottom: 10px; color: #333; }
        .server-stat { font-size: 28px; font-weight: 800; color: #8E44AD; }
        .server-sub { color: #777; font-size: 12px; margin-top: 4px; }
        .server-panel { display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 16px; }
        .server-rankings { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .rank-list { display: flex; flex-direction: column; gap: 8px; }
        .rank-item { display: grid; grid-template-columns: 24px 1fr auto; gap: 8px; align-items: center; padding: 8px 10px; border: 1px solid #f0e7f8; background: #faf7fc; border-radius: 8px; }
        .rank-badge { width: 24px; height: 24px; border-radius: 50%; background: linear-gradient(135deg, #8E44AD, #6c5ce7); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; }
        .exchange-form { display: grid; gap: 10px; }
        .exchange-form select, .exchange-form input, .exchange-form button { width: 100%; padding: 10px 12px; border-radius: 6px; border: 1px solid #ddd; font-size: 14px; }
        .exchange-form button { background: #8E44AD; color: #fff; border: none; cursor: pointer; font-weight: 600; }
        .server-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .server-table th, .server-table td { border-bottom: 1px solid #f0f0f0; padding: 8px 6px; text-align: left; }
        @media (max-width: 900px) { .server-grid, .server-panel, .server-rankings { grid-template-columns: 1fr; } }
      </style>

      <div class="page-header">
        <h1><i class="fas fa-server"></i> 服务器庄园</h1>
      </div>
      <div class="server-layout">
        <div class="server-grid">
          <div class="server-card">
            <h3>当前 Server 币</h3>
            <div class="server-stat">${currentServerCoin.toFixed(1)}</div>
            <div class="server-sub">兑换规则：12 Server 币 = 1 积分</div>
          </div>
          <div class="server-card">
            <h3>当前积分</h3>
            <div class="server-stat">${currentPoints}</div>
            <div class="server-sub">兑换规则：1 积分 = 10 Server 币</div>
          </div>
          <div class="server-card">
            <h3>服务器硬件分</h3>
            <div class="server-stat">${hardwareScore}</div>
            <div class="server-sub">按 CPU / 内存 / 存储 / 主板综合计算</div>
          </div>
          <div class="server-card">
            <h3>注册赠送</h3>
            <div class="server-sub">E5-2686 v4 · X99 主板 · 16GB DDR4 · 1TB HDD · 5 Server 币</div>
          </div>
        </div>

        <div class="server-panel">
          <div class="server-card">
            <h3><i class="fas fa-exchange-alt"></i> 货币兑换</h3>
            ${user ? `
              <form class="exchange-form" id="serverExchangeForm">
                <select id="exchangeDirection" name="direction">
                  <option value="coin_to_point">Server 币 → 积分（12:1）</option>
                  <option value="point_to_coin">积分 → Server 币（1:10）</option>
                </select>
                <input id="exchangeAmount" type="number" min="1" step="1" placeholder="请输入兑换数量" required>
                <button type="submit">提交兑换</button>
              </form>
              <div id="exchangeMessage" style="margin-top:10px;color:#666;font-size:13px;"></div>
            ` : `<div style="color:#666;font-size:14px;">登录后即可兑换 Server 币与积分。</div>`}
          </div>

          <div class="server-card">
            <h3><i class="fas fa-hdd"></i> 初始配置</h3>
            <div style="display:grid;gap:8px;font-size:13px;color:#555;">
              <div>CPU: ${userStats?.server_cpu || 'E5-2686 v4'}</div>
              <div>主板: ${userStats?.server_motherboard || 'X99 主板'}</div>
              <div>内存: ${userStats?.server_ram || '16GB DDR4'}</div>
              <div>存储: ${userStats?.server_storage || '1TB HDD'}</div>
            </div>
          </div>
        </div>

        <div class="server-rankings">
          <div class="server-card">
            <h3><i class="fas fa-medal"></i> 服务器硬件排名</h3>
            <div class="rank-list">
              ${(hardwareRankings.results || []).map((row: any, index: number) => `
                <div class="rank-item">
                  <div class="rank-badge">${index + 1}</div>
                  <div>
                    <div style="font-weight:700;">${row.username}</div>
                    <div style="font-size:11px;color:#666;">${row.server_cpu || 'E5-2686 v4'} · ${row.server_ram || '16GB DDR4'}</div>
                  </div>
                  <div style="font-weight:700;color:#8E44AD;">${Number(row.server_hardware_score || 0)}</div>
                </div>
              `).join('') || '<div style="color:#999;font-size:13px;">暂无数据</div>'}
            </div>
          </div>

          <div class="server-card">
            <h3><i class="fas fa-coins"></i> Server 币排名</h3>
            <div class="rank-list">
              ${(coinRankings.results || []).map((row: any, index: number) => `
                <div class="rank-item">
                  <div class="rank-badge">${index + 1}</div>
                  <div>
                    <div style="font-weight:700;">${row.username}</div>
                    <div style="font-size:11px;color:#666;">积分 ${Number(row.points || 0)}</div>
                  </div>
                  <div style="font-weight:700;color:#8E44AD;">${Number(row.server_coin || 0)}</div>
                </div>
              `).join('') || '<div style="color:#999;font-size:13px;">暂无数据</div>'}
            </div>
          </div>
        </div>

        <div class="server-card">
          <h3><i class="fas fa-list"></i> 硬件商店</h3>
          <table class="server-table">
            <thead>
              <tr>
                <th>硬件</th>
                <th>性能分</th>
                <th>售价</th>
              </tr>
            </thead>
            <tbody>
              ${hardwareCatalog.slice(0, 12).map((item: any) => `
                <tr>
                  <td>${item.name}</td>
                  <td>${item.score}</td>
                  <td>${item.price.toFixed(1)} Server 币</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <script>
        const form = document.getElementById('serverExchangeForm');
        if (form) {
          form.addEventListener('submit', async function (event) {
            event.preventDefault();
            const direction = document.getElementById('exchangeDirection').value;
            const amount = Number(document.getElementById('exchangeAmount').value || 0);
            const messageEl = document.getElementById('exchangeMessage');
            try {
              const response = await fetch('/api/server/exchange', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ direction, amount })
              });
              const data = await response.json();
              if (!response.ok) {
                messageEl.textContent = data.error || '兑换失败';
                messageEl.style.color = '#c0392b';
                return;
              }
              messageEl.textContent = data.message || '兑换成功';
              messageEl.style.color = '#27ae60';
              setTimeout(() => window.location.reload(), 700);
            } catch (error) {
              messageEl.textContent = '网络错误，请稍后再试';
              messageEl.style.color = '#c0392b';
            }
          });
        }
      </script>
    `;

    return await getLayout(env, user, '服务器庄园', content, '', req);
}
