import { getSessionUser, jsonRes } from '../utils/auth';
import type { Env, TypedD1PreparedStatement } from '../env.d';

type ItemKind = 'loot' | 'material' | 'medicine' | 'weapon' | 'backpack' | 'armor' | 'crystal';
type ItemDefinition = {
    key: string;
    name: string;
    kind: ItemKind;
    tier: number;
    value: number;
    price: number;
    weight: number;
    maxDurability?: number;
    description: string;
};
type InventoryRow = {
    id: number;
    item_key: string;
    quantity: number;
    durability: number;
    max_durability: number;
    charges: number;
};
type PlayerRow = {
    user_id: number;
    star_coins: number;
    star_crystals: number;
    last_action_token: string;
};
type RunRow = {
    id: number;
    user_id: number;
    zone: 'safe' | 'chaos';
    x: number;
    y: number;
    health: number;
    max_health: number;
    turn: number;
    status: 'active' | 'extracted' | 'dead';
    map_json: string;
    cargo_json: string;
    kit_json: string;
    started_at: string;
};
type CargoItem = {
    key: string;
    quantity: number;
    durability: number;
    maxDurability: number;
    charges: number;
};
type MapObject = {
    id: string;
    x: number;
    y: number;
    kind: 'server' | 'safe' | 'medical' | 'supply' | 'enemy' | 'extract';
    name: string;
    searched?: boolean;
    defeated?: boolean;
    health?: number;
    maxHealth?: number;
    attack?: number;
    loot?: CargoItem[];
};
type CraftRecipe = {
    category: 'crystal' | 'backpack' | 'weapon' | 'armor' | 'medicine';
    categoryName: string;
    key: string;
    name: string;
    minutes: number;
    requirements: Record<string, number>;
    quantity: number;
};

const ITEMS: Record<string, ItemDefinition> = {};

function addItem(item: ItemDefinition): void {
    ITEMS[item.key] = item;
}

[
    { key: 'circuit_board', name: '电路板', kind: 'material' as const, tier: 1, value: 38, weight: 1, description: '常见电子零件，可用于制造。' },
    { key: 'fiber_bundle', name: '合成纤维', kind: 'material' as const, tier: 1, value: 32, weight: 1, description: '轻型合成纤维，可用于制造背包与药品。' },
    { key: 'alloy_plate', name: '合金板', kind: 'material' as const, tier: 1, value: 45, weight: 2, description: '坚固的金属材料，可用于制造装备。' },
    { key: 'med_gel', name: '医疗凝胶', kind: 'material' as const, tier: 1, value: 48, weight: 1, description: '未加工的生物医疗材料。' },
    { key: 'quantum_cell', name: '量子电芯', kind: 'material' as const, tier: 2, value: 95, weight: 1, description: '高能电子元件，可制造星晶与高级武器。' },
    { key: 'data_core', name: '加密数据核', kind: 'loot' as const, tier: 2, value: 125, weight: 1, description: '服务器容器常见的高价值数据核心。' },
    { key: 'antique_relic', name: '先驱者遗物', kind: 'loot' as const, tier: 4, value: 360, weight: 2, description: '空间站旧保险箱中的稀有收藏品。' },
    { key: 'void_artifact', name: '虚空典藏品', kind: 'loot' as const, tier: 6, value: 820, weight: 2, description: '混乱区保险箱才可能出现的珍稀收藏品。' },
].forEach(item => addItem({ ...item, price: 0 }));

addItem({
    key: 'medkit', name: '急救包', kind: 'medicine', tier: 1, value: 0, price: 80, weight: 2,
    description: '对局中使用可恢复 45 点生命值。',
});
addItem({
    key: 'star_crystal', name: '星晶', kind: 'crystal', tier: 1, value: 0, price: 45, weight: 1,
    description: '制造材料或购买武器充能；对局内的星晶必须成功撤离才能带出。',
});

for (let tier = 1; tier <= 6; tier++) {
    const multiplier = Math.pow(1.72, tier - 1);
    addItem({
        key: `backpack_${tier}`, name: `${tier} 级探索背包`, kind: 'backpack', tier,
        value: Math.ceil(260 * multiplier), price: Math.ceil(320 * multiplier), weight: 0,
        description: `负重上限 ${12 + tier * 6}。`,
    });
    addItem({
        key: `weapon_${tier}`, name: `${tier} 级脉冲武器`, kind: 'weapon', tier,
        value: Math.ceil(360 * multiplier), price: Math.ceil(440 * multiplier), weight: 3,
        description: `每次攻击消耗 1 点武器充能；伤害 ${10 + tier * 7}。`,
    });
    addItem({
        key: `armor_${tier}`, name: `${tier} 级复合护甲`, kind: 'armor', tier,
        value: Math.ceil(300 * multiplier), price: Math.ceil(390 * multiplier), weight: 4,
        maxDurability: 45 + tier * 9, description: `耐久 ${45 + tier * 9}，提供 ${tier * 3} 点护甲减伤。`,
    });
}

const RECIPES: CraftRecipe[] = [
    { category: 'crystal', categoryName: '星晶制造商', key: 'star_crystal', name: '星晶 ×3', minutes: 10, requirements: { quantum_cell: 2, circuit_board: 2 }, quantity: 3 },
    { category: 'backpack', categoryName: '背包制造商', key: 'backpack_1', name: '1 级探索背包', minutes: 8, requirements: { fiber_bundle: 3, alloy_plate: 1 }, quantity: 1 },
    { category: 'backpack', categoryName: '背包制造商', key: 'backpack_2', name: '2 级探索背包', minutes: 18, requirements: { fiber_bundle: 4, alloy_plate: 3, circuit_board: 1 }, quantity: 1 },
    { category: 'backpack', categoryName: '背包制造商', key: 'backpack_3', name: '3 级探索背包', minutes: 35, requirements: { fiber_bundle: 6, alloy_plate: 4, quantum_cell: 1 }, quantity: 1 },
    { category: 'backpack', categoryName: '背包制造商', key: 'backpack_4', name: '4 级探索背包', minutes: 65, requirements: { fiber_bundle: 8, alloy_plate: 6, quantum_cell: 2 }, quantity: 1 },
    { category: 'backpack', categoryName: '背包制造商', key: 'backpack_5', name: '5 级探索背包', minutes: 110, requirements: { fiber_bundle: 10, alloy_plate: 8, quantum_cell: 3 }, quantity: 1 },
    { category: 'backpack', categoryName: '背包制造商', key: 'backpack_6', name: '6 级探索背包', minutes: 180, requirements: { fiber_bundle: 12, alloy_plate: 10, quantum_cell: 5 }, quantity: 1 },
    { category: 'weapon', categoryName: '武器制造商', key: 'weapon_1', name: '1 级脉冲武器', minutes: 10, requirements: { circuit_board: 3, alloy_plate: 2 }, quantity: 1 },
    { category: 'weapon', categoryName: '武器制造商', key: 'weapon_2', name: '2 级脉冲武器', minutes: 22, requirements: { circuit_board: 4, alloy_plate: 3, quantum_cell: 1 }, quantity: 1 },
    { category: 'weapon', categoryName: '武器制造商', key: 'weapon_3', name: '3 级脉冲武器', minutes: 42, requirements: { circuit_board: 6, alloy_plate: 4, quantum_cell: 2 }, quantity: 1 },
    { category: 'weapon', categoryName: '武器制造商', key: 'weapon_4', name: '4 级脉冲武器', minutes: 75, requirements: { circuit_board: 8, alloy_plate: 7, quantum_cell: 3 }, quantity: 1 },
    { category: 'weapon', categoryName: '武器制造商', key: 'weapon_5', name: '5 级脉冲武器', minutes: 125, requirements: { circuit_board: 10, alloy_plate: 9, quantum_cell: 4 }, quantity: 1 },
    { category: 'weapon', categoryName: '武器制造商', key: 'weapon_6', name: '6 级脉冲武器', minutes: 200, requirements: { circuit_board: 12, alloy_plate: 12, quantum_cell: 6 }, quantity: 1 },
    { category: 'armor', categoryName: '护甲制造商', key: 'armor_1', name: '1 级复合护甲', minutes: 10, requirements: { alloy_plate: 3, fiber_bundle: 2 }, quantity: 1 },
    { category: 'armor', categoryName: '护甲制造商', key: 'armor_2', name: '2 级复合护甲', minutes: 22, requirements: { alloy_plate: 4, fiber_bundle: 3, circuit_board: 1 }, quantity: 1 },
    { category: 'armor', categoryName: '护甲制造商', key: 'armor_3', name: '3 级复合护甲', minutes: 42, requirements: { alloy_plate: 6, fiber_bundle: 4, quantum_cell: 1 }, quantity: 1 },
    { category: 'armor', categoryName: '护甲制造商', key: 'armor_4', name: '4 级复合护甲', minutes: 75, requirements: { alloy_plate: 8, fiber_bundle: 6, quantum_cell: 2 }, quantity: 1 },
    { category: 'armor', categoryName: '护甲制造商', key: 'armor_5', name: '5 级复合护甲', minutes: 125, requirements: { alloy_plate: 10, fiber_bundle: 8, quantum_cell: 3 }, quantity: 1 },
    { category: 'armor', categoryName: '护甲制造商', key: 'armor_6', name: '6 级复合护甲', minutes: 200, requirements: { alloy_plate: 12, fiber_bundle: 10, quantum_cell: 5 }, quantity: 1 },
    { category: 'medicine', categoryName: '药品制造商', key: 'medkit', name: '急救包 ×2', minutes: 6, requirements: { med_gel: 2, fiber_bundle: 1 }, quantity: 2 },
];

