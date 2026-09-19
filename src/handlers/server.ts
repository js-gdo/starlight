import { getSessionUser, jsonRes } from '../utils/auth';
import type { Env } from '../env.d';

const DEFAULT_SERVER_RANK_LIMIT = 10;
const catalogLookup = new Map([
    ['cpu-epyc-9755', { kind: 'cpu', price: 9800, score: 760000, name: 'AMD EPYC 9755' }],
    ['cpu-epyc-9965', { kind: 'cpu', price: 9150, score: 742000, name: 'AMD EPYC 9965' }],
    ['cpu-intel-6980p', { kind: 'cpu', price: 8200, score: 675000, name: 'Intel Xeon 6980P' }],
    ['cpu-intel-6781p', { kind: 'cpu', price: 7600, score: 604000, name: 'Intel Xeon 6781P' }],
    ['board-x99', { kind: 'board', price: 1200, score: 12000, name: 'X99 万用主板' }],
    ['board-x299', { kind: 'board', price: 1800, score: 16000, name: 'X299 服务器主板' }],
    ['ram-32gb-ddr4', { kind: 'memory', price: 450, score: 9000, name: '32GB DDR4 ECC' }],
    ['ram-64gb-ddr5', { kind: 'memory', price: 980, score: 19000, name: '64GB DDR5 ECC' }],
    ['ram-128gb-ddr5', { kind: 'memory', price: 1850, score: 36000, name: '128GB DDR5 ECC' }],
    ['storage-1tb-nvme', { kind: 'storage', price: 680, score: 21000, name: '1TB NVMe SSD' }],
    ['storage-4tb-nvme', { kind: 'storage', price: 2200, score: 62000, name: '4TB NVMe SSD' }],
    ['storage-20tb-sata', { kind: 'storage', price: 5900, score: 125000, name: '20TB HDD 存储池' }],
    ['gpu-rtx-a6000', { kind: 'accelerator', price: 9200, score: 115000, name: 'NVIDIA RTX A6000' }],
    ['software-nginx', { kind: 'software', price: 180, score: 500, name: 'Nginx 静态托管' }],
    ['software-api', { kind: 'software', price: 260, score: 800, name: 'API 网关服务' }],
    ['software-shortlink', { kind: 'software', price: 340, score: 900, name: '短链接平台' }],
    ['software-doc-preview', { kind: 'software', price: 420, score: 1100, name: '文档预览服务' }],
    ['software-image-compress', { kind: 'software', price: 510, score: 1400, name: '图像压缩 API' }],
    ['software-sandbox', { kind: 'software', price: 760, score: 2200, name: '在线沙箱运行' }],
    ['ddos-filter', { kind: 'defense', price: 540, score: 300, name: '基础 DDoS 过滤' }],
    ['ddos-gateway', { kind: 'defense', price: 1200, score: 800, name: '网关级 DDoS 防护' }],
    ['ddos-enterprise', { kind: 'defense', price: 2600, score: 1500, name: '企业级防御阵列' }],
    ['docker-base', { kind: 'docker', price: 520, score: 170, name: 'Docker 容器基础层' }],
    ['docker-extended', { kind: 'docker', price: 960, score: 260, name: '镜像扩容套餐' }],
]);

function normalizeAmount(value: unknown): number {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return 0;
    return Math.floor(num);
}

