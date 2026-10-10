import { getSessionUser, jsonRes } from '../utils/auth';
import type { Env, TypedD1PreparedStatement } from '../env.d';
import { exchangeGameCurrency } from './spaceStation';

const HOUR_MS = 60 * 60 * 1000;
const ENERGY_INTERVAL_MS = 10 * 60 * 1000;
const OFFLINE_CAP_HOURS = 48;
const BUILDING_LEVEL_CAP = 25;
const MAX_EXPEDITION_SLOTS = 3;

const BUILDINGS = [
    { key: 'alloy_mine', name: '合金矿场', icon: 'fa-industry', description: '开采建造舰队所需的合金。', baseRate: 24, resource: 'alloy', cost: { credits: 140, alloy: 70, crystal: 0 } },
    { key: 'credit_works', name: '轨道工厂', icon: 'fa-gears', description: '制造信用点，支撑持续扩建。', baseRate: 35, resource: 'credits', cost: { credits: 120, alloy: 50, crystal: 0 } },
    { key: 'crystal_extractor', name: '晶体采集器', icon: 'fa-gem', description: '从小行星带提炼稀有能源晶体。', baseRate: 5, resource: 'crystal', cost: { credits: 220, alloy: 100, crystal: 25 } },
    { key: 'research_lab', name: '科研中心', icon: 'fa-atom', description: '持续产出研究点数，解锁长期科技。', baseRate: 2, resource: 'research_points', cost: { credits: 260, alloy: 120, crystal: 55 } },
    { key: 'shipyard', name: '远征船坞', icon: 'fa-shuttle-space', description: '扩建船坞以解锁远方星域和更多远征位。', baseRate: 0, resource: '', cost: { credits: 320, alloy: 180, crystal: 80 } },
] as const;

const TECHNOLOGIES = [
    { key: 'industrial', name: '纳米冶炼', icon: 'fa-microchip', description: '每级提升所有资源与研究产出 8%。', maxLevel: 10, baseResearch: 35, baseCrystal: 20 },
    { key: 'deep_scan', name: '深空扫描', icon: 'fa-satellite-dish', description: '每级提升远征收益 12%。', maxLevel: 10, baseResearch: 45, baseCrystal: 35 },
    { key: 'reactor', name: '聚变反应堆', icon: 'fa-bolt', description: '每级增加 15 点能量上限。', maxLevel: 8, baseResearch: 55, baseCrystal: 50 },
    { key: 'navigation', name: '跃迁导航', icon: 'fa-compass', description: '解锁危险星域与远古遗迹。', maxLevel: 5, baseResearch: 70, baseCrystal: 65 },
] as const;

const SECTORS = [
    { key: 'orbit', name: '近地轨道', icon: 'fa-earth-asia', description: '低风险短途巡查，适合稳定补给。', hangarLevel: 1, navigationLevel: 0, durationMinutes: 5, energyCost: 10, rewards: { credits: [90, 145], alloy: [38, 64], crystal: [5, 10], research: [5, 9] } },
    { key: 'nebula', name: '绯红星云', icon: 'fa-cloud', description: '穿越辐射云层，带回更多稀有材料。', hangarLevel: 2, navigationLevel: 0, durationMinutes: 30, energyCost: 22, rewards: { credits: [240, 390], alloy: [110, 180], crystal: [22, 38], research: [18, 32] } },
    { key: 'asteroid', name: '幽影小行星带', icon: 'fa-meteor', description: '深入密集矿带，风险与收益同步上升。', hangarLevel: 4, navigationLevel: 1, durationMinutes: 120, energyCost: 38, rewards: { credits: [520, 840], alloy: [300, 480], crystal: [65, 105], research: [55, 90] } },
    { key: 'ruins', name: '先驱者遗迹', icon: 'fa-landmark', description: '追踪失落文明信标，寻找珍贵科技。', hangarLevel: 7, navigationLevel: 3, durationMinutes: 480, energyCost: 55, rewards: { credits: [1100, 1750], alloy: [620, 980], crystal: [170, 270], research: [180, 290] } },
] as const;