const ZONES = {
    safe: { name: '安全区', entryValue: 0, enemyHealth: [30, 42], enemyAttack: [7, 11], lootTier: [1, 3] },
    chaos: { name: '混乱区', entryValue: 2400, enemyHealth: [65, 92], enemyAttack: [15, 23], lootTier: [3, 6] },
} as const;

const INITIAL_INVENTORY = [
    { key: 'backpack_1', quantity: 1, durability: 0, maxDurability: 0, charges: 0 },
    { key: 'weapon_1', quantity: 1, durability: 0, maxDurability: 0, charges: 6 },
    { key: 'armor_1', quantity: 1, durability: 54, maxDurability: 54, charges: 0 },
    { key: 'medkit', quantity: 3, durability: 0, maxDurability: 0, charges: 0 },
    { key: 'circuit_board', quantity: 3, durability: 0, maxDurability: 0, charges: 0 },
    { key: 'fiber_bundle', quantity: 3, durability: 0, maxDurability: 0, charges: 0 },
    { key: 'alloy_plate', quantity: 2, durability: 0, maxDurability: 0, charges: 0 },
];

function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function item(itemKey: string): ItemDefinition {
    const result = ITEMS[itemKey];
    if (!result) throw new Error(`Unknown salvage item: ${itemKey}`);
    return result;
}

function safeJson<T>(value: string, fallback: T): T {
    if (!value) return fallback;
    try {
        return JSON.parse(value) as T;
    } catch (error) {
        console.error('[salvage] Failed to parse persisted game state.', error);
        throw new Error('The saved salvage game state is invalid.');
    }
}

