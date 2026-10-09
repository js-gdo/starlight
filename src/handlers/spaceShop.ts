import { getSessionUser, jsonRes } from '../utils/auth';
import type { Env, TypedD1PreparedStatement } from '../env.d';

const HOUR_MS = 60 * 60 * 1000;
const MAX_OFFLINE_HOURS = 72;
const MAX_LEVEL = 50;
const MAX_PRICE_MULTIPLIER = 5;

const PRODUCTS = [
    { key: 'moon_cookie', name: '月球曲奇', icon: 'fa-cookie-bite', color: '#e6aa67', category: '星际零食', cost: 8, price: 18, demand: 5, unlockLevel: 1, starterStock: 24, description: '宇航员最爱的家乡味道，周转快、利润稳。' },
    { key: 'holo_drink', name: '全息汽水', icon: 'fa-bottle-water', color: '#58d8e8', category: '星际饮品', cost: 12, price: 27, demand: 4, unlockLevel: 1, starterStock: 18, description: '会随口味变色的气泡饮料，年轻旅客的热门选择。' },
    { key: 'moon_plush', name: '月兔玩偶', icon: 'fa-otter', color: '#f09dc2', category: '纪念收藏', cost: 28, price: 62, demand: 2.4, unlockLevel: 1, starterStock: 10, description: '月球基地限定纪念品，深受游客和收藏家喜爱。' },
    { key: 'star_map', name: '星图明信片', icon: 'fa-map', color: '#9e9af4', category: '纪念收藏', cost: 42, price: 96, demand: 2.2, unlockLevel: 2, starterStock: 0, description: '收录附近星域的精美全息星图。' },
    { key: 'nebula_tea', name: '星云茶饮', icon: 'fa-mug-hot', color: '#8dd3a5', category: '星际饮品', cost: 18, price: 42, demand: 3, unlockLevel: 2, starterStock: 0, description: '用星云花瓣调制的舒缓热饮，补给站必备。' },
    { key: 'crystal_lamp', name: '星晶夜灯', icon: 'fa-lightbulb', color: '#c6a3ff', category: '家居科技', cost: 68, price: 158, demand: 1.5, unlockLevel: 3, starterStock: 0, description: '内置微型星晶，能投射出迷你的银河。' },
    { key: 'rover_kit', name: '探月车模型', icon: 'fa-truck-fast', color: '#f0c46f', category: '模型玩具', cost: 110, price: 258, demand: 1.1, unlockLevel: 4, starterStock: 0, description: '可遥控的微缩探测车，工程师和孩子都爱不释手。' },
    { key: 'alien_seed', name: '外星植物种子', icon: 'fa-seedling', color: '#6dd6ba', category: '稀有生态', cost: 92, price: 225, demand: 0.9, unlockLevel: 5, starterStock: 0, description: '来自远方星球的发光种子，需要细心照料。' },
    { key: 'comet_choco', name: '彗星巧克力', icon: 'fa-candy-cane', color: '#d59671', category: '星际零食', cost: 36, price: 88, demand: 2, unlockLevel: 7, starterStock: 0, description: '零重力工坊制作的彗星造型手工巧克力。' },
    { key: 'drone_pet', name: '陪伴机器人', icon: 'fa-robot', color: '#82b8ff', category: '智能伙伴', cost: 190, price: 460, demand: 0.75, unlockLevel: 10, starterStock: 0, description: '会讲故事、会导航的迷你智能伙伴。' },
    { key: 'aurora_crystal', name: '极光水晶球', icon: 'fa-snowflake', color: '#8cdeef', category: '稀有收藏', cost: 360, price: 890, demand: 0.42, unlockLevel: 15, starterStock: 0, description: '封存着真实极光的稀有收藏品，价值不菲。' },
    { key: 'ancient_artifact', name: '先驱者遗物', icon: 'fa-shapes', color: '#e7c176', category: '古文明珍藏', cost: 780, price: 1980, demand: 0.24, unlockLevel: 22, starterStock: 0, description: '来自失落文明的文物，每件都有独特的故事。' },
] as const;