type ResourceCost = { credits: number; alloy: number; crystal: number; research_points?: number };
type PlayerRow = {
    user_id: number;
    credits: number;
    alloy: number;
    crystal: number;
    research_points: number;
    energy: number;
    energy_updated_at: string;
    last_resource_at: string;
    last_daily_claim: string;
    daily_streak: number;
};

function dateValue(value: string | null | undefined, fallback: number): number {
    const sqliteDate = value && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value)
        ? `${value.replace(' ', 'T')}Z`
        : value;
    const parsed = sqliteDate ? Date.parse(sqliteDate) : Number.NaN;
    return Number.isFinite(parsed) ? parsed : fallback;
}

function upgradeCost(cost: { credits: number; alloy: number; crystal: number }, currentLevel: number): ResourceCost {
    const multiplier = Math.pow(1.48, Math.max(0, currentLevel - 1));
    return {
        credits: Math.ceil(cost.credits * multiplier),
        alloy: Math.ceil(cost.alloy * multiplier),
        crystal: Math.ceil(cost.crystal * multiplier),
    };
}

async function ensureGamePlayer(env: Env, userId: number): Promise<void> {
    const statements: TypedD1PreparedStatement[] = [
        env.DB.prepare('INSERT OR IGNORE INTO space_game_players (user_id) VALUES (?)').bind(userId),
        ...BUILDINGS.map(building =>
            env.DB.prepare(
                'INSERT OR IGNORE INTO space_game_buildings (user_id, building_key, level) VALUES (?, ?, 1)'
            ).bind(userId, building.key)
        ),
        ...TECHNOLOGIES.map(technology =>
            env.DB.prepare(
                'INSERT OR IGNORE INTO space_game_research (user_id, technology_key, level) VALUES (?, ?, 0)'
            ).bind(userId, technology.key)
        ),
    ];
    await env.DB.batch(statements);
}

async function syncOfflineProgress(env: Env, userId: number): Promise<void> {
    const [player, buildingRows, researchRows] = await Promise.all([
        env.DB.prepare('SELECT * FROM space_game_players WHERE user_id = ?').bind(userId).first<PlayerRow>(),
        env.DB.prepare('SELECT building_key, level FROM space_game_buildings WHERE user_id = ?').bind(userId).all<{ building_key: string; level: number }>(),
        env.DB.prepare('SELECT technology_key, level FROM space_game_research WHERE user_id = ?').bind(userId).all<{ technology_key: string; level: number }>(),
    ]);
    if (!player) throw new Error('Space game player initialization failed.');

    const now = Date.now();
    const buildingLevels = new Map((buildingRows.results || []).map(row => [row.building_key, Number(row.level)]));
    const researchLevels = new Map((researchRows.results || []).map(row => [row.technology_key, Number(row.level)]));
    const resourceStart = dateValue(player.last_resource_at, now);
    const energyStart = dateValue(player.energy_updated_at, resourceStart);
    const elapsedHours = Math.min(OFFLINE_CAP_HOURS, Math.floor(Math.max(0, now - resourceStart) / HOUR_MS));
    const industrialMultiplier = 1 + (researchLevels.get('industrial') || 0) * 0.08;
    const production: Record<string, number> = { credits: 0, alloy: 0, crystal: 0, research_points: 0 };
    for (const building of BUILDINGS) {
        if (building.resource) {
            production[building.resource] += Math.floor(building.baseRate * (buildingLevels.get(building.key) || 0) * industrialMultiplier);
        }
    }

    const energyCap = 100 + (researchLevels.get('reactor') || 0) * 15;
    const energy = Number(player.energy);
    const energyTicks = energy < energyCap
        ? Math.floor(Math.max(0, now - energyStart) / ENERGY_INTERVAL_MS)
        : 0;
    const nextEnergy = Math.min(energyCap, energy + energyTicks);
    const resetFullEnergyClock = energy >= energyCap && now - energyStart >= ENERGY_INTERVAL_MS;
    const nextResourceAt = elapsedHours >= OFFLINE_CAP_HOURS
        ? now
        : resourceStart + elapsedHours * HOUR_MS;
    const nextEnergyAt = energyTicks > 0
        ? nextEnergy >= energyCap ? now : energyStart + energyTicks * ENERGY_INTERVAL_MS
        : resetFullEnergyClock ? now : energyStart;
    if (elapsedHours === 0 && energyTicks === 0 && !resetFullEnergyClock) return;

    await env.DB.prepare(`
        UPDATE space_game_players
        SET credits = credits + ?,
            alloy = alloy + ?,
            crystal = crystal + ?,
            research_points = research_points + ?,
            energy = ?,
            last_resource_at = ?,
            energy_updated_at = ?
        WHERE user_id = ? AND last_resource_at = ? AND energy_updated_at = ?
    `).bind(
        production.credits * elapsedHours,
        production.alloy * elapsedHours,
        production.crystal * elapsedHours,
        production.research_points * elapsedHours,
        nextEnergy,
        new Date(nextResourceAt).toISOString(),
        new Date(nextEnergyAt).toISOString(),
        userId,
        player.last_resource_at,
        player.energy_updated_at,
    ).run();
}