function dateAfterMinutes(minutes: number): string {
    return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

async function ensurePlayer(env: Env, userId: number): Promise<void> {
    const statements: TypedD1PreparedStatement[] = [
        env.DB.prepare('INSERT OR IGNORE INTO salvage_players (user_id) VALUES (?)').bind(userId),
        ...INITIAL_INVENTORY.map(entry => env.DB.prepare(`
            INSERT INTO salvage_inventory (user_id, item_key, quantity, durability, max_durability, charges)
            SELECT ?, ?, ?, ?, ?, ?
            WHERE EXISTS (SELECT 1 FROM salvage_players WHERE user_id = ? AND starter_granted = 0)
        `).bind(userId, entry.key, entry.quantity, entry.durability, entry.maxDurability, entry.charges, userId)),
        env.DB.prepare('UPDATE salvage_players SET starter_granted = 1 WHERE user_id = ? AND starter_granted = 0').bind(userId),
    ];
    await env.DB.batch(statements);
}

async function getPlayer(env: Env, userId: number): Promise<PlayerRow> {
    const player = await env.DB.prepare('SELECT * FROM salvage_players WHERE user_id = ?')
        .bind(userId).first<PlayerRow>();
    if (!player) throw new Error('Salvage player initialization failed.');
    return player;
}

function mapLoot(kind: MapObject['kind'], zone: RunRow['zone']): CargoItem[] {
    const multiplier = zone === 'chaos' ? 1.7 : 1;
    const materials = ['circuit_board', 'fiber_bundle', 'alloy_plate', 'med_gel', 'quantum_cell'];
    const collectibles = zone === 'chaos'
        ? ['antique_relic', 'void_artifact', 'data_core']
        : ['data_core', 'antique_relic'];
    const pick = (keys: string[]) => keys[randomInt(0, keys.length - 1)];
    const stack = (key: string, quantity: number): CargoItem => ({
        key, quantity, durability: 0, maxDurability: 0, charges: 0,
    });

    if (kind === 'server') {
        const electronic = zone === 'chaos' ? ['circuit_board', 'data_core', 'quantum_cell'] : ['circuit_board', 'data_core', 'circuit_board'];
        return [stack(pick(electronic), randomInt(1, zone === 'chaos' ? 3 : 2))];
    }
    if (kind === 'safe') {
        const key = pick(collectibles);
        return [stack(key, 1), ...(Math.random() < 0.7 ? [stack(pick(materials), 1)] : [])];
    }
    if (kind === 'medical') {
        return [stack(Math.random() < 0.55 ? 'med_gel' : 'medkit', randomInt(1, 2))];
    }
    const material = pick(materials);
    const loot = [stack(material, randomInt(1, Math.ceil(2 * multiplier)))];
    if (zone === 'chaos' && Math.random() < 0.3) loot.push(stack('star_crystal', 1));
    return loot;
}

function createMap(zone: RunRow['zone']): MapObject[] {
    const objects: MapObject[] = [{ id: 'extract', x: 5, y: 5, kind: 'extract', name: '撤离点' }];
    const occupied = new Set(['0,0', '5,5']);
    const place = (object: Omit<MapObject, 'x' | 'y'>) => {
        let x = 0;
        let y = 0;
        do {
            x = randomInt(0, 5);
            y = randomInt(0, 5);
        } while (occupied.has(`${x},${y}`));
        occupied.add(`${x},${y}`);
        objects.push({ ...object, x, y });
    };
    for (let index = 0; index < 4; index++) {
        const kind = index === 0 ? 'safe' : index < 3 ? 'server' : 'supply';
        place({
            id: `container-${index + 1}`, kind,
            name: kind === 'safe' ? '保险箱' : kind === 'server' ? '服务器容器' : '补给箱',
            searched: false, loot: mapLoot(kind, zone),
        });
    }
    for (let index = 0; index < 2; index++) {
        place({
            id: `medical-${index + 1}`, kind: 'medical', name: '医疗柜',
            searched: false, loot: mapLoot('medical', zone),
        });
    }
    const enemyCount = zone === 'chaos' ? 7 : 4;
    for (let index = 0; index < enemyCount; index++) {
        const bounds = ZONES[zone];
        const health = randomInt(bounds.enemyHealth[0], bounds.enemyHealth[1]);
        place({
            id: `enemy-${index + 1}`, kind: 'enemy',
            name: zone === 'chaos' ? '混乱区武装守卫' : '空间站巡逻机',
            defeated: false, health, maxHealth: health,
            attack: randomInt(bounds.enemyAttack[0], bounds.enemyAttack[1]),
            loot: enemyLoot(zone),
        });
    }
    return objects;
}

function enemyLoot(zone: RunRow['zone']): CargoItem[] {
    const gearTier = zone === 'chaos' ? randomInt(3, 6) : randomInt(1, 2);
    const drops: CargoItem[] = [];
    if (Math.random() < (zone === 'chaos' ? 0.65 : 0.35)) {
        const gearKind = (['backpack', 'weapon', 'armor'] as const)[randomInt(0, 2)];
        const key = `${gearKind}_${gearTier}`;
        const maxDurability = item(key).maxDurability || 0;
        const durability = gearKind === 'armor' ? Math.ceil(maxDurability * (0.55 + Math.random() * 0.45)) : 0;
        drops.push({ key, quantity: 1, durability, maxDurability, charges: gearKind === 'weapon' ? randomInt(2, 5) : 0 });
    } else {
        drops.push({
            key: 'star_crystal', quantity: randomInt(1, zone === 'chaos' ? 3 : 1),
            durability: 0, maxDurability: 0, charges: 0,
        });
    }
    return drops;
}

function totalWeight(cargo: CargoItem[]): number {
    return cargo.reduce((total, entry) => total + item(entry.key).weight * entry.quantity, 0);
}

function mergeCargo(cargo: CargoItem[], incoming: CargoItem[]): CargoItem[] {
    const merged = cargo.map(entry => ({ ...entry }));
    for (const entry of incoming) {
        const definition = item(entry.key);
        const stack = definition.kind !== 'weapon' && definition.kind !== 'armor' && definition.kind !== 'backpack';
        const existing = stack ? merged.find(value => value.key === entry.key) : undefined;
        if (existing) existing.quantity += entry.quantity;
        else merged.push({ ...entry });
    }
    return merged;
}

function parseBody(request: Request): Promise<Record<string, unknown> | null> {
    return request.json().then((value: unknown) =>
        value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
    ).catch(() => null);
}

async function getState(env: Env, userId: number) {
    await ensurePlayer(env, userId);
    const [player, inventory, activeRun, crafting, history] = await Promise.all([
        getPlayer(env, userId),
        env.DB.prepare('SELECT id, item_key, quantity, durability, max_durability, charges FROM salvage_inventory WHERE user_id = ? ORDER BY item_key, id')
            .bind(userId).all<InventoryRow>(),
        env.DB.prepare("SELECT * FROM salvage_runs WHERE user_id = ? AND status = 'active' LIMIT 1")
            .bind(userId).first<RunRow>(),
        env.DB.prepare("SELECT * FROM salvage_crafting WHERE user_id = ? AND status = 'running' ORDER BY category")
            .bind(userId).all<any>(),
        env.DB.prepare("SELECT zone, status, started_at, ended_at FROM salvage_runs WHERE user_id = ? AND status != 'active' ORDER BY id DESC LIMIT 8")
            .bind(userId).all<any>(),
    ]);
    const items = (inventory.results || []).map(row => ({ ...row, ...item(row.item_key) }));
    let run = null;
    if (activeRun) {
        const objects = safeJson<MapObject[]>(activeRun.map_json, []);
        const cargo = safeJson<CargoItem[]>(activeRun.cargo_json, []);
        const kit = safeJson<{ backpack: CargoItem; weapon: CargoItem; armor: CargoItem; capacity: number }>(activeRun.kit_json, {
            backpack: { key: '', quantity: 0, durability: 0, maxDurability: 0, charges: 0 },
            weapon: { key: '', quantity: 0, durability: 0, maxDurability: 0, charges: 0 },
            armor: { key: '', quantity: 0, durability: 0, maxDurability: 0, charges: 0 },
            capacity: 0,
        });
        run = {
            id: activeRun.id, zone: activeRun.zone, x: activeRun.x, y: activeRun.y,
            health: activeRun.health, max_health: activeRun.max_health, turn: activeRun.turn,
            started_at: activeRun.started_at,
            capacity: kit.capacity, cargo_weight: totalWeight(cargo),
            cargo: cargo.map(entry => ({ ...entry, ...item(entry.key) })),
            backpack: { ...kit.backpack, ...item(kit.backpack.key), durability: kit.backpack.durability },
            weapon: { ...kit.weapon, ...item(kit.weapon.key), durability: kit.weapon.durability },
            armor: { ...kit.armor, ...item(kit.armor.key), durability: kit.armor.durability },
            objects: objects.map(({ loot, ...object }) => object),
            current_object: publicMapObject(objects.find(object => object.x === activeRun.x && object.y === activeRun.y) || null),
        };
    }
    const now = Date.now();
    const jobs = (crafting.results || []).map(job => ({
        ...job,
        recipe: RECIPES.find(recipe => recipe.category === job.category && recipe.key === job.item_key),
        ready: Date.parse(job.finishes_at) <= now,
    }));
    const totalEquipmentValue = items.reduce((sum, entry) =>
        ['backpack', 'weapon', 'armor'].includes(entry.kind) ? sum + entry.value * entry.quantity : sum, 0);
    return {
        ok: true,
        player: {
            star_coins: Number(player.star_coins),
            star_crystals: Number(player.star_crystals),
            total_equipment_value: totalEquipmentValue,
        },
        items,
        recipes: RECIPES,
        jobs,
        run,
        history: history.results || [],
        zones: {
            safe: { name: ZONES.safe.name, entry_value: 0, enemy_description: '敌人较弱，基础物资较常见。' },
            chaos: { name: ZONES.chaos.name, entry_value: ZONES.chaos.entryValue, enemy_description: '高价值装备门槛；敌人更强，收藏品与高级装备掉率更高。' },
        },
    };
}

function publicMapObject(object: MapObject | null): Omit<MapObject, 'loot'> | null {
    if (!object) return null;
    const { loot: _hiddenLoot, ...publicObject } = object;
    return publicObject;
}

async function purchase(env: Env, player: PlayerRow, body: Record<string, unknown>): Promise<Response> {
    const key = String(body.item || '');
    const definition = ITEMS[key];
    if (!definition || !['backpack', 'weapon', 'armor'].includes(definition.kind)) {
        return jsonRes({ error: '请选择有效的背包、武器或护甲。' }, 400);
    }
    const quantity = 1;
    if (player.star_coins < definition.price) return jsonRes({ error: '星币不足。' }, 409);
    const token = crypto.randomUUID();
    const result = await env.DB.batch([
        env.DB.prepare(`
            UPDATE salvage_players SET star_coins = star_coins - ?, last_action_token = ?
            WHERE user_id = ? AND last_action_token = ? AND star_coins >= ?
              AND NOT EXISTS (SELECT 1 FROM salvage_runs WHERE user_id = ? AND status = 'active')
        `).bind(definition.price, token, player.user_id, player.last_action_token, definition.price, player.user_id),
        env.DB.prepare(`
            INSERT INTO salvage_inventory (user_id, item_key, quantity, durability, max_durability, charges)
            SELECT ?, ?, ?, ?, ?, 0 FROM salvage_players
            WHERE user_id = ? AND last_action_token = ?
        `).bind(
            player.user_id, key, quantity, definition.maxDurability || 0, definition.maxDurability || 0,
            player.user_id, token,
        ),
    ]);
    if (Number(result[0]?.meta?.changes || 0) !== 1) return jsonRes({ error: '星币不足、正在对局，或档案已更新，请刷新后重试。' }, 409);
    return jsonRes({ ok: true, notice: `已购买${definition.name}。`, state: await getState(env, player.user_id) });
}

async function buySupplies(env: Env, player: PlayerRow, body: Record<string, unknown>): Promise<Response> {
    const key = String(body.item || '');
    const definition = ITEMS[key];
    const quantity = Number(body.quantity);
    if (!definition || !['medkit', 'star_crystal'].includes(key) || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 50) {
        return jsonRes({ error: '请选择急救包或星晶，并填写 1 至 50 的整数数量。' }, 400);
    }
    if (key === 'star_crystal') {
        const result = await env.DB.prepare(`
            UPDATE salvage_players SET star_coins = star_coins - ?, star_crystals = star_crystals + ?, last_action_token = ?
            WHERE user_id = ? AND last_action_token = ? AND star_coins >= ?
              AND NOT EXISTS (SELECT 1 FROM salvage_runs WHERE user_id = ? AND status = 'active')
        `).bind(
            definition.price * quantity, quantity, crypto.randomUUID(),
            player.user_id, player.last_action_token, definition.price * quantity, player.user_id,
        ).run();
        if (Number(result.meta?.changes || 0) !== 1) return jsonRes({ error: '星币不足、正在对局，或档案已更新，请刷新后重试。' }, 409);
    } else {
        const token = crypto.randomUUID();
        const result = await env.DB.batch([
            env.DB.prepare(`
                UPDATE salvage_players SET star_coins = star_coins - ?, last_action_token = ?
                WHERE user_id = ? AND last_action_token = ? AND star_coins >= ?
                  AND NOT EXISTS (SELECT 1 FROM salvage_runs WHERE user_id = ? AND status = 'active')
            `).bind(definition.price * quantity, token, player.user_id, player.last_action_token, definition.price * quantity, player.user_id),
            env.DB.prepare(`
                INSERT INTO salvage_inventory (user_id, item_key, quantity)
                SELECT ?, ?, ? FROM salvage_players WHERE user_id = ? AND last_action_token = ?
            `).bind(player.user_id, key, quantity, player.user_id, token),
        ]);
        if (Number(result[0]?.meta?.changes || 0) !== 1) return jsonRes({ error: '星币不足、正在对局，或档案已更新，请刷新后重试。' }, 409);
    }
    return jsonRes({ ok: true, notice: `已购买 ${quantity} ${definition.name}。`, state: await getState(env, player.user_id) });
}

async function chargeWeapon(env: Env, player: PlayerRow, body: Record<string, unknown>): Promise<Response> {
    const id = Number(body.item_id);
    const crystals = Number(body.crystals);
    const weapon = await env.DB.prepare('SELECT * FROM salvage_inventory WHERE id = ? AND user_id = ?')
        .bind(id, player.user_id).first<InventoryRow>();
    if (!weapon || item(weapon.item_key).kind !== 'weapon' || !Number.isSafeInteger(crystals) || crystals < 1 || crystals > 50) {
        return jsonRes({ error: '请选择有效的武器，并输入 1 至 50 个星晶。' }, 400);
    }
    if (player.star_crystals < crystals) return jsonRes({ error: '星晶不足。' }, 409);
    const token = crypto.randomUUID();
    const result = await env.DB.batch([
        env.DB.prepare(`
            UPDATE salvage_players SET star_crystals = star_crystals - ?, last_action_token = ?
            WHERE user_id = ? AND last_action_token = ? AND star_crystals >= ?
              AND NOT EXISTS (SELECT 1 FROM salvage_runs WHERE user_id = ? AND status = 'active')
        `).bind(crystals, token, player.user_id, player.last_action_token, crystals, player.user_id),
        env.DB.prepare(`
            UPDATE salvage_inventory SET charges = charges + ?
            WHERE id = ? AND user_id = ? AND item_key = ? AND EXISTS
                (SELECT 1 FROM salvage_players WHERE user_id = ? AND last_action_token = ?)
        `).bind(crystals * 3, id, player.user_id, weapon.item_key, player.user_id, token),
    ]);
    if (Number(result[0]?.meta?.changes || 0) !== 1 || Number(result[1]?.meta?.changes || 0) !== 1) {
        return jsonRes({ error: '星晶不足、正在对局，或武器已变化，请刷新后重试。' }, 409);
    }
    return jsonRes({ ok: true, notice: `消耗 ${crystals} 星晶，为武器增加 ${crystals * 3} 次充能。`, state: await getState(env, player.user_id) });
}

async function sellLoot(env: Env, player: PlayerRow, body: Record<string, unknown>): Promise<Response> {
    const id = Number(body.item_id);
    const quantity = Number(body.quantity);
    const row = await env.DB.prepare('SELECT * FROM salvage_inventory WHERE id = ? AND user_id = ?')
        .bind(id, player.user_id).first<InventoryRow>();
    if (!row || item(row.item_key).kind !== 'loot' && item(row.item_key).kind !== 'material') {
        return jsonRes({ error: '只有仓库中的收藏品和收集材料可以出售。' }, 400);
    }
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > Number(row.quantity)) {
        return jsonRes({ error: '出售数量无效。' }, 400);
    }
    const earned = item(row.item_key).value * quantity;
    const token = crypto.randomUUID();
    const result = await env.DB.batch([
        env.DB.prepare(`
            UPDATE salvage_players SET star_coins = star_coins + ?, last_action_token = ?
            WHERE user_id = ? AND last_action_token = ?
              AND NOT EXISTS (SELECT 1 FROM salvage_runs WHERE user_id = ? AND status = 'active')
              AND EXISTS (SELECT 1 FROM salvage_inventory WHERE id = ? AND user_id = ? AND quantity >= ?)
        `).bind(earned, token, player.user_id, player.last_action_token, player.user_id, id, player.user_id, quantity),
        quantity === Number(row.quantity)
            ? env.DB.prepare(`
                DELETE FROM salvage_inventory WHERE id = ? AND user_id = ? AND quantity >= ?
                  AND EXISTS (SELECT 1 FROM salvage_players WHERE user_id = ? AND last_action_token = ?)
            `).bind(id, player.user_id, quantity, player.user_id, token)
            : env.DB.prepare(`
                UPDATE salvage_inventory SET quantity = quantity - ?
                WHERE id = ? AND user_id = ? AND quantity >= ?
                  AND EXISTS (SELECT 1 FROM salvage_players WHERE user_id = ? AND last_action_token = ?)
            `).bind(quantity, id, player.user_id, quantity, player.user_id, token),
    ]);
    if (Number(result[0]?.meta?.changes || 0) !== 1 || Number(result[1]?.meta?.changes || 0) !== 1) {
        return jsonRes({ error: '物品或仓库状态已变化，请刷新后重试。' }, 409);
    }
    return jsonRes({ ok: true, notice: `出售成功，获得 ${earned} 星币。`, state: await getState(env, player.user_id) });
}

