import { getSessionUser, jsonRes } from '../utils/auth';
import type { Env, TypedD1PreparedStatement } from '../env.d';

const SIMULATION_INTERVAL_MS = 60 * 60 * 1000;
const MAX_OFFLINE_HOURS = 72;
const MAINTENANCE_COST = 75;
const CONTRACT_REWARD = 180;
const MAX_REDEMPTION_POINTS = 2000;

const COMPONENTS = [
    { key: 'solar_array', name: '轨道太阳能阵列', icon: 'fa-solar-panel', description: '提供稳定电力，减缓能源消耗。', baseCost: 180, power: 9, air: 0, cleaning: 0, batteryCapacity: 0 },
    { key: 'fusion_reactor', name: '聚变反应堆', icon: 'fa-atom', description: '高功率核心，可显著改善空间站能源收支。', baseCost: 440, power: 24, air: -1, cleaning: -1, batteryCapacity: 0 },
    { key: 'life_support', name: '生命维持舱', icon: 'fa-wind', description: '循环过滤空气并稳定舱内氧气。', baseCost: 240, power: -3, air: 12, cleaning: 1, batteryCapacity: 0 },
    { key: 'recycling_unit', name: '全自动回收机', icon: 'fa-recycle', description: '回收日常废弃物，让生活舱保持整洁。', baseCost: 190, power: -2, air: 0, cleaning: 11, batteryCapacity: 0 },
    { key: 'research_lab', name: '深空研究实验室', icon: 'fa-microscope', description: '分析星际数据并持续提升空间站科技值。', baseCost: 360, power: -5, air: -2, cleaning: -2, batteryCapacity: 0 },
    { key: 'shield_generator', name: '微陨石护盾', icon: 'fa-shield-halved', description: '抵御微陨石与空间环境造成的结构损耗。', baseCost: 280, power: -4, air: 0, cleaning: 0, batteryCapacity: 0 },
    { key: 'battery_bank', name: '高密度蓄电池', icon: 'fa-car-battery', description: '扩充能源储备上限，吸收阵列产生的富余电量。', baseCost: 260, power: 0, air: 0, cleaning: 0, batteryCapacity: 100 },
] as const;

type ComponentKey = typeof COMPONENTS[number]['key'];

type Player = {
    user_id: number;
    credits: number;
    battery: number;
    oxygen: number;
    cleanliness: number;
    integrity: number;
    technology: number;
    last_simulated_at: string;
    last_operation_token: string;
    contract_claim_date: string;
};

type ComponentRow = { component_key: string; quantity: number };

function chinaDate(now = new Date()): string {
    return new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function timestamp(value: string): number {
    const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value)
        ? `${value.replace(' ', 'T')}Z`
        : value;
    return Date.parse(normalized);
}

async function ensurePlayer(env: Env, userId: number): Promise<void> {
    const statements: TypedD1PreparedStatement[] = [
        env.DB.prepare('INSERT OR IGNORE INTO space_station_players (user_id) VALUES (?)').bind(userId),
        ...COMPONENTS.map(component => env.DB.prepare(`
            INSERT OR IGNORE INTO space_station_components (user_id, component_key, quantity)
            VALUES (?, ?, ?)
        `).bind(userId, component.key, component.key === 'solar_array' || component.key === 'life_support' ? 1 : 0)),
    ];
    await env.DB.batch(statements);
}