async function prepareGame(env: Env, userId: number): Promise<void> {
    await ensureGamePlayer(env, userId);
    await syncOfflineProgress(env, userId);
}

function randomBetween(min: number, max: number): number {
    const buffer = new Uint32Array(1);
    crypto.getRandomValues(buffer);
    return min + (buffer[0] % (max - min + 1));
}

async function getGameState(env: Env, userId: number): Promise<Record<string, unknown>> {
    await prepareGame(env, userId);
    const [player, buildingRows, researchRows, expeditionRows, userRow] = await Promise.all([
        env.DB.prepare('SELECT * FROM space_game_players WHERE user_id = ?').bind(userId).first<PlayerRow>(),
        env.DB.prepare('SELECT building_key, level FROM space_game_buildings WHERE user_id = ?').bind(userId).all<{ building_key: string; level: number }>(),
        env.DB.prepare('SELECT technology_key, level FROM space_game_research WHERE user_id = ?').bind(userId).all<{ technology_key: string; level: number }>(),
        env.DB.prepare(`
            SELECT id, sector_key, sector_name, started_at, ends_at, energy_cost,
                   reward_credits, reward_alloy, reward_crystal, reward_research, status
            FROM space_game_expeditions
            WHERE user_id = ? AND status = 'active'
            ORDER BY id DESC
            LIMIT 12
        `).bind(userId).all<any>(),
        env.DB.prepare('SELECT points FROM users WHERE id = ?').bind(userId).first<{ points: number }>(),
    ]);
    if (!player) throw new Error('Space game player state is missing.');

    const buildings = new Map((buildingRows.results || []).map(row => [row.building_key, Number(row.level)]));
    const technologies = new Map((researchRows.results || []).map(row => [row.technology_key, Number(row.level)]));
    const industrialMultiplier = 1 + (technologies.get('industrial') || 0) * 0.08;
    const rates = { credits: 0, alloy: 0, crystal: 0, research_points: 0 };
    const structureList = BUILDINGS.map(building => {
        const level = buildings.get(building.key) || 0;
        if (building.resource) rates[building.resource] += Math.floor(building.baseRate * level * industrialMultiplier);
        return {
            key: building.key,
            name: building.name,
            icon: building.icon,
            description: building.description,
            level,
            level_cap: BUILDING_LEVEL_CAP,
            production: building.resource ? Math.floor(building.baseRate * level * industrialMultiplier) : 0,
            resource: building.resource,
            next_cost: level < BUILDING_LEVEL_CAP ? upgradeCost(building.cost, level) : null,
        };
    });
    const researchList = TECHNOLOGIES.map(technology => {
        const level = technologies.get(technology.key) || 0;
        const costMultiplier = Math.pow(1.62, level);
        return {
            key: technology.key,
            name: technology.name,
            icon: technology.icon,
            description: technology.description,
            level,
            max_level: technology.maxLevel,
            next_cost: level < technology.maxLevel ? {
                research_points: Math.ceil(technology.baseResearch * costMultiplier),
                crystal: Math.ceil(technology.baseCrystal * costMultiplier),
            } : null,
        };
    });
    const shipyardLevel = buildings.get('shipyard') || 1;
    const activeExpeditions = (expeditionRows.results || []).filter(row => row.status === 'active').length;
    const expeditionSlots = Math.min(MAX_EXPEDITION_SLOTS, 1 + Math.floor(Math.max(0, shipyardLevel - 1) / 3));
    const today = new Date().toISOString().slice(0, 10);

    return {
        player: {
            credits: Number(player.credits),
            alloy: Number(player.alloy),
            crystal: Number(player.crystal),
            research_points: Number(player.research_points),
            energy: Number(player.energy),
            energy_cap: 100 + (technologies.get('reactor') || 0) * 15,
            daily_streak: Number(player.daily_streak),
            last_daily_claim: player.last_daily_claim,
            can_claim_daily: player.last_daily_claim !== today,
            community_points: Number(userRow?.points || 0),
        },
        production: rates,
        buildings: structureList,
        technologies: researchList,
        expedition_slots: { active: activeExpeditions, max: expeditionSlots },
        sectors: SECTORS.map(sector => ({
            key: sector.key,
            name: sector.name,
            icon: sector.icon,
            description: sector.description,
            duration_minutes: sector.durationMinutes,
            energy_cost: sector.energyCost,
            required_shipyard: sector.hangarLevel,
            required_navigation: sector.navigationLevel,
            unlocked: shipyardLevel >= sector.hangarLevel && (technologies.get('navigation') || 0) >= sector.navigationLevel,
        })),
        expeditions: (expeditionRows.results || []).map(row => ({
            id: Number(row.id),
            sector_key: row.sector_key,
            sector_name: row.sector_name,
            started_at: row.started_at,
            ends_at: row.ends_at,
            energy_cost: Number(row.energy_cost),
            status: row.status,
            rewards: {
                credits: Number(row.reward_credits),
                alloy: Number(row.reward_alloy),
                crystal: Number(row.reward_crystal),
                research_points: Number(row.reward_research),
            },
            ready_to_claim: row.status === 'active' && Date.parse(row.ends_at) <= Date.now(),
        })),
    };
}