async function repairArmor(env: Env, player: PlayerRow, body: Record<string, unknown>): Promise<Response> {
    const id = Number(body.item_id);
    const armor = await env.DB.prepare('SELECT * FROM salvage_inventory WHERE id = ? AND user_id = ?')
        .bind(id, player.user_id).first<InventoryRow>();
    if (!armor || item(armor.item_key).kind !== 'armor') return jsonRes({ error: '请选择仓库中的护甲。' }, 400);
    if (armor.durability >= armor.max_durability) return jsonRes({ error: '这件护甲目前不需要维修。' }, 409);
    const capacityLoss = Math.max(1, Math.ceil(armor.max_durability * 0.08));
    const newMaximum = Math.max(10, armor.max_durability - capacityLoss);
    const cost = Math.max(20, (armor.max_durability - armor.durability) * 4);
    if (player.star_coins < cost) return jsonRes({ error: '星币不足，无法维修。' }, 409);
    const token = crypto.randomUUID();
    const result = await env.DB.batch([
        env.DB.prepare(`
            UPDATE salvage_players SET star_coins = star_coins - ?, last_action_token = ?
            WHERE user_id = ? AND last_action_token = ? AND star_coins >= ?
              AND NOT EXISTS (SELECT 1 FROM salvage_runs WHERE user_id = ? AND status = 'active')
        `).bind(cost, token, player.user_id, player.last_action_token, cost, player.user_id),
        env.DB.prepare(`
            UPDATE salvage_inventory SET durability = ?, max_durability = ?
            WHERE id = ? AND user_id = ? AND durability = ? AND max_durability = ?
              AND EXISTS (SELECT 1 FROM salvage_players WHERE user_id = ? AND last_action_token = ?)
        `).bind(newMaximum, newMaximum, id, player.user_id, armor.durability, armor.max_durability, player.user_id, token),
    ]);
    if (Number(result[0]?.meta?.changes || 0) !== 1 || Number(result[1]?.meta?.changes || 0) !== 1) {
        return jsonRes({ error: '星币不足、正在对局，或护甲状态已变化，请刷新后重试。' }, 409);
    }
    return jsonRes({
        ok: true,
        notice: `护甲已修复；耐久上限永久降低 ${capacityLoss}，本次花费 ${cost} 星币。`,
        state: await getState(env, player.user_id),
    });
}