const UPGRADES = {
    store: { field: 'store_level', name: '扩建店铺', icon: 'fa-store', description: '提升门店等级，扩大客流上限并提高所有商品需求。', baseCost: 360, max: 15, currency: 'credits' },
    decor: { field: 'decor_level', name: '装修陈列', icon: 'fa-palette', description: '升级灯光、全息橱窗与店内陈列，吸引更多顾客。', baseCost: 230, max: 12, currency: 'credits' },
    marketing: { field: 'marketing_level', name: '星际营销', icon: 'fa-bullhorn', description: '投放跨星域广告，让更多旅客发现你的商店。', baseCost: 320, max: 10, currency: 'credits' },
    staff: { field: 'staff_level', name: '雇佣店员', icon: 'fa-user-astronaut', description: '自动化服务团队提高接待效率与每小时成交量。', baseCost: 290, max: 8, currency: 'credits' },
    storage: { field: 'capacity_level', name: '扩建仓库', icon: 'fa-warehouse', description: '增加所有货架的共享库存容量。', baseCost: 260, max: 15, currency: 'credits' },
} as const;

const STARTER_STOCK_TOTAL = PRODUCTS.reduce((total, product) => total + product.starterStock, 0);

type UpgradeKey = keyof typeof UPGRADES;

type ShopPlayer = {
    user_id: number;
    store_name: string;
    level: number;
    experience: number;
    credits: number;
    reputation: number;
    store_level: number;
    decor_level: number;
    marketing_level: number;
    staff_level: number;
    capacity_level: number;
    stock_used: number;
    last_simulated_at: string;
    last_sync_token: string;
    last_action_token: string;
    daily_claim_date: string;
    daily_streak: number;
    quest_claim_date: string;
    total_revenue: number;
    total_units_sold: number;
};

type InventoryRow = {
    product_key: string;
    stock: number;
    price: number;
    lifetime_sold: number;
};

function parseStoredDate(value: string): number {
    const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value)
        ? `${value.replace(' ', 'T')}Z`
        : value;
    return Date.parse(normalized);
}

export function getShopLevelProgress(experience: number, level: number): { current: number; required: number; level: number } {
    return {
        current: experience,
        required: 220 + level * 130,
        level: Math.min(MAX_LEVEL, level),
    };
}

export function getShopPriceBounds(cost: number): { min: number; max: number } {
    return { min: cost, max: cost * MAX_PRICE_MULTIPLIER };
}