async function simulateStation(env: Env, player: Player, components: ComponentRow[]): Promise<void> {
    const last = timestamp(player.last_simulated_at);
    if (!Number.isFinite(last)) throw new Error('Invalid space station simulation timestamp.');
    const now = Date.now();
    const hours = Math.min(MAX_OFFLINE_HOURS, Math.floor(Math.max(0, now - last) / SIMULATION_INTERVAL_MS));
    if (!hours) return;

    const inventory = new Map(components.map(row => [row.component_key, Number(row.quantity)]));
    const count = (key: ComponentKey) => inventory.get(key) || 0;
    const powerRate = -8 + count('solar_array') * 9 + count('fusion_reactor') * 24
        - count('life_support') * 3 - count('recycling_unit') * 2
        - count('research_lab') * 5 - count('shield_generator') * 4;
    const oxygenRate = -3 + count('life_support') * 12 - count('fusion_reactor')
        - count('research_lab') * 2;
    const cleaningRate = -2 + count('recycling_unit') * 11 + count('life_support')
        - count('fusion_reactor') - count('research_lab') * 2;
    const shield = count('shield_generator');
    const batteryCapacity = 100 + count('battery_bank') * 100;
    let battery = Number(player.battery);
    let oxygen = Number(player.oxygen);
    let cleanliness = Number(player.cleanliness);
    let integrity = Number(player.integrity);
    let researchOutput = 0;
    let previousTick = last;
    for (let tick = 1; tick <= hours; tick++) {
        const tickTime = last + tick * SIMULATION_INTERVAL_MS;
        battery = Math.max(0, Math.min(batteryCapacity, battery + powerRate));
        if (battery > 0) {
            oxygen = Math.max(0, Math.min(100, oxygen + oxygenRate));
            cleanliness = Math.max(0, Math.min(100, cleanliness + cleaningRate));
            researchOutput += count('research_lab');
        } else {
            oxygen = Math.max(0, oxygen - 8);
            cleanliness = Math.max(0, cleanliness - 6);
        }
        const wearPeriod = (shield ? 24 : 6) * SIMULATION_INTERVAL_MS;
        const crossedWearBoundary = Math.floor(tickTime / wearPeriod) > Math.floor(previousTick / wearPeriod);
        if (crossedWearBoundary && (battery === 0 || oxygen < 30 || cleanliness < 30)) {
            integrity = Math.max(0, integrity - 1);
        }
        previousTick = tickTime;
    }
    const token = crypto.randomUUID();
    const simulatedAt = now - last >= MAX_OFFLINE_HOURS * SIMULATION_INTERVAL_MS
        ? now
        : last + hours * SIMULATION_INTERVAL_MS;
    await env.DB.prepare(`
        UPDATE space_station_players
        SET battery = ?, oxygen = ?, cleanliness = ?, integrity = ?,
            technology = technology + ?, last_simulated_at = ?, last_operation_token = ?
        WHERE user_id = ? AND last_simulated_at = ?
          AND battery = ? AND oxygen = ? AND cleanliness = ? AND integrity = ?
    `).bind(
        battery, oxygen, cleanliness, integrity, researchOutput,
        new Date(simulatedAt).toISOString(), token,
        player.user_id, player.last_simulated_at, player.battery, player.oxygen,
        player.cleanliness, player.integrity,
    ).run();
}

function stationCondition(player: Player): number {
    return Math.floor((
        Number(player.battery) + Number(player.oxygen) + Number(player.cleanliness) + Number(player.integrity)
    ) / 4);
}

async function getState(env: Env, userId: number) {
    await ensurePlayer(env, userId);
    const player = await env.DB.prepare('SELECT * FROM space_station_players WHERE user_id = ?')
        .bind(userId).first<Player>();
    if (!player) throw new Error('Space station player initialization failed.');
    const components = await env.DB.prepare(
        'SELECT component_key, quantity FROM space_station_components WHERE user_id = ?'
    ).bind(userId).all<ComponentRow>();
    await simulateStation(env, player, components.results || []);

    const [updated, rows] = await Promise.all([
        env.DB.prepare('SELECT * FROM space_station_players WHERE user_id = ?').bind(userId).first<Player>(),
        env.DB.prepare('SELECT component_key, quantity FROM space_station_components WHERE user_id = ?')
            .bind(userId).all<ComponentRow>(),
    ]);
    if (!updated) throw new Error('Space station player disappeared after simulation.');
    const quantities = new Map((rows.results || []).map(row => [row.component_key, Number(row.quantity)]));
    const today = chinaDate();
    const stationComponents = COMPONENTS.map(component => {
        const quantity = quantities.get(component.key) || 0;
        return { ...component, quantity, max_quantity: 5, cost: component.baseCost * (quantity + 1) };
    });
    const aggregate = (field: 'power' | 'air' | 'cleaning') =>
        stationComponents.reduce((total, component) => total + component[field] * component.quantity, 0);
    const user = await env.DB.prepare('SELECT points FROM users WHERE id = ? AND use = 1')
        .bind(userId).first<{ points: number }>();
    const batteryCapacity = 100 + stationComponents.reduce(
        (total, component) => total + component.batteryCapacity * component.quantity,
        0,
    );
    return {
        player: {
            ...updated,
            battery_capacity: batteryCapacity,
            community_points: Number(user?.points || 0),
            condition: stationCondition(updated),
            can_claim_contract: updated.contract_claim_date !== today,
        },
        components: stationComponents,
        rates: {
            power: -8 + aggregate('power'),
            oxygen: -3 + aggregate('air'),
            cleanliness: -2 + aggregate('cleaning'),
            technology: quantities.get('research_lab') || 0,
        },
        contract_reward: CONTRACT_REWARD,
        max_offline_hours: MAX_OFFLINE_HOURS,
    };
}