function consumeIngredients(
    env: Env,
    inventory: InventoryRow[],
    recipe: CraftRecipe,
    userId: number,
    token: string,
): TypedD1PreparedStatement[] | null {
    const statements: TypedD1PreparedStatement[] = [];
    for (const [key, required] of Object.entries(recipe.requirements)) {
        let remaining = required;
        for (const row of inventory.filter(entry => entry.item_key === key)) {
            if (!remaining) break;
            const consumed = Math.min(remaining, Number(row.quantity));
            statements.push(consumed === Number(row.quantity)
                ? env.DB.prepare(`
                    DELETE FROM salvage_inventory WHERE id = ? AND user_id = ? AND quantity >= ?
                      AND EXISTS (SELECT 1 FROM salvage_players WHERE user_id = ? AND last_action_token = ?)
                `).bind(row.id, userId, consumed, userId, token)
                : env.DB.prepare(`
                    UPDATE salvage_inventory SET quantity = quantity - ?
                    WHERE id = ? AND user_id = ? AND quantity >= ?
                      AND EXISTS (SELECT 1 FROM salvage_players WHERE user_id = ? AND last_action_token = ?)
                `).bind(consumed, row.id, userId, consumed, userId, token));
            remaining -= consumed;
        }
        if (remaining) return null;
    }
    return statements;
}

async function startCraft(env: Env, player: PlayerRow, body: Record<string, unknown>): Promise<Response> {
    const recipe = RECIPES.find(entry => entry.key === String(body.item || ''));
    if (!recipe) return jsonRes({ error: '请选择有效的制造配方。' }, 400);
    const busy = await env.DB.prepare("SELECT id FROM salvage_crafting WHERE user_id = ? AND category = ? AND status = 'running'")
        .bind(player.user_id, recipe.category).first();
    if (busy) return jsonRes({ error: `${recipe.categoryName}正在制造，请领取完成品后再排产。` }, 409);
    const inventory = await env.DB.prepare('SELECT id, item_key, quantity, durability, max_durability, charges FROM salvage_inventory WHERE user_id = ?')
        .bind(player.user_id).all<InventoryRow>();
    const token = crypto.randomUUID();
    const inputs = consumeIngredients(env, inventory.results || [], recipe, player.user_id, token);
    if (!inputs) return jsonRes({ error: '制造材料不足。' }, 409);
    const startedAt = new Date().toISOString();
    const finishesAt = dateAfterMinutes(recipe.minutes);
    const result = await env.DB.batch([
        env.DB.prepare(`
            UPDATE salvage_players SET last_action_token = ?
            WHERE user_id = ? AND last_action_token = ?
              AND NOT EXISTS (SELECT 1 FROM salvage_runs WHERE user_id = ? AND status = 'active')
              AND NOT EXISTS (SELECT 1 FROM salvage_crafting WHERE user_id = ? AND category = ? AND status = 'running')
        `).bind(token, player.user_id, player.last_action_token, player.user_id, player.user_id, recipe.category),
        ...inputs,
        env.DB.prepare(`
            INSERT INTO salvage_crafting (user_id, category, item_key, quantity, started_at, finishes_at)
            SELECT ?, ?, ?, ?, ?, ? FROM salvage_players
            WHERE user_id = ? AND last_action_token = ?
        `).bind(
            player.user_id, recipe.category, recipe.key, recipe.quantity, startedAt, finishesAt,
            player.user_id, token,
        ),
    ]);
    if (Number(result[0]?.meta?.changes || 0) !== 1) return jsonRes({ error: '材料、制造排程或档案状态已变化，请刷新后重试。' }, 409);
    return jsonRes({ ok: true, notice: `${recipe.categoryName}已开始制造「${recipe.name}」，预计 ${recipe.minutes} 分钟完成。`, state: await getState(env, player.user_id) });
}

async function claimCraft(env: Env, player: PlayerRow, body: Record<string, unknown>): Promise<Response> {
    const id = Number(body.job_id);
    const job = await env.DB.prepare("SELECT * FROM salvage_crafting WHERE id = ? AND user_id = ? AND status = 'running'")
        .bind(id, player.user_id).first<any>();
    if (!job) return jsonRes({ error: '制造任务不存在或已经领取。' }, 404);
    if (Date.parse(job.finishes_at) > Date.now()) return jsonRes({ error: '制造尚未完成，请稍后再来领取。' }, 409);
    const recipe = RECIPES.find(entry => entry.category === job.category && entry.key === job.item_key);
    if (!recipe) throw new Error(`Missing salvage recipe for job ${id}.`);
    const token = crypto.randomUUID();
    const result = await env.DB.batch([
        env.DB.prepare(`
            UPDATE salvage_players SET last_action_token = ?
            WHERE user_id = ? AND last_action_token = ?
              AND NOT EXISTS (SELECT 1 FROM salvage_runs WHERE user_id = ? AND status = 'active')
        `).bind(token, player.user_id, player.last_action_token, player.user_id),
        env.DB.prepare(`
            UPDATE salvage_crafting SET status = 'claimed'
            WHERE id = ? AND user_id = ? AND status = 'running' AND finishes_at <= ?
              AND EXISTS (SELECT 1 FROM salvage_players WHERE user_id = ? AND last_action_token = ?)
        `).bind(id, player.user_id, new Date().toISOString(), player.user_id, token),
        ...craftOutputStatements(env, recipe, player.user_id, token),
    ]);
    if (Number(result[0]?.meta?.changes || 0) !== 1 || Number(result[1]?.meta?.changes || 0) !== 1) {
        return jsonRes({ error: '制造任务或档案状态已变化，请刷新后重试。' }, 409);
    }
    return jsonRes({ ok: true, notice: `已领取「${recipe.name}」。`, state: await getState(env, player.user_id) });
}