function chinaDate(now = new Date()): string {
    return new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function chinaDayNumber(date: string): number {
    return Math.floor(Date.parse(`${date}T00:00:00Z`) / 86400000);
}

function currentQuest(today: string) {
    const quests = [
        { key: 'sell_volume', title: '旅客络绎', description: '今天售出至少 36 件商品。', metric: 'units' as const, target: 36, reward: 220 },
        { key: 'daily_revenue', title: '营业额突破', description: '今天的营业额达到 1,200 星币。', metric: 'revenue' as const, target: 1200, reward: 260 },
        { key: 'featured_goods', title: '人气单品', description: '今天售出至少 10 件今日星域推荐商品。', metric: 'featured' as const, target: 10, reward: 240 },
    ];
    return quests[chinaDayNumber(today) % quests.length];
}

function featuredProduct(today: string) {
    return PRODUCTS[chinaDayNumber(today) % PRODUCTS.length];
}

function xpProgress(level: number, experience: number, gained: number) {
    let nextLevel = level;
    let nextExperience = experience + gained;
    while (nextLevel < MAX_LEVEL) {
        const required = 220 + nextLevel * 130;
        if (nextExperience < required) break;
        nextExperience -= required;
        nextLevel++;
    }
    if (nextLevel >= MAX_LEVEL) nextExperience = 0;
    return { level: nextLevel, experience: nextExperience };
}

async function ensurePlayer(env: Env, userId: number): Promise<void> {
    const statements: TypedD1PreparedStatement[] = [
        env.DB.prepare('INSERT OR IGNORE INTO space_shop_players (user_id, stock_used) VALUES (?, ?)').bind(userId, STARTER_STOCK_TOTAL),
        ...PRODUCTS.map(product => env.DB.prepare(`
            INSERT OR IGNORE INTO space_shop_inventory (user_id, product_key, stock, price)
            VALUES (?, ?, ?, ?)
        `).bind(userId, product.key, product.starterStock, product.price)),
    ];
    await env.DB.batch(statements);
}

async function simulateSales(env: Env, player: ShopPlayer, inventory: InventoryRow[]): Promise<void> {
    const previousTime = parseStoredDate(player.last_simulated_at);
    if (!Number.isFinite(previousTime)) throw new Error('Invalid space shop simulation timestamp.');
    const now = Date.now();
    const hours = Math.min(MAX_OFFLINE_HOURS, Math.floor(Math.max(0, now - previousTime) / HOUR_MS));
    if (hours === 0) return;

    const simulationEnd = now - previousTime >= MAX_OFFLINE_HOURS * HOUR_MS
        ? now
        : previousTime + hours * HOUR_MS;
    const inventoryByKey = new Map(inventory.map(row => [row.product_key, row]));
    const sold = new Map<string, { units: number; revenue: number; soldAt: string }>();
    const dailySales = new Map<string, Map<string, { units: number; revenue: number; soldAt: string }>>();
    let totalUnits = 0;
    let totalRevenue = 0;
    let stockUsed = Number(player.stock_used);

    for (let tick = 1; tick <= hours; tick++) {
        const tickTime = previousTime + tick * HOUR_MS;
        const day = chinaDate(new Date(tickTime));
        const featured = featuredProduct(day).key;
        const daySales = dailySales.get(day) || new Map();
        dailySales.set(day, daySales);
        const dayNumber = chinaDayNumber(day);
        for (const product of PRODUCTS) {
            if (product.unlockLevel > player.level) continue;
            const row = inventoryByKey.get(product.key);
            if (!row || row.stock <= 0) continue;
            const totalShopBoost = 1 + player.marketing_level * 0.09 + player.staff_level * 0.075
                + player.decor_level * 0.025 + player.store_level * 0.035;
            const reputationBoost = 0.72 + Math.max(0, Number(player.reputation)) / 190;
            const priceFactor = Math.max(0.32, Math.min(1.35, 1.6 - (Number(row.price) / product.cost) / 5));
            const eventBoost = featured === product.key ? 1.65 : 1;
            const cyclicalDemand = 0.88 + (((dayNumber + PRODUCTS.indexOf(product)) % 5) * 0.06);
            const demand = product.demand * totalShopBoost * reputationBoost * priceFactor * eventBoost * cyclicalDemand;
            const wholeUnits = Math.floor(demand);
            const requestedUnits = wholeUnits + (Math.random() < demand - wholeUnits ? 1 : 0);
            const units = Math.min(Number(row.stock), requestedUnits);
            if (units <= 0) continue;
            const revenue = units * Number(row.price);
            row.stock -= units;
            row.lifetime_sold += units;
            totalUnits += units;
            totalRevenue += revenue;
            const productTotal = sold.get(product.key) || { units: 0, revenue: 0, soldAt: new Date(tickTime).toISOString() };
            productTotal.units += units;
            productTotal.revenue += revenue;
            sold.set(product.key, productTotal);
            const dayTotal = daySales.get(product.key) || { units: 0, revenue: 0, soldAt: new Date(tickTime).toISOString() };
            dayTotal.units += units;
            dayTotal.revenue += revenue;
            daySales.set(product.key, dayTotal);
        }
    }
    if (totalUnits <= 0) {
        const token = crypto.randomUUID();
        await env.DB.prepare(`
            UPDATE space_shop_players SET last_simulated_at = ?, last_sync_token = ?
            WHERE user_id = ? AND last_simulated_at = ?
        `).bind(new Date(simulationEnd).toISOString(), token, player.user_id, player.last_simulated_at).run();
        return;
    }

    stockUsed = Math.max(0, stockUsed - totalUnits);
    const progress = xpProgress(Number(player.level), Number(player.experience), totalUnits * 2);
    const reputation = Math.min(100, Number(player.reputation) + Math.floor(totalUnits / 45) + 1);
    const token = crypto.randomUUID();
    const statements: TypedD1PreparedStatement[] = [
        env.DB.prepare(`
            UPDATE space_shop_players
            SET credits = credits + ?, experience = ?, level = ?,
                reputation = ?, stock_used = ?, total_revenue = total_revenue + ?,
                total_units_sold = total_units_sold + ?, last_simulated_at = ?,
                last_sync_token = ?
            WHERE user_id = ? AND last_simulated_at = ?
              AND level = ? AND experience = ? AND reputation = ? AND stock_used = ?
        `).bind(
            totalRevenue, progress.experience, progress.level, reputation, stockUsed,
            totalRevenue, totalUnits, new Date(simulationEnd).toISOString(), token,
            player.user_id, player.last_simulated_at, player.level, player.experience,
            player.reputation, player.stock_used,
        ),
        ...Array.from(sold.entries()).map(([productKey, totals]) => env.DB.prepare(`
            UPDATE space_shop_inventory
            SET stock = stock - ?, lifetime_sold = lifetime_sold + ?
            WHERE user_id = ? AND product_key = ? AND stock >= ?
              AND EXISTS (SELECT 1 FROM space_shop_players WHERE user_id = ? AND last_sync_token = ?)
        `).bind(totals.units, totals.units, player.user_id, productKey, totals.units, player.user_id, token)),
        ...Array.from(dailySales.entries()).flatMap(([, products]) =>
            Array.from(products.entries()).map(([productKey, totals]) => env.DB.prepare(`
                INSERT INTO space_shop_sales (user_id, product_key, units, revenue, sold_at, sync_token)
                SELECT ?, ?, ?, ?, ?, ?
                WHERE EXISTS (SELECT 1 FROM space_shop_players WHERE user_id = ? AND last_sync_token = ?)
                ON CONFLICT(user_id, sync_token, product_key) DO NOTHING
            `).bind(
                player.user_id, productKey, totals.units, totals.revenue,
                totals.soldAt, `${token}:${totals.soldAt.slice(0, 10)}`, player.user_id, token,
            )),
        ),
    ];
    const result = await env.DB.batch(statements);
    if (Number(result[0]?.meta?.changes || 0) !== 1) return;
}

async function getShopState(env: Env, userId: number) {
    await ensurePlayer(env, userId);
    let player = await env.DB.prepare('SELECT * FROM space_shop_players WHERE user_id = ?').bind(userId).first<ShopPlayer>();
    if (!player) throw new Error('Space shop player initialization failed.');
    const inventory = await env.DB.prepare(
        'SELECT product_key, stock, price, lifetime_sold FROM space_shop_inventory WHERE user_id = ?'
    ).bind(userId).all<InventoryRow>();
    await simulateSales(env, player, inventory.results || []);

    const [updatedPlayer, updatedInventory, salesRows, chartRows, leaderboardRows] = await Promise.all([
        env.DB.prepare('SELECT * FROM space_shop_players WHERE user_id = ?').bind(userId).first<ShopPlayer>(),
        env.DB.prepare(
            'SELECT product_key, stock, price, lifetime_sold FROM space_shop_inventory WHERE user_id = ?'
        ).bind(userId).all<InventoryRow>(),
        env.DB.prepare(`
            SELECT COALESCE(SUM(units), 0) AS units, COALESCE(SUM(revenue), 0) AS revenue,
                   COALESCE(SUM(CASE WHEN product_key = ? THEN units ELSE 0 END), 0) AS featured_units
            FROM space_shop_sales WHERE user_id = ? AND date(sold_at, '+8 hours') = ?
        `).bind(featuredProduct(chinaDate()).key, userId, chinaDate()).first<any>(),
        env.DB.prepare(`
            SELECT date(sold_at, '+8 hours') AS day, SUM(units) AS units, SUM(revenue) AS revenue
            FROM space_shop_sales
            WHERE user_id = ? AND date(sold_at, '+8 hours') >= date(?, '-6 days')
            GROUP BY date(sold_at, '+8 hours') ORDER BY day
        `).bind(userId, chinaDate()).all<any>(),
        env.DB.prepare(`
            SELECT ranked.user_id, ranked.store_name, ranked.level, ranked.reputation, ranked.total_revenue,
                   ranked.store_level * 400 + ranked.level * 250 + ranked.reputation * 10
                       + ranked.total_units_sold * 2 AS score
            FROM (
                SELECT p.user_id, p.store_name, p.level, p.reputation, p.total_revenue,
                       p.store_level, p.total_units_sold
                FROM space_shop_players p JOIN users u ON u.id = p.user_id
                WHERE u.use = 1
            ) ranked
            ORDER BY score DESC, ranked.total_revenue DESC, ranked.user_id
            LIMIT 20
        `).all<any>(),
    ]);
    if (!updatedPlayer) throw new Error('Space shop player disappeared after sales settlement.');

    const today = chinaDate();
    const quest = currentQuest(today);
    const dailySales = salesRows || { units: 0, revenue: 0, featured_units: 0 };
    const questProgress = quest.metric === 'units'
        ? Number(dailySales.units || 0)
        : quest.metric === 'revenue'
            ? Number(dailySales.revenue || 0)
            : Number(dailySales.featured_units || 0);
    const inventoryByKey = new Map((updatedInventory.results || []).map(row => [row.product_key, row]));
    const products = PRODUCTS.map(product => {
        const row = inventoryByKey.get(product.key);
        const bounds = getShopPriceBounds(product.cost);
        return {
            ...product,
            stock: Number(row?.stock || 0),
            price: Number(row?.price || product.price),
            lifetime_sold: Number(row?.lifetime_sold || 0),
            unlocked: product.unlockLevel <= updatedPlayer.level,
            price_min: bounds.min,
            price_max: bounds.max,
        };
    });
    const capacity = 80 + Number(updatedPlayer.capacity_level) * 60;
    const progress = getShopLevelProgress(Number(updatedPlayer.experience), Number(updatedPlayer.level));
    const upgrades = Object.entries(UPGRADES).map(([key, upgrade]) => {
        const level = Number(updatedPlayer[upgrade.field as keyof ShopPlayer]);
        return {
            key,
            name: upgrade.name,
            icon: upgrade.icon,
            description: upgrade.description,
            level,
            max_level: upgrade.max,
            cost: level >= upgrade.max ? null : Math.ceil(upgrade.baseCost * Math.pow(1.62, level - (key === 'store' || key === 'decor' || key === 'storage' ? 1 : 0))),
        };
    });
    const eventProduct = featuredProduct(today);
    const salesChart = Array.from({ length: 7 }, (_, index) => {
        const date = new Date(Date.parse(`${today}T00:00:00Z`) - (6 - index) * 86400000);
        const day = date.toISOString().slice(0, 10);
        const row = (chartRows.results || []).find((item: any) => item.day === day);
        return { day, units: Number(row?.units || 0), revenue: Number(row?.revenue || 0) };
    });
    return {
        player: {
            ...updatedPlayer,
            xp_required: progress.required,
            xp_progress: Math.min(100, Math.floor(Number(updatedPlayer.experience) / progress.required * 100)),
            inventory_capacity: capacity,
            capacity_remaining: Math.max(0, capacity - Number(updatedPlayer.stock_used)),
            can_claim_daily: updatedPlayer.daily_claim_date !== today,
            daily_quest_claimed: updatedPlayer.quest_claim_date === today,
        },
        products,
        upgrades,
        event: {
            name: '星域人气商品',
            description: `今日推荐：${eventProduct.name}。该商品客流需求提高 65%。`,
            product_key: eventProduct.key,
            product_name: eventProduct.name,
        },
        quest: {
            ...quest,
            progress: Math.min(questProgress, quest.target),
            complete: questProgress >= quest.target,
            claimed: updatedPlayer.quest_claim_date === today,
        },
        sales_chart: salesChart,
        leaderboard: leaderboardRows.results || [],
        max_offline_hours: MAX_OFFLINE_HOURS,
    };
}

async function restockProduct(env: Env, state: Awaited<ReturnType<typeof getShopState>>, body: Record<string, unknown>): Promise<Response> {
    const productKey = typeof body.product === 'string' ? body.product : '';
    const product = PRODUCTS.find(item => item.key === productKey);
    const itemState = state.products.find(item => item.key === productKey);
    if (!product || !itemState) return jsonRes({ error: '找不到该商品。' }, 400);
    if (!itemState.unlocked) return jsonRes({ error: `店铺等级达到 Lv.${product.unlockLevel} 后解锁该商品。` }, 403);
    const quantity = Number(body.quantity);
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 200) {
        return jsonRes({ error: '补货数量必须是 1 到 200 之间的整数。' }, 400);
    }
    if (quantity > Number(state.player.capacity_remaining)) return jsonRes({ error: '仓库空间不足，请先出售库存或升级仓库。' }, 409);
    const dayNumber = chinaDayNumber(chinaDate());
    const supplyFactor = 0.94 + (dayNumber + PRODUCTS.indexOf(product)) % 5 * 0.035;
    const cost = Math.ceil(product.cost * supplyFactor) * quantity;
    const token = crypto.randomUUID();
    const inventoryRow = state.products.find(item => item.key === productKey)!;
    const result = await env.DB.batch([
        env.DB.prepare(`
            UPDATE space_shop_players
            SET credits = credits - ?, stock_used = stock_used + ?, last_action_token = ?
            WHERE user_id = ? AND credits >= ? AND stock_used + ? <= 80 + capacity_level * 60
              AND EXISTS (
                  SELECT 1 FROM space_shop_inventory
                  WHERE user_id = ? AND product_key = ? AND stock = ?
              )
        `).bind(cost, quantity, token, state.player.user_id, cost, quantity, state.player.user_id, productKey, inventoryRow.stock),
        env.DB.prepare(`
            UPDATE space_shop_inventory SET stock = stock + ?, action_token = ?
            WHERE user_id = ? AND product_key = ? AND stock = ?
              AND EXISTS (SELECT 1 FROM space_shop_players WHERE user_id = ? AND last_action_token = ?)
        `).bind(quantity, token, state.player.user_id, productKey, inventoryRow.stock, state.player.user_id, token),
    ]);
    if (Number(result[0]?.meta?.changes || 0) !== 1 || Number(result[1]?.meta?.changes || 0) !== 1) {
        const player = await env.DB.prepare('SELECT credits, stock_used, capacity_level FROM space_shop_players WHERE user_id = ?').bind(state.player.user_id).first<any>();
        return jsonRes({
            error: Number(player?.credits || 0) < cost
                ? '星币不足，无法完成这笔进货。'
                : '库存或仓库容量已变化，请刷新后重试。',
        }, 409);
    }
    return jsonRes({ ok: true, notice: `补充了 ${quantity} 件「${product.name}」，花费 ${cost} 星币。`, state: await getShopState(env, state.player.user_id) });
}