async function parseBody(request: Request): Promise<Record<string, unknown> | null> {
    try {
        const value: unknown = await request.json();
        return value && typeof value === 'object' && !Array.isArray(value)
            ? value as Record<string, unknown>
            : null;
    } catch {
        return null;
    }
}

async function buildComponent(env: Env, state: Awaited<ReturnType<typeof getState>>, body: Record<string, unknown>): Promise<Response> {
    const key = typeof body.component === 'string' ? body.component : '';
    const component = COMPONENTS.find(item => item.key === key);
    if (!component) return jsonRes({ error: '未知的空间站组件。' }, 400);
    const current = state.components.find(item => item.key === key);
    if (!current) throw new Error('Space station component inventory is missing.');
    const cost = Number(current.cost);
    const count = Number(current.quantity);
    if (count >= Number(current.max_quantity)) return jsonRes({ error: '该组件已经达到建造上限。' }, 409);
    const batteryCapacity = 100 + state.components.reduce(
        (total, item) => total + item.batteryCapacity * Number(item.quantity),
        0,
    );
    const token = crypto.randomUUID();
    const result = await env.DB.batch([
        env.DB.prepare(`
            UPDATE space_station_players
            SET credits = credits - ?, battery = MIN(?, battery), last_operation_token = ?
            WHERE user_id = ? AND credits >= ?
              AND EXISTS (
                  SELECT 1 FROM space_station_components
                  WHERE user_id = ? AND component_key = ? AND quantity = ?
              )
        `).bind(cost, batteryCapacity, token, state.player.user_id, cost, state.player.user_id, key, count),
        env.DB.prepare(`
            UPDATE space_station_components SET quantity = quantity + 1, last_operation_token = ?
            WHERE user_id = ? AND component_key = ? AND quantity = ?
              AND EXISTS (
                  SELECT 1 FROM space_station_players
                  WHERE user_id = ? AND last_operation_token = ?
              )
        `).bind(token, state.player.user_id, key, count, state.player.user_id, token),
    ]);
    if (Number(result[0]?.meta?.changes || 0) !== 1 || Number(result[1]?.meta?.changes || 0) !== 1) {
        if (Number(result[1]?.meta?.changes || 0) === 1) {
            throw new Error('Space station credits were debited but component inventory was not updated within a D1 batch.');
        }
        return jsonRes({ error: '星币不足或组件数量已变化，请刷新后重试。' }, 409);
    }
    return jsonRes({ ok: true, notice: `已建造「${component.name}」。`, state: await getState(env, state.player.user_id) });
}