async function parseJsonBody(request: Request): Promise<Record<string, unknown> | null> {
    try {
        const value = await request.json();
        return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
    } catch {
        return null;
    }
}

async function upgradeBuilding(env: Env, userId: number, body: Record<string, unknown>): Promise<Response> {
    const building = BUILDINGS.find(item => item.key === body.building);
    if (!building) return jsonRes({ error: '未知的空间站设施。' }, 400);
    await prepareGame(env, userId);
    const row = await env.DB.prepare(
        'SELECT level FROM space_game_buildings WHERE user_id = ? AND building_key = ?'
    ).bind(userId, building.key).first<{ level: number }>();
    if (!row) return jsonRes({ error: '设施尚未建造。' }, 404);
    const level = Number(row.level);
    if (level >= BUILDING_LEVEL_CAP) return jsonRes({ error: '设施已达到最高等级。' }, 409);
    const cost = upgradeCost(building.cost, level);
    const upgradeToken = crypto.randomUUID();
    const statements: TypedD1PreparedStatement[] = [
        env.DB.prepare(`
            UPDATE space_game_buildings
            SET level = level + 1, last_upgrade_token = ?
            WHERE user_id = ? AND building_key = ? AND level = ?
              AND EXISTS (
                  SELECT 1 FROM space_game_players
                  WHERE user_id = ? AND credits >= ? AND alloy >= ? AND crystal >= ?
              )
        `).bind(upgradeToken, userId, building.key, level, userId, cost.credits, cost.alloy, cost.crystal),
        env.DB.prepare(
            `UPDATE space_game_players
             SET credits = credits - ?, alloy = alloy - ?, crystal = crystal - ?, last_resource_at = ?
             WHERE user_id = ? AND credits >= ? AND alloy >= ? AND crystal >= ?
               AND EXISTS (
                   SELECT 1 FROM space_game_buildings
                   WHERE user_id = ? AND building_key = ? AND last_upgrade_token = ?
               )`
        ).bind(
            cost.credits, cost.alloy, cost.crystal, new Date().toISOString(),
            userId, cost.credits, cost.alloy, cost.crystal, userId, building.key, upgradeToken,
        ),
    ];
    const result = await env.DB.batch(statements);
    if (Number(result[0]?.meta?.changes || 0) !== 1) return jsonRes({ error: '资源不足或设施状态已变化，请刷新后重试。' }, 409);
    return jsonRes({ ok: true, state: await getGameState(env, userId) });
}