async function updatePrice(env: Env, state: Awaited<ReturnType<typeof getShopState>>, body: Record<string, unknown>): Promise<Response> {
    const key = typeof body.product === 'string' ? body.product : '';
    const product = PRODUCTS.find(item => item.key === key);
    const item = state.products.find(entry => entry.key === key);
    if (!product || !item) return jsonRes({ error: '找不到该商品。' }, 400);
    if (!item.unlocked) return jsonRes({ error: '该商品尚未解锁。' }, 403);
    const price = Number(body.price);
    const bounds = getShopPriceBounds(product.cost);
    if (!Number.isSafeInteger(price) || price < bounds.min || price > bounds.max) {
        return jsonRes({ error: `售价必须在 ${bounds.min} 至 ${bounds.max} 星币之间。` }, 400);
    }
    const result = await env.DB.prepare(`
        UPDATE space_shop_inventory SET price = ?
        WHERE user_id = ? AND product_key = ? AND price = ?
    `).bind(price, state.player.user_id, key, item.price).run();
    if (Number(result.meta?.changes || 0) !== 1) return jsonRes({ error: '售价已被其他操作修改，请刷新后重试。' }, 409);
    return jsonRes({ ok: true, notice: `「${product.name}」售价已调整为 ${price} 星币。`, state: await getShopState(env, state.player.user_id) });
}