async function maintainStation(env: Env, state: Awaited<ReturnType<typeof getState>>): Promise<Response> {
    const token = crypto.randomUUID();
    const batteryCapacity = Number(state.player.battery_capacity);
    const result = await env.DB.prepare(`
        UPDATE space_station_players
        SET credits = credits - ?, integrity = MIN(100, integrity + 35),
            battery = MIN(?, battery + 15), oxygen = MIN(100, oxygen + 10),
            cleanliness = MIN(100, cleanliness + 30), last_operation_token = ?
        WHERE user_id = ? AND credits >= ? AND (
            integrity < 100 OR battery < ? OR oxygen < 100 OR cleanliness < 100
        )
          AND integrity = ? AND battery = ? AND oxygen = ? AND cleanliness = ?
    `).bind(
        MAINTENANCE_COST, batteryCapacity, token, state.player.user_id, MAINTENANCE_COST, batteryCapacity,
        state.player.integrity, state.player.battery, state.player.oxygen, state.player.cleanliness,
    ).run();
    if (Number(result.meta?.changes || 0) !== 1) {
        const latest = await env.DB.prepare(
            'SELECT battery, oxygen, cleanliness, integrity FROM space_station_players WHERE user_id = ?',
        ).bind(state.player.user_id).first<Pick<Player, 'battery' | 'oxygen' | 'cleanliness' | 'integrity'>>();
        if (latest && Object.entries(latest).some(([key, value]) =>
            Number(value) !== Number(state.player[key as keyof typeof state.player]))) {
            return jsonRes({ error: '空间站状态已变化，请刷新后重试。' }, 409);
        }
        return jsonRes({
            error: Number(state.player.credits) < MAINTENANCE_COST
                ? '星币不足，无法进行维护。'
                : '空间站当前状态良好，无需维护。',
        }, 409);
    }
    return jsonRes({ ok: true, notice: '维护完成，已修复环境与结构。', state: await getState(env, state.player.user_id) });
}

async function claimContract(env: Env, state: Awaited<ReturnType<typeof getState>>): Promise<Response> {
    const today = chinaDate();
    const condition = stationCondition(state.player);
    if (state.player.contract_claim_date === today) return jsonRes({ error: '今日维护合同已经领取。' }, 409);
    if (condition < 60 || Number(state.player.battery) < 35 || Number(state.player.oxygen) < 35
        || Number(state.player.cleanliness) < 35 || Number(state.player.integrity) < 35) {
        return jsonRes({ error: '空间站综合状态需达到 60，且各项状态至少为 35，才能完成维护合同。' }, 409);
    }
    const result = await env.DB.prepare(`
        UPDATE space_station_players
        SET credits = credits + ?, technology = technology + 3, contract_claim_date = ?
        WHERE user_id = ? AND contract_claim_date != ?
          AND battery = ? AND oxygen = ? AND cleanliness = ? AND integrity = ?
    `).bind(
        CONTRACT_REWARD, today, state.player.user_id, today,
        state.player.battery, state.player.oxygen, state.player.cleanliness, state.player.integrity,
    ).run();
    if (Number(result.meta?.changes || 0) !== 1) return jsonRes({ error: '空间站状态已变化，请刷新后重试。' }, 409);
    return jsonRes({ ok: true, notice: `完成维护合同，获得 ${CONTRACT_REWARD} 星币和 3 科技值。`, state: await getState(env, state.player.user_id) });
}

async function exchangeStationCredits(
    env: Env,
    userId: number,
    body: Record<string, unknown>,
): Promise<Response> {
    const points = Number(body.points);
    if (!Number.isSafeInteger(points) || points < 10 || points > MAX_REDEMPTION_POINTS || points % 10 !== 0) {
        return jsonRes({ error: `兑换积分必须是 10 的倍数，且每次不超过 ${MAX_REDEMPTION_POINTS} 积分。` }, 400);
    }
    if (body.resource !== 'credits') return jsonRes({ error: '空间站仅支持兑换建设星币。' }, 400);
    await ensurePlayer(env, userId);
    const token = crypto.randomUUID();
    const amount = points * 2;
    const result = await env.DB.batch([
        env.DB.prepare(`
            UPDATE space_station_players SET credits = credits + ?, last_operation_token = ?
            WHERE user_id = ? AND EXISTS (
                SELECT 1 FROM users WHERE id = ? AND use = 1 AND points >= ?
            )
        `).bind(amount, token, userId, userId, points),
        env.DB.prepare(`
            UPDATE users SET points = points - ?
            WHERE id = ? AND use = 1 AND points >= ?
              AND EXISTS (
                  SELECT 1 FROM space_station_players
                  WHERE user_id = ? AND last_operation_token = ?
              )
        `).bind(points, userId, points, userId, token),
        env.DB.prepare(`
            INSERT INTO game_points_exchanges
                (token, user_id, game_key, resource_key, points_spent, amount_granted)
            SELECT ?, ?, 'space_station', 'credits', ?, ?
            WHERE EXISTS (
                SELECT 1 FROM space_station_players
                WHERE user_id = ? AND last_operation_token = ?
            )
        `).bind(token, userId, points, amount, userId, token),
    ]);
    if (Number(result[0]?.meta?.changes || 0) !== 1) {
        return jsonRes({ error: '积分不足或空间站档案尚未初始化。' }, 409);
    }
    if (Number(result[1]?.meta?.changes || 0) !== 1) {
        throw new Error('Space station credits were granted but points debit failed within a D1 batch.');
    }
    return jsonRes({
        ok: true,
        notice: `已消耗 ${points} 积分，兑换 ${amount} 建设星币。`,
        state: await getState(env, userId),
    });
}