async function upgradeTechnology(env: Env, userId: number, body: Record<string, unknown>): Promise<Response> {
    const technology = TECHNOLOGIES.find(item => item.key === body.technology);
    if (!technology) return jsonRes({ error: '未知科技。' }, 400);
    await prepareGame(env, userId);
    const row = await env.DB.prepare(
        'SELECT level FROM space_game_research WHERE user_id = ? AND technology_key = ?'
    ).bind(userId, technology.key).first<{ level: number }>();
    if (!row) return jsonRes({ error: '科技尚未开放。' }, 404);
    const level = Number(row.level);
    if (level >= technology.maxLevel) return jsonRes({ error: '科技已达到最高等级。' }, 409);
    const multiplier = Math.pow(1.62, level);
    const researchCost = Math.ceil(technology.baseResearch * multiplier);
    const crystalCost = Math.ceil(technology.baseCrystal * multiplier);
    const upgradeToken = crypto.randomUUID();
    const statements: TypedD1PreparedStatement[] = [
        env.DB.prepare(`
            UPDATE space_game_research
            SET level = level + 1, last_upgrade_token = ?
            WHERE user_id = ? AND technology_key = ? AND level = ?
              AND EXISTS (
                  SELECT 1 FROM space_game_players
                  WHERE user_id = ? AND research_points >= ? AND crystal >= ?
              )
        `).bind(upgradeToken, userId, technology.key, level, userId, researchCost, crystalCost),
        env.DB.prepare(
            `UPDATE space_game_players
             SET research_points = research_points - ?, crystal = crystal - ?, last_resource_at = ?
             WHERE user_id = ? AND research_points >= ? AND crystal >= ?
               AND EXISTS (
                   SELECT 1 FROM space_game_research
                   WHERE user_id = ? AND technology_key = ? AND last_upgrade_token = ?
               )`
        ).bind(
            researchCost, crystalCost, new Date().toISOString(),
            userId, researchCost, crystalCost, userId, technology.key, upgradeToken,
        ),
    ];
    const result = await env.DB.batch(statements);
    if (Number(result[0]?.meta?.changes || 0) !== 1) return jsonRes({ error: '研究点数或晶体不足，请积累资源后重试。' }, 409);
    return jsonRes({ ok: true, state: await getGameState(env, userId) });
}