async function upgradeShop(env: Env, state: Awaited<ReturnType<typeof getShopState>>, body: Record<string, unknown>): Promise<Response> {
    const key = typeof body.upgrade === 'string' ? body.upgrade : '';
    if (!Object.hasOwn(UPGRADES, key)) return jsonRes({ error: '未知的店铺升级。' }, 400);
    const upgrade = UPGRADES[key as UpgradeKey];
    const current = Number(state.player[upgrade.field as keyof ShopPlayer]);
    if (current >= upgrade.max) return jsonRes({ error: '该设施已达到最高等级。' }, 409);
    const cost = Math.ceil(upgrade.baseCost * Math.pow(1.62, current - (key === 'store' || key === 'decor' || key === 'storage' ? 1 : 0)));
    const token = crypto.randomUUID();
    const result = await env.DB.prepare(`
        UPDATE space_shop_players
        SET ${upgrade.field} = ${upgrade.field} + 1, credits = credits - ?, last_action_token = ?
        WHERE user_id = ? AND ${upgrade.field} = ? AND credits >= ?
    `).bind(cost, token, state.player.user_id, current, cost).run();
    if (Number(result.meta?.changes || 0) !== 1) return jsonRes({ error: '星币不足，或店铺状态已变化。' }, 409);
    return jsonRes({ ok: true, notice: `${upgrade.name}升级至 Lv.${current + 1}，客流与经营能力得到提升。`, state: await getShopState(env, state.player.user_id) });
}