function craftOutputStatements(
    env: Env,
    recipe: CraftRecipe,
    userId: number,
    token: string,
): TypedD1PreparedStatement[] {
    if (recipe.key === 'star_crystal') {
        return [env.DB.prepare(`
            UPDATE salvage_players SET star_crystals = star_crystals + ?
            WHERE user_id = ? AND last_action_token = ?
        `).bind(recipe.quantity, userId, token)];
    }
    const definition = item(recipe.key);
    const durability = definition.maxDurability || 0;
    return [env.DB.prepare(`
        INSERT INTO salvage_inventory (user_id, item_key, quantity, durability, max_durability, charges)
        SELECT ?, ?, ?, ?, ?, 0 FROM salvage_players
        WHERE user_id = ? AND last_action_token = ?
    `).bind(userId, recipe.key, recipe.quantity, durability, durability, userId, token)];
}

async function moveInventoryToRun(
    env: Env,
    rows: InventoryRow[],
    userId: number,
    token: string,
): Promise<TypedD1PreparedStatement[]> {
    return rows.map(row => env.DB.prepare(
        'DELETE FROM salvage_inventory WHERE id = ? AND user_id = ? AND EXISTS (SELECT 1 FROM salvage_players WHERE user_id = ? AND last_action_token = ?)'
    ).bind(row.id, userId, userId, token));
}

async function startRun(env: Env, player: PlayerRow, body: Record<string, unknown>): Promise<Response> {
    const zone = String(body.zone) as RunRow['zone'];
    if (zone !== 'safe' && zone !== 'chaos') return jsonRes({ error: '请选择安全区或混乱区。' }, 400);
    const ids = {
        backpack: Number(body.backpack_id),
        weapon: Number(body.weapon_id),
        armor: Number(body.armor_id),
    };
    if (Object.values(ids).some(id => !Number.isSafeInteger(id) || id < 1)) {
        return jsonRes({ error: '请为本次对局选择背包、武器和护甲。' }, 400);
    }
    const selected = await env.DB.prepare(`
        SELECT id, item_key, quantity, durability, max_durability, charges FROM salvage_inventory
        WHERE user_id = ? AND id IN (?, ?, ?)
    `).bind(player.user_id, ids.backpack, ids.weapon, ids.armor).all<InventoryRow>();
    if (selected.results?.length !== 3) return jsonRes({ error: '装备已变化，请重新选择。' }, 409);
    const byId = new Map(selected.results.map(row => [Number(row.id), row]));
    const backpack = byId.get(ids.backpack)!;
    const weapon = byId.get(ids.weapon)!;
    const armor = byId.get(ids.armor)!;
    if (
        item(backpack.item_key).kind !== 'backpack' || item(weapon.item_key).kind !== 'weapon'
        || item(armor.item_key).kind !== 'armor' || backpack.quantity !== 1 || weapon.quantity !== 1 || armor.quantity !== 1
    ) return jsonRes({ error: '装备栏类型无效。' }, 400);
    if (armor.durability <= 0) {
        return jsonRes({ error: '护甲耐久耗尽，请在局外维修或更换护甲。' }, 409);
    }
    if (weapon.charges < 1) return jsonRes({ error: '武器没有充能，请在仓库页使用星晶充能。' }, 409);
    const packTier = item(backpack.item_key).tier;
    const weaponTier = item(weapon.item_key).tier;
    const armorTier = item(armor.item_key).tier;
    const equipmentValue = [backpack, weapon, armor].reduce((sum, gear) => sum + item(gear.item_key).value, 0);
    if (zone === 'chaos' && equipmentValue < ZONES.chaos.entryValue) {
        return jsonRes({ error: `混乱区要求携带价值至少 ${ZONES.chaos.entryValue} 星币的背包、武器与护甲；当前价值 ${equipmentValue}。` }, 409);
    }
    const requestedMedkits = Number(body.medkits ?? 0);
    if (!Number.isSafeInteger(requestedMedkits) || requestedMedkits < 0 || requestedMedkits > 5) {
        return jsonRes({ error: '急救包携带数量必须为 0 至 5。' }, 400);
    }
    const inventory = await env.DB.prepare(
        "SELECT id, item_key, quantity, durability, max_durability, charges FROM salvage_inventory WHERE user_id = ? AND item_key = 'medkit' ORDER BY id"
    ).bind(player.user_id).all<InventoryRow>();
    const medkits = (inventory.results || []).reduce((sum, row) => sum + Number(row.quantity), 0);
    if (medkits < requestedMedkits) return jsonRes({ error: '仓库中的急救包数量不足。' }, 409);
    const medRows: InventoryRow[] = [];
    let remainingMedkits = requestedMedkits;
    for (const row of inventory.results || []) {
        if (!remainingMedkits) break;
        const quantity = Math.min(remainingMedkits, Number(row.quantity));
        medRows.push({ ...row, quantity });
        remainingMedkits -= quantity;
    }
    const token = crypto.randomUUID();
    const runItems = [backpack, weapon, armor].map(row => ({
        key: row.item_key, quantity: 1, durability: row.durability,
        maxDurability: row.max_durability, charges: row.charges,
    }));
    if (requestedMedkits) runItems.push({
        key: 'medkit', quantity: requestedMedkits, durability: 0, maxDurability: 0, charges: 0,
    });
    const kit = {
        backpack: runItems[0],
        weapon: runItems[1],
        armor: runItems[2],
        capacity: 12 + packTier * 6,
        weaponTier,
        armorTier,
    };
    const maxHealth = 100 + armorTier * 20;
    const map = createMap(zone);
    const inserted = await env.DB.prepare(`
        INSERT INTO salvage_runs (user_id, zone, health, max_health, map_json, cargo_json, kit_json)
        SELECT ?, ?, ?, ?, ?, ?, ? FROM salvage_players
        WHERE user_id = ? AND last_action_token = ?
    `).bind(
        player.user_id, zone, maxHealth, maxHealth, JSON.stringify(map), JSON.stringify(runItems),
        JSON.stringify(kit), player.user_id, token,
    );
    const selectedRows = [backpack, weapon, armor];
    const statements: TypedD1PreparedStatement[] = [
        env.DB.prepare(`
            UPDATE salvage_players SET last_action_token = ?
            WHERE user_id = ? AND last_action_token = ?
              AND NOT EXISTS (SELECT 1 FROM salvage_runs WHERE user_id = ? AND status = 'active')
        `).bind(token, player.user_id, player.last_action_token, player.user_id),
        ...await moveInventoryToRun(env, selectedRows, player.user_id, token),
    ];
    for (const medRow of medRows) {
        const source = inventory.results?.find(row => row.id === medRow.id);
        statements.push(source && medRow.quantity === Number(source.quantity)
            ? env.DB.prepare(`
                DELETE FROM salvage_inventory WHERE id = ? AND user_id = ? AND quantity >= ?
                  AND EXISTS (SELECT 1 FROM salvage_players WHERE user_id = ? AND last_action_token = ?)
            `).bind(medRow.id, player.user_id, medRow.quantity, player.user_id, token)
            : env.DB.prepare(`
                UPDATE salvage_inventory SET quantity = quantity - ?
                WHERE id = ? AND user_id = ? AND quantity >= ?
                  AND EXISTS (SELECT 1 FROM salvage_players WHERE user_id = ? AND last_action_token = ?)
            `).bind(medRow.quantity, medRow.id, player.user_id, medRow.quantity, player.user_id, token));
    }
    statements.push(inserted);
    const result = await env.DB.batch(statements);
    if (Number(result[0]?.meta?.changes || 0) !== 1) return jsonRes({ error: '已有进行中的对局，或装备状态已变化，请刷新后重试。' }, 409);
    const run = await env.DB.prepare("SELECT * FROM salvage_runs WHERE user_id = ? AND status = 'active'")
        .bind(player.user_id).first<RunRow>();
    if (!run) throw new Error('Salvage run creation failed.');
    return jsonRes({ ok: true, notice: `已进入${ZONES[zone].name}，祝你平安撤离。`, state: await getState(env, player.user_id) });
}