async function launchExpedition(env: Env, userId: number, body: Record<string, unknown>): Promise<Response> {
    const sector = SECTORS.find(item => item.key === body.sector);
    if (!sector) return jsonRes({ error: '未知的探索星域。' }, 400);
    await prepareGame(env, userId);
    const [shipyard, navigation] = await Promise.all([
        env.DB.prepare(
            "SELECT level FROM space_game_buildings WHERE user_id = ? AND building_key = 'shipyard'"
        ).bind(userId).first<{ level: number }>(),
        env.DB.prepare(
            "SELECT level FROM space_game_research WHERE user_id = ? AND technology_key = 'navigation'"
        ).bind(userId).first<{ level: number }>(),
    ]);
    if (Number(shipyard?.level || 0) < sector.hangarLevel || Number(navigation?.level || 0) < sector.navigationLevel) {
        return jsonRes({ error: '尚未满足该星域的船坞等级或跃迁导航要求。' }, 403);
    }

    const deepScan = await env.DB.prepare(
        "SELECT level FROM space_game_research WHERE user_id = ? AND technology_key = 'deep_scan'"
    ).bind(userId).first<{ level: number }>();
    const rewardMultiplier = 1 + Number(deepScan?.level || 0) * 0.12;
    const reward = {
        credits: Math.floor(randomBetween(sector.rewards.credits[0], sector.rewards.credits[1]) * rewardMultiplier),
        alloy: Math.floor(randomBetween(sector.rewards.alloy[0], sector.rewards.alloy[1]) * rewardMultiplier),
        crystal: Math.floor(randomBetween(sector.rewards.crystal[0], sector.rewards.crystal[1]) * rewardMultiplier),
        research: Math.floor(randomBetween(sector.rewards.research[0], sector.rewards.research[1]) * rewardMultiplier),
    };
    const now = Date.now();
    const startedAt = new Date(now).toISOString();
    const endsAt = new Date(now + sector.durationMinutes * 60 * 1000).toISOString();
    const launchToken = crypto.randomUUID();
    const maxSlots = Math.min(MAX_EXPEDITION_SLOTS, 1 + Math.floor(Math.max(0, Number(shipyard?.level || 1) - 1) / 3));
    const statements: TypedD1PreparedStatement[] = [
        env.DB.prepare(`
            INSERT INTO space_game_expeditions
                (user_id, sector_key, sector_name, started_at, ends_at, energy_cost,
                 reward_credits, reward_alloy, reward_crystal, reward_research, status, launch_token)
            SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?
            WHERE EXISTS (
                SELECT 1 FROM space_game_players
                WHERE user_id = ? AND energy >= ?
            )
            AND (SELECT COUNT(*) FROM space_game_expeditions WHERE user_id = ? AND status = 'active') < ?
        `).bind(
            userId, sector.key, sector.name, startedAt, endsAt, sector.energyCost,
            reward.credits, reward.alloy, reward.crystal, reward.research, launchToken,
            userId, sector.energyCost, userId, maxSlots,
        ),
        env.DB.prepare(`
            UPDATE space_game_players SET energy = energy - ?
            WHERE user_id = ? AND EXISTS (
                SELECT 1 FROM space_game_expeditions
                WHERE launch_token = ? AND user_id = ?
            )
        `).bind(sector.energyCost, userId, launchToken, userId),
    ];
    const result = await env.DB.batch(statements);
    if (Number(result[0]?.meta?.changes || 0) !== 1) {
        const current = await env.DB.prepare('SELECT energy FROM space_game_players WHERE user_id = ?').bind(userId).first<{ energy: number }>();
        if (Number(current?.energy || 0) < sector.energyCost) return jsonRes({ error: '能量不足，等待恢复后再出发。' }, 409);
        return jsonRes({ error: '远征船位已满，先领取已完成的远征奖励。' }, 409);
    }
    return jsonRes({ ok: true, state: await getGameState(env, userId) });
}

async function claimExpedition(env: Env, userId: number, body: Record<string, unknown>): Promise<Response> {
    const expeditionId = Number(body.expedition_id);
    if (!Number.isSafeInteger(expeditionId) || expeditionId <= 0) return jsonRes({ error: '远征编号无效。' }, 400);
    await prepareGame(env, userId);
    const claimToken = crypto.randomUUID();
    const claimedAt = new Date().toISOString();
    const statements: TypedD1PreparedStatement[] = [
        env.DB.prepare(`
            UPDATE space_game_expeditions
            SET status = 'claimed', claim_token = ?, claimed_at = ?
            WHERE id = ? AND user_id = ? AND status = 'active' AND ends_at <= ?
        `).bind(claimToken, claimedAt, expeditionId, userId, claimedAt),
        env.DB.prepare(`
            UPDATE space_game_players
            SET credits = credits + (SELECT reward_credits FROM space_game_expeditions WHERE id = ? AND user_id = ? AND claim_token = ?),
                alloy = alloy + (SELECT reward_alloy FROM space_game_expeditions WHERE id = ? AND user_id = ? AND claim_token = ?),
                crystal = crystal + (SELECT reward_crystal FROM space_game_expeditions WHERE id = ? AND user_id = ? AND claim_token = ?),
                research_points = research_points + (SELECT reward_research FROM space_game_expeditions WHERE id = ? AND user_id = ? AND claim_token = ?)
            WHERE user_id = ? AND EXISTS (
                SELECT 1 FROM space_game_expeditions WHERE id = ? AND user_id = ? AND claim_token = ?
            )
        `).bind(
            expeditionId, userId, claimToken, expeditionId, userId, claimToken,
            expeditionId, userId, claimToken, expeditionId, userId, claimToken,
            userId, expeditionId, userId, claimToken,
        ),
    ];
    const result = await env.DB.batch(statements);
    if (Number(result[0]?.meta?.changes || 0) !== 1) {
        const expedition = await env.DB.prepare(
            'SELECT status, ends_at FROM space_game_expeditions WHERE id = ? AND user_id = ?'
        ).bind(expeditionId, userId).first<{ status: string; ends_at: string }>();
        if (!expedition) return jsonRes({ error: '找不到这次远征。' }, 404);
        return jsonRes({ error: expedition.status === 'claimed' ? '这次远征奖励已经领取。' : '远征尚未完成。' }, 409);
    }
    return jsonRes({ ok: true, state: await getGameState(env, userId) });
}