async function renameShop(env: Env, state: Awaited<ReturnType<typeof getShopState>>, body: Record<string, unknown>): Promise<Response> {
    const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
    if (!name || Array.from(name).length > 24 || /[\u0000-\u001f\u007f]/.test(name)) {
        return jsonRes({ error: '店名需为 1 至 24 个字符，且不能包含控制字符。' }, 400);
    }
    await env.DB.prepare('UPDATE space_shop_players SET store_name = ? WHERE user_id = ?').bind(name, state.player.user_id).run();
    return jsonRes({ ok: true, notice: `门店已更名为「${name}」。`, state: await getShopState(env, state.player.user_id) });
}

async function claimDaily(env: Env, state: Awaited<ReturnType<typeof getShopState>>): Promise<Response> {
    const today = chinaDate();
    const yesterday = chinaDate(new Date(Date.now() - 86400000));
    const result = await env.DB.prepare(`
        UPDATE space_shop_players
        SET daily_streak = CASE WHEN daily_claim_date = ? THEN MIN(daily_streak + 1, 30) ELSE 1 END,
            credits = credits + 180 + 40 * CASE WHEN daily_claim_date = ? THEN MIN(daily_streak + 1, 30) ELSE 1 END,
            experience = ?, level = ?, reputation = MIN(100, reputation + 2),
            daily_claim_date = ?
        WHERE user_id = ? AND daily_claim_date != ?
          AND level = ? AND experience = ?
    `).bind(
        yesterday, yesterday,
        xpProgress(Number(state.player.level), Number(state.player.experience), 25).experience,
        xpProgress(Number(state.player.level), Number(state.player.experience), 25).level,
        today, state.player.user_id, today, state.player.level, state.player.experience,
    ).run();
    if (Number(result.meta?.changes || 0) !== 1) return jsonRes({ error: '今日的开店补给已领取，明天再来。' }, 409);
    return jsonRes({ ok: true, notice: '领取了星币、经验和声望补给。', state: await getShopState(env, state.player.user_id) });
}