function parseServerAssets(value: unknown): any[] {
    if (!value) return [];
    try {
        const parsed = JSON.parse(String(value));
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export async function handleServer(request: Request, env: Env, path: string) {
    const db = env.DB;
    const method = request.method;
    const user = await getSessionUser(env, request);

    if (path === '/api/server/rankings' && method === 'GET') {
        const [hardwareRows, coinRows] = await Promise.all([
            db.prepare(
                `SELECT id, username, color, tag, server_hardware_score, server_coin, points, server_cpu, server_motherboard, server_ram, server_storage
                 FROM users
                 WHERE use = 1
                 ORDER BY server_hardware_score DESC, server_coin DESC, id ASC
                 LIMIT ?`
            ).bind(DEFAULT_SERVER_RANK_LIMIT).all<any>(),
            db.prepare(
                `SELECT id, username, color, tag, server_coin, points, server_hardware_score
                 FROM users
                 WHERE use = 1
                 ORDER BY server_coin DESC, points DESC, id ASC
                 LIMIT ?`
            ).bind(DEFAULT_SERVER_RANK_LIMIT).all<any>(),
        ]);

        return jsonRes({
            hardware: hardwareRows.results || [],
            coins: coinRows.results || [],
            self: user ? {
                id: user.id,
                username: user.username,
                server_hardware_score: Number(user.server_hardware_score || 0),
                server_coin: Number(user.server_coin || 0),
                points: Number(user.points || 0),
            } : null,
        });
    }

    if (path === '/api/server/purchase' && method === 'POST') {
        if (!user) return jsonRes({ error: '请先登录后再购买服务器物品' }, 401);

        let body: any = {};
        try {
            body = await request.json();
        } catch {
            return jsonRes({ error: '参数格式错误' }, 400);
        }

        const id = String(body.id || '');
        const kind = String(body.kind || '');
        if (!id || !kind) {
            return jsonRes({ error: '缺少商品信息' }, 400);
        }

        const item = catalogLookup.get(id);
        if (!item || item.kind !== kind) {
            return jsonRes({ error: '商品不存在或类型不匹配' }, 400);
        }

        const currentUserRow = await db.prepare(
            `SELECT server_coin, server_hardware_score, server_assets, server_cpu, server_motherboard, server_ram, server_storage
             FROM users WHERE id = ?`
        ).bind(user.id).first<any>();

        const currentBalance = Number(currentUserRow?.server_coin || 0);
        const cost = Number(item.price || 0);
        if (currentBalance < cost) {
            return jsonRes({ error: 'Server 币余额不足，无法购买当前物品' }, 400);
        }

        const currentAssets = parseServerAssets(currentUserRow?.server_assets ?? '[]');
        if (currentAssets.some((entry: any) => String(entry?.id || '') === id)) {
            return jsonRes({ error: '你已经购买过这个商品了' }, 400);
        }

        const nextAssets = [...currentAssets, { id, type: item.kind, name: item.name, price: cost, score: item.score || 0, bought_at: new Date().toISOString() }];
        let nextCpu = currentUserRow?.server_cpu || 'E5-2686 v4';
        let nextMotherboard = currentUserRow?.server_motherboard || 'X99 主板';
        let nextRam = currentUserRow?.server_ram || '16GB DDR4';
        let nextStorage = currentUserRow?.server_storage || '1TB HDD';
        let nextScore = Number(currentUserRow?.server_hardware_score || 0) + Number(item.score || 0);

        if (item.kind === 'cpu') nextCpu = item.name;
        if (item.kind === 'board') nextMotherboard = item.name;
        if (item.kind === 'memory') nextRam = item.name;
        if (item.kind === 'storage') nextStorage = item.name;
        if (item.kind === 'accelerator') nextCpu = `${nextCpu} + ${item.name}`;

        const result = await db.prepare(
            `UPDATE users
             SET server_coin = server_coin - ?,
                 server_hardware_score = ?,
                 server_assets = ?,
                 server_cpu = ?,
                 server_motherboard = ?,
                 server_ram = ?,
                 server_storage = ?
             WHERE id = ?`
        ).bind(cost, nextScore, JSON.stringify(nextAssets), nextCpu, nextMotherboard, nextRam, nextStorage, user.id).run();

        return jsonRes({
            success: true,
            message: `已购买 ${item.name}，消耗 ${cost} Server 币`,
            result,
            balance_after: Number((currentBalance - cost).toFixed(1)),
        });
    }

    if (path === '/api/server/exchange' && method === 'POST') {
        if (!user) return jsonRes({ error: '请先登录后再兑换' }, 401);

        let body: any = {};
        try {
            body = await request.json();
        } catch {
            return jsonRes({ error: '参数格式错误' }, 400);
        }

        const direction = String(body.direction || '');
        const amount = normalizeAmount(body.amount);

        if (!direction || amount <= 0) {
            return jsonRes({ error: '请输入有效的兑换数量' }, 400);
        }

        if (direction === 'coin_to_point') {
            const pointsToExchange = amount;
            const cost = pointsToExchange * 12;
            if (Number(user.server_coin || 0) < cost) {
                return jsonRes({ error: 'Server 币余额不足' }, 400);
            }

            const result = await db.prepare(
                'UPDATE users SET server_coin = server_coin - ?, points = points + ? WHERE id = ?'
            ).bind(cost, pointsToExchange, user.id).run();

            return jsonRes({
                success: true,
                message: `已兑换 ${pointsToExchange} 积分（消耗 ${cost} Server 币）`,
                result,
                direction,
                amount: cost,
                received: pointsToExchange,
            });
        }

        if (direction === 'point_to_coin') {
            const pointsToSpend = amount;
            const received = pointsToSpend * 10;
            if (Number(user.points || 0) < pointsToSpend) {
                return jsonRes({ error: '积分余额不足' }, 400);
            }

            const result = await db.prepare(
                'UPDATE users SET points = points - ?, server_coin = server_coin + ? WHERE id = ?'
            ).bind(pointsToSpend, received, user.id).run();

            return jsonRes({
                success: true,
                message: `已兑换 ${received} Server 币（消耗 ${pointsToSpend} 积分）`,
                result,
                direction,
                amount: pointsToSpend,
                received,
            });
        }

        return jsonRes({ error: '兑换方向无效' }, 400);
    }

    return jsonRes({ error: 'Server API not found' }, 404);
}
