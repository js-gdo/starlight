import { getSessionUser } from '../utils/auth';
import { getLayout } from '../utils/layout';
import { getTranslator } from '../utils/i18n';
import { htmlEscape } from '../utils/html';
import type { Env } from '../env.d';

const hardwareCatalog = [
    { id: 'cpu-epyc-9755', type: 'cpu', name: 'AMD EPYC 9755', score: 760000, price: 9800, spec: '128 核 / 256 线程 / 5.7 GHz' },
    { id: 'cpu-epyc-9965', type: 'cpu', name: 'AMD EPYC 9965', score: 742000, price: 9150, spec: '96 核 / 192 线程 / 5.4 GHz' },
    { id: 'cpu-intel-6980p', type: 'cpu', name: 'Intel Xeon 6980P', score: 675000, price: 8200, spec: '128 核 / 256 线程 / 5.2 GHz' },
    { id: 'cpu-intel-6781p', type: 'cpu', name: 'Intel Xeon 6781P', score: 604000, price: 7600, spec: '96 核 / 192 线程 / 5.0 GHz' },
    { id: 'board-x99', type: 'board', name: 'X99 万用主板', score: 12000, price: 1200, spec: '双路兼容 / 10× PCIe / 128GB ECC' },
    { id: 'board-x299', type: 'board', name: 'X299 服务器主板', score: 16000, price: 1800, spec: '双路 / 8× NVMe / DDR4 ECC' },
    { id: 'ram-32gb-ddr4', type: 'memory', name: '32GB DDR4 ECC', score: 9000, price: 450, spec: '每模组 32GB，支持双通道' },
    { id: 'ram-64gb-ddr5', type: 'memory', name: '64GB DDR5 ECC', score: 19000, price: 980, spec: '每模组 64GB，运行更稳定' },
    { id: 'ram-128gb-ddr5', type: 'memory', name: '128GB DDR5 ECC', score: 36000, price: 1850, spec: '高并发缓存与数据库场景' },
    { id: 'storage-1tb-nvme', type: 'storage', name: '1TB NVMe SSD', score: 21000, price: 680, spec: '随机 IO 1.2M / 读写 3.5GB/s' },
    { id: 'storage-4tb-nvme', type: 'storage', name: '4TB NVMe SSD', score: 62000, price: 2200, spec: '适合大规模日志、镜像缓存' },
    { id: 'storage-20tb-sata', type: 'storage', name: '20TB HDD 存储池', score: 125000, price: 5900, spec: '低成本冷存储，适合归档' },
    { id: 'gpu-rtx-a6000', type: 'accelerator', name: 'NVIDIA RTX A6000', score: 115000, price: 9200, spec: 'AI 加速 / 计算节点 / 图像推理' },
];

const softwareCatalog = [
    { id: 'software-nginx', type: 'software', name: 'Nginx 静态托管', price: 180, income: 360, cpu: 2, ram: 2, desc: '部署静态站点与 CDN 缓存，适合低门槛盈利。' },
    { id: 'software-api', type: 'software', name: 'API 网关服务', price: 260, income: 620, cpu: 3, ram: 4, desc: '为小型业务提供接口托管与扩容。' },
    { id: 'software-shortlink', type: 'software', name: '短链接平台', price: 340, income: 820, cpu: 2, ram: 3, desc: '短链跳转、访问统计、反爬与防滥用。' },
    { id: 'software-doc-preview', type: 'software', name: '文档预览服务', price: 420, income: 980, cpu: 3, ram: 5, desc: '在线 PDF / Markdown / Office 预览。' },
    { id: 'software-image-compress', type: 'software', name: '图像压缩 API', price: 510, income: 1250, cpu: 4, ram: 6, desc: '对外提供压缩、裁切与 WebP 转码。' },
    { id: 'software-sandbox', type: 'software', name: '在线沙箱运行', price: 760, income: 1750, cpu: 6, ram: 8, desc: '运行评测、脚本执行与实验性容器环境。' },
];