async function claimDailyReward(env: Env, userId: number): Promise<Response> {
    await prepareGame(env, userId);
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 24 * HOUR_MS).toISOString().slice(0, 10);
    const result = await env.DB.prepare(`
        UPDATE space_game_players
        SET daily_streak = CASE WHEN last_daily_claim = ? THEN MIN(daily_streak + 1, 30) ELSE 1 END,
            credits = credits + 100 + 20 * CASE WHEN last_daily_claim = ? THEN MIN(daily_streak + 1, 30) ELSE 1 END,
            alloy = alloy + 45,
            crystal = crystal + 5 + CASE WHEN last_daily_claim = ? THEN MIN(daily_streak + 1, 30) ELSE 1 END,
            research_points = research_points + 10,
            last_daily_claim = ?
        WHERE user_id = ? AND last_daily_claim != ?
    `).bind(yesterday, yesterday, yesterday, today, userId, today).run();
    if (Number(result.meta?.changes || 0) !== 1) return jsonRes({ error: '今日补给已经领取，明天再来。' }, 409);
    return jsonRes({ ok: true, state: await getGameState(env, userId) });
}

async function getGameLeaderboard(env: Env): Promise<Response> {
    const rows = await env.DB.prepare(`
        SELECT ranked.user_id, ranked.username, ranked.building_levels,
               ranked.technology_levels, ranked.completed_expeditions,
               ranked.daily_streak,
               ranked.building_levels * 100 + ranked.technology_levels * 180
                   + ranked.completed_expeditions * 40 + ranked.daily_streak * 25 AS score
        FROM (
            SELECT p.user_id, u.username,
                   COALESCE((SELECT SUM(level) FROM space_game_buildings b WHERE b.user_id = p.user_id), 0) AS building_levels,
                   COALESCE((SELECT SUM(level) FROM space_game_research r WHERE r.user_id = p.user_id), 0) AS technology_levels,
                   COALESCE((SELECT COUNT(*) FROM space_game_expeditions e WHERE e.user_id = p.user_id AND e.status = 'claimed'), 0) AS completed_expeditions,
                   p.daily_streak
            FROM space_game_players p
            JOIN users u ON u.id = p.user_id
            WHERE u.use = 1
        ) ranked
        ORDER BY score DESC, ranked.completed_expeditions DESC, ranked.user_id
        LIMIT 20
    `).all<any>();
    return jsonRes({ standings: rows.results || [] });
}

export async function handleGame(request: Request, env: Env, path: string): Promise<Response> {
    const user = await getSessionUser(env, request);
    if (!user) return jsonRes({ error: '请先登录后再进入星际边境。' }, 403);
    if (request.method === 'GET' && path === '/api/game/leaderboard') return getGameLeaderboard(env);
    if (request.method === 'GET' && path === '/api/game/state') {
        return jsonRes({ ok: true, ...(await getGameState(env, user.id)) });
    }
    if (request.method !== 'POST') return jsonRes({ error: '请求方法不支持。' }, 405);

    if (path === '/api/game/daily/claim') return claimDailyReward(env, user.id);
    const body = await parseJsonBody(request);
    if (!body) return jsonRes({ error: '请求内容必须是有效的 JSON 对象。' }, 400);
    if (path === '/api/game/exchange') {
        await prepareGame(env, Number(user.id));
        return exchangeGameCurrency(env, Number(user.id), 'frontier', body);
    }
    if (path === '/api/game/building/upgrade') return upgradeBuilding(env, user.id, body);
    if (path === '/api/game/research/upgrade') return upgradeTechnology(env, user.id, body);
    if (path === '/api/game/expedition/launch') return launchExpedition(env, user.id, body);
    if (path === '/api/game/expedition/claim') return claimExpedition(env, user.id, body);
    return jsonRes({ error: '未知的星际边境操作。' }, 404);
}