async function updateRun(
    env: Env,
    run: RunRow,
    changes: { x?: number; y?: number; health?: number; map?: MapObject[]; cargo?: CargoItem[]; kit?: unknown; status?: RunRow['status']; ended?: boolean },
): Promise<boolean> {
    const result = await env.DB.prepare(`
        UPDATE salvage_runs
        SET x = ?, y = ?, health = ?, turn = turn + 1, status = ?,
            map_json = ?, cargo_json = ?, kit_json = ?,
            ended_at = CASE WHEN ? THEN ? ELSE ended_at END
        WHERE id = ? AND user_id = ? AND status = 'active' AND turn = ?
    `).bind(
        changes.x ?? run.x,
        changes.y ?? run.y,
        changes.health ?? run.health,
        changes.status ?? run.status,
        JSON.stringify(changes.map ?? safeJson<MapObject[]>(run.map_json, [])),
        JSON.stringify(changes.cargo ?? safeJson<CargoItem[]>(run.cargo_json, [])),
        JSON.stringify(changes.kit ?? safeJson(run.kit_json, {})),
        changes.ended ? 1 : 0,
        new Date().toISOString(),
        run.id, run.user_id, run.turn,
    ).run();
    return Number(result.meta?.changes || 0) === 1;
}

function loadout(run: RunRow): { backpack: CargoItem; weapon: CargoItem; armor: CargoItem; capacity: number; weaponTier: number; armorTier: number } {
    return safeJson(run.kit_json, {
        backpack: { key: '', quantity: 0, durability: 0, maxDurability: 0, charges: 0 },
        weapon: { key: '', quantity: 0, durability: 0, maxDurability: 0, charges: 0 },
        armor: { key: '', quantity: 0, durability: 0, maxDurability: 0, charges: 0 },
        capacity: 0, weaponTier: 1, armorTier: 1,
    });
}

async function move(run: RunRow, body: Record<string, unknown>, env: Env): Promise<Response> {
    const x = Number(body.x);
    const y = Number(body.y);
    if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || x < 0 || x > 5 || y < 0 || y > 5
        || Math.abs(x - run.x) + Math.abs(y - run.y) !== 1) {
        return jsonRes({ error: '每次只能向上下左右相邻的一格移动。' }, 400);
    }
    const objects = safeJson<MapObject[]>(run.map_json, []);
    const target = objects.find(object => object.x === x && object.y === y);
    if (target?.kind === 'enemy' && !target.defeated) return jsonRes({ error: '该位置有敌人阻挡，请先击败它。' }, 409);
    if (!await updateRun(env, run, { x, y })) return jsonRes({ error: '对局状态已变化，请刷新后继续。' }, 409);
    return jsonRes({ ok: true, notice: `已移动至坐标 ${x + 1}, ${y + 1}。`, state: await getState(env, run.user_id) });
}

async function searchContainer(run: RunRow, env: Env): Promise<Response> {
    const objects = safeJson<MapObject[]>(run.map_json, []);
    const object = objects.find(entry => entry.x === run.x && entry.y === run.y);
    if (!object || !['server', 'safe', 'medical', 'supply'].includes(object.kind)) {
        return jsonRes({ error: '当前位置没有可搜索的容器。' }, 409);
    }
    if (object.searched) return jsonRes({ error: '这个容器已经搜索过了。' }, 409);
    const cargo = safeJson<CargoItem[]>(run.cargo_json, []);
    const kit = loadout(run);
    const loot = object.loot || [];
    const added: CargoItem[] = [];
    let capacity = kit.capacity - totalWeight(cargo);
    for (const entry of loot) {
        const definition = item(entry.key);
        if (definition.weight === 0) {
            added.push(entry);
            continue;
        }
        const fit = Math.min(entry.quantity, Math.floor(capacity / definition.weight));
        if (fit > 0) {
            added.push({ ...entry, quantity: fit });
            capacity -= fit * definition.weight;
        }
    }
    if (!added.length && loot.length) return jsonRes({ error: '背包已满，整理物资或前往撤离点后再来搜索。' }, 409);
    object.searched = true;
    object.loot = [];
    const nextCargo = mergeCargo(cargo, added);
    if (!await updateRun(env, run, { map: objects, cargo: nextCargo })) {
        return jsonRes({ error: '对局状态已变化，请刷新后继续。' }, 409);
    }
    const names = added.map(entry => `${item(entry.key).name} ×${entry.quantity}`).join('、');
    return jsonRes({ ok: true, notice: added.length ? `搜索获得：${names}。` : '容器已搜索，背包空间不足，未能带走物资。', state: await getState(env, run.user_id) });
}

function loseRunStatements(env: Env, run: RunRow): TypedD1PreparedStatement[] {
    return [env.DB.prepare(`
        UPDATE salvage_runs SET health = 0, turn = turn + 1, status = 'dead',
            map_json = '[]', cargo_json = '[]', kit_json = '{}', ended_at = ?
        WHERE id = ? AND user_id = ? AND status = 'active' AND turn = ?
    `).bind(new Date().toISOString(), run.id, run.user_id, run.turn)];
}