const defenseCatalog = [
    { id: 'ddos-filter', type: 'defense', name: '基础 DDoS 过滤', price: 540, defense: 20, desc: '拦截常见 SYN/UDP 洪水，适合起步服务器' },
    { id: 'ddos-gateway', type: 'defense', name: '网关级 DDoS 防护', price: 1200, defense: 45, desc: '增加 45% 的流量吸收能力与协议清洗' },
    { id: 'ddos-enterprise', type: 'defense', name: '企业级防御阵列', price: 2600, defense: 80, desc: '针对大规模黑客压测和 BGP 级流量攻击' },
];

const dockerCatalog = [
    { id: 'docker-base', type: 'docker', name: 'Docker 容器基础层', price: 520, desc: '支持容器化部署，默认带 1 个基础镜像' },
    { id: 'docker-extended', type: 'docker', name: '镜像扩容套餐', price: 960, desc: '可容纳多个服务镜像，并减少 10% CPU 性能' },
];

const randomEvents = [
    { title: '光纤线路波动', summary: '光纤线路波动导致收益 -15%，运维成本 +8% 1 天', coin: -80 },
    { title: '用户流量暴涨', summary: '用户流量暴涨，新增 200~500 Server 币收益', coin: 280 },
    { title: '服务器突发宕机', summary: '服务器突发宕机，停机 4 小时后恢复，收益归零', coin: -140 },
    { title: '节点扩容奖励', summary: '节点扩容奖励到账，获得一次补贴现金流', coin: 220 },
];