export async function handleSpaceStation(request: Request, env: Env, path: string): Promise<Response> {
    const user = await getSessionUser(env, request);
    if (!user) return jsonRes({ error: '请先登录后管理空间站。' }, 403);
    const userId = Number(user.id);
    if (request.method === 'GET' && path === '/api/space-station/state') {
        return jsonRes({ ok: true, ...(await getState(env, userId)) });
    }
    if (request.method !== 'POST') return jsonRes({ error: '请求方法不支持。' }, 405);
    const body = await parseBody(request);
    if (!body) return jsonRes({ error: '请求内容必须是有效的 JSON 对象。' }, 400);
    if (path === '/api/space-station/exchange') return exchangeStationCredits(env, userId, body);
    const state = await getState(env, userId);
    if (path === '/api/space-station/component/build') return buildComponent(env, state, body);
    if (path === '/api/space-station/maintenance') return maintainStation(env, state);
    if (path === '/api/space-station/contract/claim') return claimContract(env, state);
    return jsonRes({ error: '未知的空间站操作。' }, 404);
}

export async function exchangeGameCurrency(
    env: Env,
    userId: number,
    game: 'frontier' | 'ruins',
    body: Record<string, unknown>,
): Promise<Response> {
    const points = Number(body.points);
    if (!Number.isSafeInteger(points) || points < 10 || points > MAX_REDEMPTION_POINTS || points % 10 !== 0) {
        return jsonRes({ error: `兑换积分必须是 10 的倍数，且每次不超过 ${MAX_REDEMPTION_POINTS} 积分。` }, 400);
    }
    const resource = body.resource;
    const token = crypto.randomUUID();
    let amount: number;
    let resourceName: string;
    let updateResource: TypedD1PreparedStatement;
    if (game === 'frontier') {
        if (resource === 'credits') {
            amount = points * 5;
            resourceName = '信用点';
            updateResource = env.DB.prepare(`
                UPDATE space_game_players SET credits = credits + ?, last_exchange_token = ?
                WHERE user_id = ? AND EXISTS (SELECT 1 FROM users WHERE id = ? AND use = 1 AND points >= ?)
            `).bind(amount, token, userId, userId, points);
        } else if (resource === 'alloy') {
            amount = points;
            resourceName = '合金';
            updateResource = env.DB.prepare(`
                UPDATE space_game_players SET alloy = alloy + ?, last_exchange_token = ?
                WHERE user_id = ? AND EXISTS (SELECT 1 FROM users WHERE id = ? AND use = 1 AND points >= ?)
            `).bind(amount, token, userId, userId, points);
        } else if (resource === 'crystal' && points % 100 === 0) {
            amount = points / 100;
            resourceName = '能源晶体';
            updateResource = env.DB.prepare(`
                UPDATE space_game_players SET crystal = crystal + ?, last_exchange_token = ?
                WHERE user_id = ? AND EXISTS (SELECT 1 FROM users WHERE id = ? AND use = 1 AND points >= ?)
            `).bind(amount, token, userId, userId, points);
        } else if (resource === 'research_points') {
            amount = points / 10;
            resourceName = '研究点';
            updateResource = env.DB.prepare(`
                UPDATE space_game_players SET research_points = research_points + ?, last_exchange_token = ?
                WHERE user_id = ? AND EXISTS (SELECT 1 FROM users WHERE id = ? AND use = 1 AND points >= ?)
            `).bind(amount, token, userId, userId, points);
        } else if (resource === 'energy' && points % 20 === 0) {
            amount = points / 20;
            resourceName = '舰队能量';
            updateResource = env.DB.prepare(`
                UPDATE space_game_players SET energy = energy + ?, last_exchange_token = ?
                WHERE user_id = ? AND energy + ? <= (
                    SELECT 100 + COALESCE(SUM(CASE WHEN technology_key = 'reactor' THEN level * 15 ELSE 0 END), 0)
                    FROM space_game_research WHERE user_id = ?
                ) AND EXISTS (SELECT 1 FROM users WHERE id = ? AND use = 1 AND points >= ?)
            `).bind(amount, token, userId, amount, userId, userId, points);
        } else {
            return jsonRes({ error: '兑换该星际远征资源的积分数不符合比例或资源类型无效。' }, 400);
        }
    } else {
        if (resource === 'gold') {
            amount = points * 2;
            resourceName = '金币';
            updateResource = env.DB.prepare(`
                UPDATE ruins_players SET gold = gold + ?, last_exchange_token = ?
                WHERE user_id = ? AND EXISTS (SELECT 1 FROM users WHERE id = ? AND use = 1 AND points >= ?)
            `).bind(amount, token, userId, userId, points);
        } else if (resource === 'crystals' && points % 100 === 0) {
            amount = points / 100;
            resourceName = '星晶';
            updateResource = env.DB.prepare(`
                UPDATE ruins_players SET crystals = crystals + ?, last_exchange_token = ?
                WHERE user_id = ? AND EXISTS (SELECT 1 FROM users WHERE id = ? AND use = 1 AND points >= ?)
            `).bind(amount, token, userId, userId, points);
        } else if (resource === 'stamina' && points % 50 === 0) {
            amount = points / 50;
            resourceName = '遗迹体力';
            updateResource = env.DB.prepare(`
                UPDATE ruins_players SET stamina = stamina + ?,
                    stamina_updated_at = CASE WHEN stamina + ? >= 10 THEN ? ELSE stamina_updated_at END,
                    last_exchange_token = ?
                WHERE user_id = ? AND stamina + ? <= 10
                  AND EXISTS (SELECT 1 FROM users WHERE id = ? AND use = 1 AND points >= ?)
            `).bind(amount, amount, new Date().toISOString(), token, userId, amount, userId, points);
        } else {
            return jsonRes({ error: '兑换该遗迹远征资源的积分数不符合比例或资源类型无效。' }, 400);
        }
    }

    const playerTable = game === 'frontier' ? 'space_game_players' : 'ruins_players';
    const result = await env.DB.batch([
        updateResource,
        env.DB.prepare(`
            UPDATE users SET points = points - ?
            WHERE id = ? AND use = 1 AND points >= ?
              AND EXISTS (SELECT 1 FROM ${playerTable} WHERE user_id = ? AND last_exchange_token = ?)
        `).bind(points, userId, points, userId, token),
        env.DB.prepare(`
            INSERT INTO game_points_exchanges
                (token, user_id, game_key, resource_key, points_spent, amount_granted)
            SELECT ?, ?, ?, ?, ?, ?
            WHERE EXISTS (SELECT 1 FROM ${playerTable} WHERE user_id = ? AND last_exchange_token = ?)
        `).bind(token, userId, game, String(resource), points, amount, userId, token),
    ]);
    if (Number(result[0]?.meta?.changes || 0) !== 1) {
        return jsonRes({
            error: Number(result[0]?.meta?.changes || 0) === 0
                ? '积分不足，或目标资源已达到上限。'
                : '游戏档案初始化失败。',
        }, 409);
    }
    if (Number(result[1]?.meta?.changes || 0) !== 1) {
        throw new Error('Game resource was granted but points debit failed within a D1 batch.');
    }
    return jsonRes({ ok: true, notice: `已消耗 ${points} 积分，兑换 ${amount} ${resourceName}。` });
}