async function attack(run: RunRow, env: Env, body: Record<string, unknown>): Promise<Response> {
    const objects = safeJson<MapObject[]>(run.map_json, []);
    const enemy = objects.find(object =>
        object.id === String(body.object_id || '')
        && object.kind === 'enemy'
        && !object.defeated
        && Math.abs(object.x - run.x) + Math.abs(object.y - run.y) <= 1
    );
    if (!enemy) return jsonRes({ error: '当前位置没有存活的敌人。' }, 409);
    const kit = loadout(run);
    if (kit.weapon.charges < 1) return jsonRes({ error: '武器充能不足；请撤离后购买星晶并为武器充能。' }, 409);
    const damage = 10 + kit.weaponTier * 7;
    kit.weapon.charges -= 1;
    enemy.health = Math.max(0, Number(enemy.health) - damage);
    const cargo = safeJson<CargoItem[]>(run.cargo_json, []);
    if (enemy.health <= 0) {
        enemy.defeated = true;
        const drops = enemy.loot || [];
        const nextCargo = mergeCargo(cargo, drops);
        if (totalWeight(nextCargo) <= kit.capacity) {
            const result = await updateRun(env, run, { map: objects, cargo: nextCargo, kit });
            if (!result) return jsonRes({ error: '对局状态已变化，请刷新后继续。' }, 409);
            return jsonRes({ ok: true, notice: `敌人已击败，物资掉落：${drops.map(entry => `${item(entry.key).name} ×${entry.quantity}`).join('、')}。`, state: await getState(env, run.user_id) });
        }
        const result = await updateRun(env, run, { map: objects, cargo, kit });
        if (!result) return jsonRes({ error: '对局状态已变化，请刷新后继续。' }, 409);
        return jsonRes({ ok: true, notice: '敌人已击败，但背包已满，未能带走掉落物资。', state: await getState(env, run.user_id) });
    }
    const armorReduction = kit.armor.durability > 0 ? kit.armorTier * 3 : 0;
    const incoming = Math.max(1, Number(enemy.attack || 1) - armorReduction);
    kit.armor.durability = Math.max(0, kit.armor.durability - 1);
    const health = Math.max(0, run.health - incoming);
    if (!health) {
        const result = await env.DB.batch(loseRunStatements(env, run));
        if (Number(result[0]?.meta?.changes || 0) !== 1) return jsonRes({ error: '对局状态已变化，请刷新后继续。' }, 409);
        return jsonRes({ ok: true, notice: '生命值归零，你在空间站阵亡；带入对局的装备和所有物资均已遗失。', state: await getState(env, run.user_id) });
    }
    if (!await updateRun(env, run, { map: objects, cargo, kit, health })) return jsonRes({ error: '对局状态已变化，请刷新后继续。' }, 409);
    return jsonRes({ ok: true, notice: `造成 ${damage} 点伤害，受到 ${incoming} 点反击。`, state: await getState(env, run.user_id) });
}

async function heal(run: RunRow, env: Env): Promise<Response> {
    const cargo = safeJson<CargoItem[]>(run.cargo_json, []);
    const medkit = cargo.find(entry => entry.key === 'medkit' && entry.quantity > 0);
    if (!medkit) return jsonRes({ error: '没有携带急救包。' }, 409);
    if (run.health >= run.max_health) return jsonRes({ error: '生命值已满，无需使用急救包。' }, 409);
    medkit.quantity -= 1;
    const nextCargo = cargo.filter(entry => entry.quantity > 0);
    const health = Math.min(run.max_health, run.health + 45);
    if (!await updateRun(env, run, { cargo: nextCargo, health })) return jsonRes({ error: '对局状态已变化，请刷新后继续。' }, 409);
    return jsonRes({ ok: true, notice: `使用急救包，恢复 ${health - run.health} 点生命值。`, state: await getState(env, run.user_id) });
}

function inventoryInsert(env: Env, userId: number, entry: CargoItem, token: string): TypedD1PreparedStatement {
    const values = [userId, entry.key, entry.quantity, entry.durability, entry.maxDurability, entry.charges];
    return env.DB.prepare(`
        INSERT INTO salvage_inventory (user_id, item_key, quantity, durability, max_durability, charges)
        SELECT ?, ?, ?, ?, ?, ? FROM salvage_players WHERE user_id = ? AND last_action_token = ?
    `).bind(...values, userId, token);
}

async function extract(run: RunRow, env: Env): Promise<Response> {
    const objects = safeJson<MapObject[]>(run.map_json, []);
    const exit = objects.find(object => object.kind === 'extract');
    if (!exit || exit.x !== run.x || exit.y !== run.y) return jsonRes({ error: '请先移动到撤离点才能带出物资。' }, 409);
    const cargo = safeJson<CargoItem[]>(run.cargo_json, []);
    const kit = loadout(run);
    const returned = mergeCargo(cargo, [kit.backpack, kit.weapon, kit.armor]);
    const token = crypto.randomUUID();
    const player = await getPlayer(env, run.user_id);
    const result = await env.DB.batch([
        env.DB.prepare(`
            UPDATE salvage_runs SET status = 'extracted', turn = turn + 1, cargo_json = '[]',
                kit_json = '{}', ended_at = ?
            WHERE id = ? AND user_id = ? AND status = 'active' AND turn = ?
              AND EXISTS (SELECT 1 FROM salvage_players WHERE user_id = ? AND last_action_token = ?)
        `).bind(new Date().toISOString(), run.id, run.user_id, run.turn, run.user_id, player.last_action_token),
        env.DB.prepare(`
            UPDATE salvage_players SET star_crystals = star_crystals + ?, last_action_token = ?
            WHERE user_id = ? AND last_action_token = ?
              AND EXISTS (SELECT 1 FROM salvage_runs WHERE id = ? AND status = 'extracted' AND user_id = ?)
        `).bind(
            cargo.filter(entry => entry.key === 'star_crystal').reduce((sum, entry) => sum + entry.quantity, 0),
            token, run.user_id, player.last_action_token, run.id, run.user_id,
        ),
        ...returned.filter(entry => entry.key !== 'star_crystal').map(entry => inventoryInsert(env, run.user_id, entry, token)),
    ]);
    if (Number(result[0]?.meta?.changes || 0) !== 1 || Number(result[1]?.meta?.changes || 0) !== 1) {
        return jsonRes({ error: '撤离状态已变化，请刷新后重试。' }, 409);
    }
    return jsonRes({ ok: true, notice: '已成功撤离；带回的装备和收集品已存入仓库，星晶已入账。', state: await getState(env, run.user_id) });
}

export async function handleSalvage(request: Request, env: Env, path: string): Promise<Response> {
    const user = await getSessionUser(env, request);
    if (!user) return jsonRes({ error: '请先登录后进入空间站搜刮。' }, 403);
    const userId = Number(user.id);
    await ensurePlayer(env, userId);
    if (request.method === 'GET' && path === '/api/salvage/state') {
        return jsonRes(await getState(env, userId));
    }
    if (request.method !== 'POST') return jsonRes({ error: '请求方法不支持。' }, 405);
    const body = await parseBody(request);
    if (!body) return jsonRes({ error: '请求内容必须是有效的 JSON 对象。' }, 400);
    const player = await getPlayer(env, userId);
    if (path === '/api/salvage/start') return startRun(env, player, body);
    if (path === '/api/salvage/purchase') return purchase(env, player, body);
    if (path === '/api/salvage/supplies') return buySupplies(env, player, body);
    if (path === '/api/salvage/charge') return chargeWeapon(env, player, body);
    if (path === '/api/salvage/sell') return sellLoot(env, player, body);
    if (path === '/api/salvage/repair') return repairArmor(env, player, body);
    if (path === '/api/salvage/craft') return startCraft(env, player, body);
    if (path === '/api/salvage/craft/claim') return claimCraft(env, player, body);
    const run = await env.DB.prepare("SELECT * FROM salvage_runs WHERE user_id = ? AND status = 'active' LIMIT 1")
        .bind(userId).first<RunRow>();
    if (!run) return jsonRes({ error: '当前没有进行中的对局。' }, 409);
    if (path === '/api/salvage/move') return move(run, body, env);
    if (path === '/api/salvage/search') return searchContainer(run, env);
    if (path === '/api/salvage/attack') return attack(run, env, body);
    if (path === '/api/salvage/heal') return heal(run, env);
    if (path === '/api/salvage/extract') return extract(run, env);
    return jsonRes({ error: '未知的空间站搜刮操作。' }, 404);
}