function parseServerAssets(value: unknown): any[] {
    if (!value) return [];
    try {
        const parsed = JSON.parse(String(value));
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function renderServerSvg() {
    return `
      <svg viewBox="0 0 420 270" width="100%" height="220" xmlns="http://www.w3.org/2000/svg" aria-label="服务器机柜示意图" role="img">
        <defs>
          <linearGradient id="rackBody" x1="0" x2="1">
            <stop offset="0%" stop-color="#4b5563"/>
            <stop offset="50%" stop-color="#374151"/>
            <stop offset="100%" stop-color="#1f2937"/>
          </linearGradient>
          <linearGradient id="rackGlow" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stop-color="#7dd3fc" stop-opacity="0.85"/>
            <stop offset="100%" stop-color="#0ea5e9" stop-opacity="0.2"/>
          </linearGradient>
        </defs>
        <rect x="22" y="18" width="376" height="206" rx="18" fill="#0f172a"/>
        <rect x="42" y="38" width="336" height="172" rx="12" fill="url(#rackBody)" stroke="#94a3b8" stroke-width="2"/>
        <rect x="62" y="62" width="296" height="38" rx="8" fill="#111827"/>
        <rect x="62" y="108" width="296" height="38" rx="8" fill="#111827"/>
        <rect x="62" y="154" width="296" height="38" rx="8" fill="#111827"/>
        <rect x="78" y="70" width="62" height="20" rx="4" fill="#1e293b" stroke="#67e8f9" stroke-width="1"/>
        <rect x="150" y="70" width="62" height="20" rx="4" fill="#1e293b" stroke="#67e8f9" stroke-width="1"/>
        <rect x="222" y="70" width="62" height="20" rx="4" fill="#1e293b" stroke="#67e8f9" stroke-width="1"/>
        <rect x="294" y="70" width="42" height="20" rx="4" fill="#1e293b" stroke="#67e8f9" stroke-width="1"/>
        <circle cx="98" cy="80" r="5" fill="#22c55e"><animate attributeName="opacity" values="1;0.35;1" dur="1.6s" repeatCount="indefinite"/></circle>
        <circle cx="170" cy="80" r="5" fill="#f59e0b"><animate attributeName="opacity" values="0.6;1;0.6" dur="2s" repeatCount="indefinite"/></circle>
        <circle cx="242" cy="80" r="5" fill="#60a5fa"><animate attributeName="opacity" values="1;0.4;1" dur="1.8s" repeatCount="indefinite"/></circle>
        <rect x="78" y="116" width="120" height="20" rx="4" fill="#1e293b" stroke="#c084fc" stroke-width="1"/>
        <rect x="210" y="116" width="110" height="20" rx="4" fill="#1e293b" stroke="#c084fc" stroke-width="1"/>
        <rect x="78" y="162" width="96" height="20" rx="4" fill="#1e293b" stroke="#34d399" stroke-width="1"/>
        <rect x="186" y="162" width="132" height="20" rx="4" fill="#1e293b" stroke="#34d399" stroke-width="1"/>
        <rect x="306" y="38" width="30" height="12" rx="4" fill="#e2e8f0"/>
        <rect x="314" y="52" width="14" height="154" rx="5" fill="url(#rackGlow)" opacity="0.8"/>
        <text x="55" y="236" fill="#e2e8f0" font-size="14" font-family="sans-serif">基础运营节点</text>
        <text x="230" y="236" fill="#93c5fd" font-size="14" font-family="sans-serif">CPU / RAM / SSD / Docker / DDoS</text>
      </svg>`;
}

export async function renderServer(env: Env, req: Request) {
    const t = getTranslator(req);
    const user = await getSessionUser(env, req);
    const db = env.DB;

    let userStats: any = null;
    if (user) {
        userStats = await db.prepare(
            `SELECT id, username, color, tag, points, server_coin, server_hardware_score, server_cpu, server_motherboard, server_ram, server_storage, server_assets
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
    const serverAssets = parseServerAssets(userStats?.server_assets ?? '[]');
    const softwareCount = serverAssets.filter((item: any) => item?.type === 'software').length;
    const defenseCount = serverAssets.filter((item: any) => item?.type === 'defense').length;
    const dockerCount = serverAssets.filter((item: any) => item?.type === 'docker' || item?.id === 'docker-base' || item?.id === 'docker-extended').length;
    const installedHardware = serverAssets.filter((item: any) => ['cpu', 'board', 'memory', 'storage', 'gpu', 'nic', 'power'].includes(String(item?.type || '')));
    const installedSoftware = serverAssets.filter((item: any) => item?.type === 'software');
    const dockerCapacity = 2 + serverAssets.filter((item: any) => String(item?.id || '').includes('docker-extended')).length * 3;
    const serviceLimit = dockerCapacity > 0 ? Math.max(dockerCapacity, Math.min(8, Math.max(2, Math.floor(hardwareScore / 200000) + 2))) : 1;
    const cpuName = userStats?.server_cpu || 'E5-2686 v4';
    const ramName = userStats?.server_ram || '16GB DDR4';
    const storageName = userStats?.server_storage || '1TB HDD';
    const currentEvent = randomEvents[(Math.abs(Number(user?.id || 1)) + Date.now()) % randomEvents.length];
    const loadValue = Math.min(100, Math.max(15, softwareCount * 12 + defenseCount * 8 + dockerCount * 10));
    const defenseLevel = Math.min(100, 10 + defenseCount * 28);
    const dockerPenalty = dockerCount > 0 ? 'Docker 已启用，CPU 实际性能减少 10%' : 'Docker 未启用，CPU 不受影响';
    const attackTargets = user ? await db.prepare(
        `SELECT id, username, server_hardware_score, server_coin
         FROM users
         WHERE use = 1 AND id != ?
         ORDER BY server_hardware_score DESC, server_coin DESC
         LIMIT 10`
    ).bind(user.id).all<any>() : { results: [] as any[] };

    const content = `
      <style>
        .server-layout { display: grid; gap: 16px; }
        .server-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
        .server-card { background: #fff; border-radius: 10px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
        .server-card h3 { font-size: 15px; margin-bottom: 10px; color: #333; }
        .server-hero { display:flex; justify-content:space-between; align-items:flex-end; gap:16px; padding:22px; background:linear-gradient(135deg,#2f4054,#596b80); color:#fff; border-radius:10px; box-shadow:0 8px 20px rgba(47,64,84,.18); }
        .server-hero h1 { font-size:28px; margin:0 0 6px; }
        .server-hero p { color:rgba(255,255,255,.72); font-size:13px; }
        .server-hero-badge { padding:8px 12px; border:1px solid rgba(255,255,255,.24); border-radius:8px; color:#fff; background:rgba(255,255,255,.1); font-size:12px; white-space:nowrap; }
        .server-tabs { display:flex; gap:6px; overflow-x:auto; padding:2px; }
        .server-tab { border:1px solid #e6e0ed; background:#fff; color:#666; border-radius:7px; padding:8px 14px; cursor:pointer; font-size:13px; white-space:nowrap; }
        .server-tab.active, .server-tab:hover { background:#8E44AD; border-color:#8E44AD; color:#fff; }
        .server-view[hidden] { display:none; }
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
        .store-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
        .store-item { border:1px solid #ebebeb; border-radius:10px; padding:12px; background:#fafafa; display:flex; flex-direction:column; gap:8px; }
        .store-item h4 { margin:0; font-size:14px; }
        .store-item small { color:#666; }
        .store-item button { margin-top:auto; background:#8E44AD; color:#fff; border:none; border-radius:6px; padding:8px 10px; cursor:pointer; }
        .server-filter { display:flex; gap:8px; margin-bottom:10px; }
        .server-filter input, .server-filter select { flex:1; min-width:0; padding:8px 10px; border:1px solid #ddd; border-radius:6px; font-size:13px; }
        .metric-bar { height: 8px; border-radius: 999px; background: #e5e7eb; overflow: hidden; }
        .metric-bar > span { display:block; height:100%; background: linear-gradient(90deg, #8E44AD, #3b82f6); border-radius: 999px; }
        .pill { display:inline-block; padding:4px 8px; border-radius:999px; font-size:11px; background:#f3e8ff; color:#6b21a8; border:1px solid #e9d5ff; }
        @media (max-width: 900px) { .server-grid, .server-panel, .server-rankings { grid-template-columns: 1fr; } }
      </style>

      <div class="server-hero">
        <div>
          <h1><i class="fas fa-server"></i> 服务器庄园</h1>
          <p>搭建你的服务器，管理 CPU、内存、 Docker、软件和 DDoS 防御，提升全服排名。</p>
        </div>
        <div class="server-hero-badge"><i class="fas fa-shield-halved"></i> 资源运营中</div>
      </div>

      <div class="server-tabs" role="tablist" aria-label="服务器庄园视图">
        <button class="server-tab active" data-server-tab="overview" type="button">总览</button>
        <button class="server-tab" data-server-tab="exchange" type="button">货币兑换</button>
        <button class="server-tab" data-server-tab="ranking" type="button">全服排名</button>
        <button class="server-tab" data-server-tab="hardware" type="button">硬件与软件</button>
      </div>

      <div class="server-layout">
        <div class="server-view" data-server-view="overview">
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
              <h3>当前状态</h3>
              <div class="server-sub"><span class="pill">${softwareCount} 个软件</span> <span class="pill">${defenseCount} 层防御</span> <span class="pill">Docker 容量 ${dockerCapacity}</span></div>
              <div class="server-sub">${dockerPenalty}</div>
            </div>
          </div>

          <div class="server-card" style="margin-top:16px;">
            <h3><i class="fas fa-boxes-stacked"></i> 已安装设备</h3>
            <div style="display:grid; gap:10px; font-size:13px; color:#555;">
              ${installedHardware.length > 0 ? installedHardware.map((item: any) => `
                <div style="display:flex; justify-content:space-between; gap:12px; border-bottom:1px solid #eee; padding-bottom:8px;">
                  <span>${htmlEscape(String(item.name || item.id || '设备'))}</span>
                  <span class="pill">${htmlEscape(String(item.type || 'hardware'))}</span>
                </div>
              `).join('') : '<div style="color:#999;">尚未安装任何硬件设备</div>'}
            </div>
          </div>

          <div class="server-card" style="margin-top:16px;">
            <h3><i class="fas fa-cubes"></i> 已部署软件</h3>
            <div style="display:grid; gap:10px; font-size:13px; color:#555;">
              ${installedSoftware.length > 0 ? installedSoftware.map((item: any) => `
                <div style="display:flex; justify-content:space-between; gap:12px; border-bottom:1px solid #eee; padding-bottom:8px;">
                  <span>${htmlEscape(String(item.name || item.id || '服务'))}</span>
                  <span class="pill">服务</span>
                </div>
              `).join('') : '<div style="color:#999;">暂未部署任何软件服务</div>'}
            </div>
          </div>

          <div class="server-card" style="margin-top:16px;">
            <h3><i class="fas fa-docker"></i> Docker / 服务容量</h3>
            <div style="display:grid; gap:10px; font-size:13px; color:#555;">
              <div>Docker 镜像容量：${dockerCapacity} 个</div>
              <div>部署上限：${serviceLimit} 个服务</div>
              <div>安装状态：${dockerCount > 0 ? 'Docker 已启用' : '未安装 Docker（仅可部署 1 个服务）'}</div>
            </div>
          </div>

          <div class="server-panel" style="margin-top:16px;">
            <div class="server-card">
              <h3><i class="fas fa-server"></i> 机柜概览</h3>
              ${renderServerSvg()}
              <div style="display:grid; gap:10px; margin-top: 12px; color:#555; font-size:13px;">
                <div><strong>CPU:</strong> ${htmlEscape(cpuName)}</div>
                <div><strong>内存:</strong> ${htmlEscape(ramName)}</div>
                <div><strong>存储:</strong> ${htmlEscape(storageName)}</div>
                <div><strong>Docker:</strong> ${dockerCount > 0 ? '已安装镜像，运行多个容器' : '未安装'}</div>
                <div><strong>DDoS:</strong> ${defenseCount > 0 ? '已加固' : '未配置'}</div>
              </div>
            </div>

            <div class="server-card">
              <h3><i class="fas fa-chart-line"></i> 资源负载</h3>
              <div style="display:grid; gap:14px; margin-top:8px; font-size:13px; color:#555;">
                <div>
                  <div style="display:flex; justify-content:space-between; margin-bottom:6px;"><span>CPU 占用</span><span>${loadValue}%</span></div>
                  <div class="metric-bar"><span style="width:${loadValue}%"></span></div>
                </div>
                <div>
                  <div style="display:flex; justify-content:space-between; margin-bottom:6px;"><span>磁盘吞吐</span><span>${Math.min(96, 35 + softwareCount * 8)}%</span></div>
                  <div class="metric-bar"><span style="width:${Math.min(96, 35 + softwareCount * 8)}%"></span></div>
                </div>
                <div>
                  <div style="display:flex; justify-content:space-between; margin-bottom:6px;"><span>安全防护</span><span>${defenseLevel}%</span></div>
                  <div class="metric-bar"><span style="width:${defenseLevel}%"></span></div>
                </div>
                <div>
                  <div style="display:flex; justify-content:space-between; margin-bottom:6px;"><span>容器运行</span><span>${Math.min(100, dockerCount * 20)}%</span></div>
                  <div class="metric-bar"><span style="width:${Math.min(100, dockerCount * 20)}%"></span></div>
                </div>
              </div>
            </div>
          </div>

          <div class="server-card" style="margin-top:16px;">
            <h3><i class="fas fa-bomb"></i> DDoS 攻击</h3>
            ${user ? `
              <form class="exchange-form" id="ddosAttackForm">
                <select id="ddosTarget" name="target_id">
                  ${(attackTargets.results || []).map((row: any) => `
                    <option value="${row.id}">${htmlEscape(String(row.username || '未知用户'))} · 硬件 ${Number(row.server_hardware_score || 0)}</option>
                  `).join('') || '<option value="">暂无可攻击目标</option>'}
                </select>
                <select id="ddosStrength" name="strength">
                  <option value="25">轻度攻击</option>
                  <option value="50">常规攻击</option>
                  <option value="75">重度攻击</option>
                  <option value="100">全力压测</option>
                </select>
                <button type="submit">发起 DDoS 攻击</button>
              </form>
              <div id="ddosMessage" style="margin-top:10px;color:#666;font-size:13px;"></div>
            ` : `<div style="color:#666;font-size:14px;">登录后才可对其他服务器发起 DDoS 攻击。</div>`}
          </div>

          <div class="server-card" style="margin-top:16px;">
            <h3><i class="fas fa-bolt"></i> 随机事件</h3>
            <div style="display:grid; gap:8px; color:#555; font-size:13px;">
              <div><strong>${htmlEscape(currentEvent.title)}</strong>: ${htmlEscape(currentEvent.summary)}</div>
              <div>当前策略建议：保持 DDoS 防御与 Docker 资源平衡，避免一段时间内丢失收益。</div>
            </div>
          </div>
        </div>

        <div class="server-view" data-server-view="exchange" hidden>
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
              <h3><i class="fas fa-hdd"></i> 当前配置</h3>
              <div style="display:grid;gap:8px;font-size:13px;color:#555;">
                <div>CPU: ${htmlEscape(cpuName)}</div>
                <div>主板: ${htmlEscape(userStats?.server_motherboard || 'X99 主板')}</div>
                <div>内存: ${htmlEscape(ramName)}</div>
                <div>存储: ${htmlEscape(storageName)}</div>
              </div>
            </div>
          </div>
        </div>

        <div class="server-view" data-server-view="ranking" hidden>
          <div class="server-rankings">
            <div class="server-card">
              <h3><i class="fas fa-medal"></i> 服务器硬件排名</h3>
              <div class="rank-list">
                ${(hardwareRankings.results || []).map((row: any, index: number) => `
                  <div class="rank-item">
                    <div class="rank-badge">${index + 1}</div>
                    <div>
                      <div style="font-weight:700;">${htmlEscape(String(row.username || '未知用户'))}</div>
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
                      <div style="font-weight:700;">${htmlEscape(String(row.username || '未知用户'))}</div>
                      <div style="font-size:11px;color:#666;">积分 ${Number(row.points || 0)}</div>
                    </div>
                    <div style="font-weight:700;color:#8E44AD;">${Number(row.server_coin || 0)}</div>
                  </div>
                `).join('') || '<div style="color:#999;font-size:13px;">暂无数据</div>'}
              </div>
            </div>
          </div>
        </div>

        <div class="server-view" data-server-view="hardware" hidden>
          <div class="server-card">
            <h3><i class="fas fa-list"></i> 硬件与软件商店</h3>
            <div class="server-filter">
              <input id="hardwareSearch" type="search" placeholder="搜索名称、型号或用途">
              <select id="hardwareType">
                <option value="all">全部</option>
                <option value="cpu">CPU</option>
                <option value="memory">内存</option>
                <option value="storage">存储</option>
                <option value="board">主板</option>
                <option value="gpu">GPU</option>
                <option value="nic">网卡</option>
                <option value="power">电源</option>
                <option value="software">软件</option>
                <option value="defense">DDoS</option>
                <option value="docker">Docker</option>
              </select>
            </div>

            <div class="store-grid">
              ${hardwareCatalog.map((item: any) => `
                <div class="store-item" data-store-item="${htmlEscape(item.type)}" data-store-name="${htmlEscape(item.name.toLowerCase())}">
                  <h4>${htmlEscape(item.name)}</h4>
                  <small>${htmlEscape(item.spec || '高性能服务器配件')}</small>
                  <div style="color:#8E44AD;font-weight:700;">${Number(item.price).toFixed(1)} Server 币</div>
                  <div style="font-size:12px;color:#666;">性能分 ${Number(item.score)}</div>
                  <button type="button" data-purchase="${htmlEscape(item.id)}" data-kind="${htmlEscape(item.type)}">购买</button>
                </div>
              `).join('')}

              <div class="store-item" data-store-item="gpu" data-store-name="nvidia rtx a6000">
                <h4>NVIDIA RTX A6000</h4>
                <small>AI 加速 / 计算节点 / 图像推理</small>
                <div style="color:#8E44AD;font-weight:700;">9200.0 Server 币</div>
                <div style="font-size:12px;color:#666;">性能分 115000</div>
                <button type="button" data-purchase="gpu-rtx-a6000" data-kind="gpu">购买</button>
              </div>

              <div class="store-item" data-store-item="nic" data-store-name="10gbe 网卡">
                <h4>10GbE 网卡</h4>
                <small>提升网络吞吐与稳定性</small>
                <div style="color:#8E44AD;font-weight:700;">1600.0 Server 币</div>
                <div style="font-size:12px;color:#666;">性能分 18000</div>
                <button type="button" data-purchase="nic-10g" data-kind="nic">购买</button>
              </div>

              <div class="store-item" data-store-item="nic" data-store-name="25gbe 服务器网卡">
                <h4>25GbE 服务器网卡</h4>
                <small>适配高并发业务与多租户网络</small>
                <div style="color:#8E44AD;font-weight:700;">3100.0 Server 币</div>
                <div style="font-size:12px;color:#666;">性能分 36000</div>
                <button type="button" data-purchase="nic-25g" data-kind="nic">购买</button>
              </div>

              <div class="store-item" data-store-item="power" data-store-name="1kva ups 电源">
                <h4>1KVA UPS 电源</h4>
                <small>稳定供电，降低断电风险</small>
                <div style="color:#8E44AD;font-weight:700;">1200.0 Server 币</div>
                <div style="font-size:12px;color:#666;">性能分 16000</div>
                <button type="button" data-purchase="ups-1kva" data-kind="power">购买</button>
              </div>

              <div class="store-item" data-store-item="storage" data-store-name="raid 控制器">
                <h4>RAID 控制器</h4>
                <small>增强存储冗余与读写吞吐</small>
                <div style="color:#8E44AD;font-weight:700;">1400.0 Server 币</div>
                <div style="font-size:12px;color:#666;">性能分 24000</div>
                <button type="button" data-purchase="raid-hba" data-kind="storage">购买</button>
              </div>

              ${softwareCatalog.map((item: any) => `
                <div class="store-item" data-store-item="software" data-store-name="${htmlEscape(item.name.toLowerCase())}">
                  <h4>${htmlEscape(item.name)}</h4>
                  <small>${htmlEscape(item.desc)}</small>
                  <div style="color:#8E44AD;font-weight:700;">${Number(item.price).toFixed(1)} Server 币</div>
                  <div style="font-size:12px;color:#666;">收益 ${Number(item.income)} /日 · 资源 ${item.cpu} CPU / ${item.ram} GB</div>
                  <button type="button" data-purchase="${htmlEscape(item.id)}" data-kind="software">部署</button>
                </div>
              `).join('')}

              <div class="store-item" data-store-item="software" data-store-name="监控告警平台">
                <h4>监控告警平台</h4>
                <small>追踪 CPU、网络和停机事件，降低事故损失。</small>
                <div style="color:#8E44AD;font-weight:700;">660.0 Server 币</div>
                <div style="font-size:12px;color:#666;">收益 1600 /日 · 资源 3 CPU / 5 GB</div>
                <button type="button" data-purchase="software-monitoring" data-kind="software">部署</button>
              </div>

              <div class="store-item" data-store-item="software" data-store-name="mysql 数据库集群">
                <h4>MySQL 数据库集群</h4>
                <small>支撑企业数据库应用与高可用读写。</small>
                <div style="color:#8E44AD;font-weight:700;">720.0 Server 币</div>
                <div style="font-size:12px;color:#666;">收益 2100 /日 · 资源 4 CPU / 8 GB</div>
                <button type="button" data-purchase="software-mysql" data-kind="software">部署</button>
              </div>

              ${defenseCatalog.map((item: any) => `
                <div class="store-item" data-store-item="defense" data-store-name="${htmlEscape(item.name.toLowerCase())}">
                  <h4>${htmlEscape(item.name)}</h4>
                  <small>${htmlEscape(item.desc)}</small>
                  <div style="color:#8E44AD;font-weight:700;">${Number(item.price).toFixed(1)} Server 币</div>
                  <div style="font-size:12px;color:#666;">防御加成 ${Number(item.defense)}%</div>
                  <button type="button" data-purchase="${htmlEscape(item.id)}" data-kind="defense">启用</button>
                </div>
              `).join('')}

              ${dockerCatalog.map((item: any) => `
                <div class="store-item" data-store-item="docker" data-store-name="${htmlEscape(item.name.toLowerCase())}">
                  <h4>${htmlEscape(item.name)}</h4>
                  <small>${htmlEscape(item.desc)}</small>
                  <div style="color:#8E44AD;font-weight:700;">${Number(item.price).toFixed(1)} Server 币</div>
                  <div style="font-size:12px;color:#666;">Docker 镜像托管</div>
                  <button type="button" data-purchase="${htmlEscape(item.id)}" data-kind="docker">安装</button>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>

      <script>
        document.querySelectorAll('[data-server-tab]').forEach(function (tab) {
          tab.addEventListener('click', function () {
            const view = tab.getAttribute('data-server-tab');
            document.querySelectorAll('[data-server-tab]').forEach(function (item) { item.classList.toggle('active', item === tab); });
            document.querySelectorAll('[data-server-view]').forEach(function (panel) { panel.hidden = panel.getAttribute('data-server-view') !== view; });
          });
        });

        function filterStore() {
          const keyword = String(document.getElementById('hardwareSearch')?.value || '').toLowerCase().trim();
          const type = String(document.getElementById('hardwareType')?.value || 'all');
          document.querySelectorAll('[data-store-name]').forEach(function (row) {
            const matchesName = !keyword || row.getAttribute('data-store-name').includes(keyword);
            const matchesType = type === 'all' || row.getAttribute('data-store-item') === type;
            row.hidden = !(matchesName && matchesType);
          });
        }
        document.getElementById('hardwareSearch')?.addEventListener('input', filterStore);
        document.getElementById('hardwareType')?.addEventListener('change', filterStore);

        document.querySelectorAll('[data-purchase]').forEach(function (button) {
          button.addEventListener('click', async function () {
            const id = button.getAttribute('data-purchase');
            const kind = button.getAttribute('data-kind');
            if (!id || !kind) return;
            try {
              const response = await fetch('/api/server/purchase', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, kind })
              });
              const data = await response.json();
              if (!response.ok) {
                alert(data.error || '购买失败');
                return;
              }
              alert(data.message || '购买成功');
              window.location.reload();
            } catch (error) {
              alert('网络错误，请稍后再试');
            }
          });
        });

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

        const ddosForm = document.getElementById('ddosAttackForm');
        if (ddosForm) {
          ddosForm.addEventListener('submit', async function (event) {
            event.preventDefault();
            const targetId = Number(document.getElementById('ddosTarget')?.value || 0);
            const strength = Number(document.getElementById('ddosStrength')?.value || 25);
            const messageEl = document.getElementById('ddosMessage');
            try {
              const response = await fetch('/api/server/attack', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target_id: targetId, strength })
              });
              const data = await response.json();
              if (!response.ok) {
                messageEl.textContent = data.error || '攻击失败';
                messageEl.style.color = '#c0392b';
                return;
              }
              messageEl.textContent = data.message || '攻击已发起';
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