async function claimQuest(env: Env, state: Awaited<ReturnType<typeof getShopState>>): Promise<Response> {
    if (state.quest.claimed) return jsonRes({ error: '今日星域订单已经领取。' }, 409);
    if (!state.quest.complete) return jsonRes({ error: '今日星域订单尚未完成，继续经营以达成目标。' }, 409);
    const progress = xpProgress(Number(state.player.level), Number(state.player.experience), 35);
    const today = chinaDate();
    const result = await env.DB.prepare(`
        UPDATE space_shop_players
        SET quest_claim_date = ?, credits = credits + ?, experience = ?, level = ?,
            reputation = MIN(100, reputation + 3)
        WHERE user_id = ? AND quest_claim_date != ? AND level = ? AND experience = ?
    `).bind(
        today, state.quest.reward, progress.experience, progress.level,
        state.player.user_id, today, state.player.level, state.player.experience,
    ).run();
    if (Number(result.meta?.changes || 0) !== 1) return jsonRes({ error: '订单状态已变化，请刷新后重试。' }, 409);
    return jsonRes({ ok: true, notice: `完成「${state.quest.title}」，获得 ${state.quest.reward} 星币和 35 经验。`, state: await getShopState(env, state.player.user_id) });
}

async function parseBody(request: Request): Promise<Record<string, unknown> | null> {
    try {
        const value: unknown = await request.json();
        return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
    } catch {
        return null;
    }
}

export async function handleSpaceShop(request: Request, env: Env, path: string): Promise<Response> {
    const user = await getSessionUser(env, request);
    if (!user) return jsonRes({ error: '请先登录后再进入星际商店。' }, 403);
    if (request.method === 'GET' && path === '/api/space-shop/state') {
        return jsonRes({ ok: true, ...(await getShopState(env, Number(user.id))) });
    }
    if (request.method !== 'POST') return jsonRes({ error: '请求方法不支持。' }, 405);
    const body = await parseBody(request);
    if (!body) return jsonRes({ error: '请求内容必须是有效的 JSON 对象。' }, 400);
    const state = await getShopState(env, Number(user.id));
    if (path === '/api/space-shop/inventory/restock') return restockProduct(env, state, body);
    if (path === '/api/space-shop/inventory/price') return updatePrice(env, state, body);
    if (path === '/api/space-shop/upgrade') return upgradeShop(env, state, body);
    if (path === '/api/space-shop/store/name') return renameShop(env, state, body);
    if (path === '/api/space-shop/daily/claim') return claimDaily(env, state);
    if (path === '/api/space-shop/quest/claim') return claimQuest(env, state);
    return jsonRes({ error: '未知的星际商店操作。' }, 404);
}
