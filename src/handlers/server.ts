import { getSessionUser, jsonRes } from '../utils/auth';
import type { Env } from '../env.d';

const DEFAULT_SERVER_RANK_LIMIT = 10;

function normalizeAmount(value: unknown): number {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return 0;
    return Math.floor(num);
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
