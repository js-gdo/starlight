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
    weaponBranch?: 'pulse' | 'rail' | 'scatter';
    damage?: number;
    width?: number;
    height?: number;
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
    kind: 'wall' | 'server' | 'safe' | 'medical' | 'supply' | 'archive' | 'armory' | 'lab' | 'locker' | 'reactor' | 'enemy' | 'extract';
    name: string;
    area?: 'living' | 'management' | 'research' | 'reactor' | 'core' | 'engineering';
    enemyType?: 'patrol' | 'scout' | 'sentry' | 'support' | 'hunter' | 'brute' | 'wraith' | 'elite';
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

function isContainerKind(kind: MapObject['kind']): boolean {
    return ['server', 'safe', 'medical', 'supply', 'archive', 'armory', 'lab', 'locker', 'reactor'].includes(kind);
}

const ITEMS: Record<string, ItemDefinition> = {};

const ITEM_SIZES: Record<string, [number, number]> = {
    medkit: [2, 2], star_crystal: [1, 1],
    circuit_board: [2, 2], fiber_bundle: [1, 2], alloy_plate: [2, 3], med_gel: [1, 2],
    quantum_cell: [1, 2], data_core: [2, 2], antique_relic: [2, 2], void_artifact: [2, 3],
    data_fragment: [1, 1], encrypted_key: [1, 1], quantum_clock: [2, 2], relic_compass: [1, 2],
    starlight_crown: [1, 1], alien_ceramic: [2, 2], ancient_coin: [1, 1], signal_prism: [1, 2],
    plasma_coil: [2, 2], nano_mesh: [2, 2], optic_lens: [1, 1], polymer_resin: [1, 2],
    bio_sample: [1, 3], reactor_shard: [2, 2], magnetic_core: [3, 3], coolant_canister: [1, 4],
};

function itemFootprint(key: string, kind: ItemKind, tier: number): [number, number] {
    const named = ITEM_SIZES[key];
    if (named) return named;
    if (kind === 'weapon') return [1, 4];
    if (kind === 'armor') return tier >= 5 ? [3, 3] : tier >= 2 ? [2, 3] : [2, 2];
    if (kind === 'backpack') return tier >= 5 ? [3, 3] : [2, 2];
    return [1, 1];
}

function addItem(item: ItemDefinition): void {
    const [width, height] = itemFootprint(item.key, item.kind, item.tier);
    ITEMS[item.key] = {
        ...item,
        price: item.kind === 'material' && item.price === 0 ? item.value : item.price,
        width,
        height,
    };
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
    { key: 'data_fragment', name: '星港航行日志', kind: 'loot' as const, tier: 1, value: 72, weight: 1, description: '记录空间站航线与船员活动的旧数据晶片。' },
    { key: 'encrypted_key', name: '加密舱门密钥', kind: 'loot' as const, tier: 3, value: 218, weight: 1, description: '带有失效权限标记的稀有门禁密钥。' },
    { key: 'quantum_clock', name: '量子计时器', kind: 'loot' as const, tier: 4, value: 415, weight: 2, description: '收藏家追捧的精密量子计时器。' },
    { key: 'relic_compass', name: '先驱者星图罗盘', kind: 'loot' as const, tier: 5, value: 590, weight: 2, description: '刻有未知星域坐标的古老罗盘。' },
    { key: 'starlight_crown', name: '星辉王冠', kind: 'loot' as const, tier: 6, value: 980, weight: 2, description: '传闻属于先驱者舰队指挥官的珍稀饰物。' },
    { key: 'alien_ceramic', name: '异星釉彩陶片', kind: 'loot' as const, tier: 3, value: 245, weight: 2, description: '表面留有未知文明纹样的陶瓷碎片。' },
    { key: 'ancient_coin', name: '旧纪元纪念币', kind: 'loot' as const, tier: 2, value: 145, weight: 1, description: '空间站建成纪念发行的限量金属币。' },
    { key: 'signal_prism', name: '折叠信号棱镜', kind: 'loot' as const, tier: 5, value: 560, weight: 1, description: '能够折射多频段信号的实验室藏品。' },
    { key: 'plasma_coil', name: '等离子线圈', kind: 'material' as const, tier: 2, value: 82, weight: 1, description: '武器与星晶制造所需的高导能线圈。' },
    { key: 'nano_mesh', name: '纳米织网', kind: 'material' as const, tier: 2, value: 76, weight: 1, description: '用于轻型护甲和背包加固的微型纤维网。' },
    { key: 'optic_lens', name: '自适应光学镜片', kind: 'material' as const, tier: 2, value: 88, weight: 1, description: '人机传感器与侦察装备的核心零件。' },
    { key: 'polymer_resin', name: '高韧聚合树脂', kind: 'material' as const, tier: 1, value: 41, weight: 1, description: '可塑性强的通用装备制造材料。' },
    { key: 'bio_sample', name: '低温生物样本', kind: 'material' as const, tier: 3, value: 132, weight: 1, description: '封存在低温管中的未知生物组织样本。' },
    { key: 'reactor_shard', name: '反应堆陶瓷碎片', kind: 'material' as const, tier: 3, value: 148, weight: 2, description: '耐高温的反应堆隔热材料碎片。' },
    { key: 'magnetic_core', name: '磁约束核心', kind: 'material' as const, tier: 4, value: 205, weight: 2, description: '高阶能量装备和重型护甲的稀有组件。' },
    { key: 'coolant_canister', name: '冷却剂罐', kind: 'material' as const, tier: 1, value: 54, weight: 2, description: '维持空间站设备与武器稳定运行的冷却剂。' },
].forEach(item => addItem({ ...item, price: 0 }));

addItem({
    key: 'medkit', name: '急救包', kind: 'medicine', tier: 1, value: 40, price: 80, weight: 2,
    description: '对局中使用可恢复 45 点生命值。',
});
addItem({
    key: 'star_crystal', name: '星晶', kind: 'crystal', tier: 1, value: 30, price: 45, weight: 1,
    description: '制造材料或购买武器充能；对局内的星晶必须成功撤离才能带出。',
});

for (let tier = 1; tier <= 6; tier++) {
    const multiplier = Math.pow(1.72, tier - 1);
    const armorNames = ['轻型软甲', '侦察鳞甲', '复合防护甲', '重装板甲', '偏导能量甲', '星铸堡垒甲'];
    addItem({
        key: `backpack_${tier}`, name: `${tier} 级探索背包`, kind: 'backpack', tier,
        value: Math.ceil(260 * multiplier), price: Math.ceil(320 * multiplier), weight: 0,
        description: `负重上限 ${12 + tier * 6}。`,
    });
    addItem({
        key: `weapon_${tier}`, name: `${tier} 级脉冲步枪`, kind: 'weapon', tier,
        value: Math.ceil(360 * multiplier), price: Math.ceil(440 * multiplier), weight: 3,
        weaponBranch: 'pulse', damage: 10 + tier * 7,
        description: `脉冲步枪 · 均衡射速与伤害；每次攻击消耗 1 点充能，伤害 ${10 + tier * 7}。`,
    });
    addItem({
        key: `armor_${tier}`, name: `${tier} 级${armorNames[tier - 1]}`, kind: 'armor', tier,
        value: Math.ceil(300 * multiplier), price: Math.ceil(390 * multiplier), weight: 4,
        maxDurability: 45 + tier * 9, description: `耐久 ${45 + tier * 9}，提供 ${tier * 3} 点护甲减伤。`,
    });
}

const WEAPON_BRANCHES = [
    { key: 'rail', name: '磁轨长枪', damage: 15, priceScale: 1.12, description: '高伤害，适合远距离精确打击。' },
    { key: 'scatter', name: '散射霰炮', damage: 7, priceScale: 0.92, description: '近距离高频输出，单发伤害较低。' },
] as const;

for (let tier = 1; tier <= 6; tier++) {
    for (const branch of WEAPON_BRANCHES) {
        const multiplier = Math.pow(1.72, tier - 1);
        addItem({
            key: `weapon_${branch.key}_${tier}`,
            name: `${tier} 级${branch.name}`,
            kind: 'weapon',
            tier,
            value: Math.ceil(360 * multiplier * branch.priceScale),
            price: Math.ceil(440 * multiplier * branch.priceScale),
            weight: 3,
            weaponBranch: branch.key,
            damage: branch.damage + (tier - 1) * (branch.key === 'rail' ? 8 : 5),
            description: `${branch.description} 每次攻击消耗 1 点充能，伤害 ${branch.damage + (tier - 1) * (branch.key === 'rail' ? 8 : 5)}。`,
        });
    }
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
    { category: 'armor', categoryName: '护甲制造商', key: 'armor_1', name: '1 级轻型软甲', minutes: 10, requirements: { alloy_plate: 3, fiber_bundle: 2 }, quantity: 1 },
    { category: 'armor', categoryName: '护甲制造商', key: 'armor_2', name: '2 级侦察鳞甲', minutes: 22, requirements: { alloy_plate: 4, fiber_bundle: 3, circuit_board: 1 }, quantity: 1 },
    { category: 'armor', categoryName: '护甲制造商', key: 'armor_3', name: '3 级复合防护甲', minutes: 42, requirements: { alloy_plate: 6, fiber_bundle: 4, quantum_cell: 1 }, quantity: 1 },
    { category: 'armor', categoryName: '护甲制造商', key: 'armor_4', name: '4 级重装板甲', minutes: 75, requirements: { alloy_plate: 8, fiber_bundle: 6, quantum_cell: 2 }, quantity: 1 },
    { category: 'armor', categoryName: '护甲制造商', key: 'armor_5', name: '5 级偏导能量甲', minutes: 125, requirements: { alloy_plate: 10, fiber_bundle: 8, quantum_cell: 3 }, quantity: 1 },
    { category: 'armor', categoryName: '护甲制造商', key: 'armor_6', name: '6 级星铸堡垒甲', minutes: 200, requirements: { alloy_plate: 12, fiber_bundle: 10, quantum_cell: 5 }, quantity: 1 },
    { category: 'medicine', categoryName: '药品制造商', key: 'medkit', name: '急救包 ×2', minutes: 6, requirements: { med_gel: 2, fiber_bundle: 1 }, quantity: 2 },
];

for (const branch of WEAPON_BRANCHES) {
    for (let tier = 1; tier <= 6; tier++) {
        const key = `weapon_${branch.key}_${tier}`;
        const requirements: Record<string, number> = {
            circuit_board: 3 + (tier - 1) * 2,
            alloy_plate: 2 + (tier - 1) * 2,
        };
        if (tier > 1) requirements.quantum_cell = tier - 1;
        RECIPES.push({
            category: 'weapon',
            categoryName: '武器制造商',
            key,
            name: `${tier} 级${branch.name}`,
            minutes: Math.ceil(10 * Math.pow(1.8, tier - 1)),
            requirements,
            quantity: 1,
        });
    }
}

const ZONES = {
    safe: { name: '安全区', entryValue: 0, enemyHealth: [30, 42], enemyAttack: [7, 11], lootTier: [1, 3] },
    chaos: { name: '混乱区', entryValue: 2400, enemyHealth: [65, 92], enemyAttack: [15, 23], lootTier: [3, 6] },
} as const;

const STATION_WIDTH = 52;
const STATION_HEIGHT = 36;
const STATION_REGIONS = [
    { id: 'living', name: '生活区', x1: 2, x2: 13, y1: 3, y2: 13 },
    { id: 'management', name: '管理区', x1: 18, x2: 29, y1: 3, y2: 13 },
    { id: 'research', name: '研发区', x1: 34, x2: 49, y1: 3, y2: 13 },
    { id: 'reactor', name: '机组区', x1: 2, x2: 15, y1: 21, y2: 32 },
    { id: 'core', name: '核心区', x1: 20, x2: 31, y1: 18, y2: 31 },
    { id: 'engineering', name: '工程区', x1: 36, x2: 49, y1: 21, y2: 32 },
] as const;
const STATION_FLOOR = new Set<string>();
for (const region of STATION_REGIONS) {
    for (let y = region.y1; y <= region.y2; y++) {
        for (let x = region.x1; x <= region.x2; x++) STATION_FLOOR.add(`${x},${y}`);
    }
}
for (const [x1, x2, y1, y2] of [
    [12, 19, 7, 9], [28, 35, 7, 9], [14, 21, 25, 27], [30, 37, 25, 27], [24, 27, 10, 22],
]) {
    for (let y = y1; y <= y2; y++) {
        for (let x = x1; x <= x2; x++) STATION_FLOOR.add(`${x},${y}`);
    }
}
const STATION_TILES = [...STATION_FLOOR].map(value => {
    const [x, y] = value.split(',').map(Number);
    return { x, y };
});
const STATION_WALLS = [...new Set(STATION_TILES.flatMap(({ x, y }) =>
    [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]
        .filter(([wallX, wallY]) => wallX > 0 && wallX < STATION_WIDTH - 1 && wallY > 0 && wallY < STATION_HEIGHT - 1)
        .filter(([wallX, wallY]) => !STATION_FLOOR.has(`${wallX},${wallY}`))
        .map(([wallX, wallY]) => `${wallX},${wallY}`)
))].map(value => {
    const [x, y] = value.split(',').map(Number);
    return { x, y };
});
const STATION_CELLS = [
    ...STATION_TILES.map(tile => ({ ...tile, wall: false })),
    ...STATION_WALLS.map(tile => ({ ...tile, wall: true })),
];
const LEGACY_STATION_LAYOUT = [
    '  ....  ',
    ' ...... ',
    '........',
    '...##...',
    '........',
    ' ...... ',
    '  ....  ',
];
const LEGACY_STATION_TILES = LEGACY_STATION_LAYOUT.flatMap((row, y) =>
    Array.from(row).flatMap((tile, x) => tile === '.' ? [{ x, y }] : [])
);
const LEGACY_STATION_WALLS = LEGACY_STATION_LAYOUT.flatMap((row, y) =>
    Array.from(row).flatMap((tile, x) => tile === '#' ? [{ x, y }] : [])
);
const LEGACY_STATION_CELLS = [
    ...LEGACY_STATION_TILES.map(tile => ({ ...tile, wall: false })),
    ...LEGACY_STATION_WALLS.map(tile => ({ ...tile, wall: true })),
];
const LEGACY_TILES = Array.from({ length: 6 }, (_, y) =>
    Array.from({ length: 6 }, (_, x) => ({ x, y }))
).flat();

function isLargeStation(objects: MapObject[]): boolean {
    return objects.some(object => object.kind === 'wall' && (object.x >= 8 || object.y >= 7));
}

function stationTilesFor(objects: MapObject[]) {
    if (isLargeStation(objects)) return STATION_TILES;
    if (objects.some(object => object.kind === 'wall')) return LEGACY_STATION_TILES;
    return LEGACY_TILES;
}

function stationCellsFor(objects: MapObject[]) {
    if (isLargeStation(objects)) return STATION_CELLS;
    if (objects.some(object => object.kind === 'wall')) return LEGACY_STATION_CELLS;
    return LEGACY_TILES.map(tile => ({ ...tile, wall: false }));
}

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

function mapLoot(kind: MapObject['kind'], zone: RunRow['zone'], area?: MapObject['area']): CargoItem[] {
    const coreBoost = area === 'core' || area === 'research';
    const multiplier = (zone === 'chaos' ? 1.7 : 1) * (coreBoost ? 1.5 : 1);
    const materials = [
        'circuit_board', 'fiber_bundle', 'alloy_plate', 'med_gel', 'quantum_cell',
        'plasma_coil', 'nano_mesh', 'optic_lens', 'polymer_resin', 'bio_sample',
        'reactor_shard', 'magnetic_core', 'coolant_canister',
    ];
    const collectibles = zone === 'chaos'
        ? ['antique_relic', 'void_artifact', 'data_core', 'encrypted_key', 'quantum_clock', 'relic_compass', 'starlight_crown', 'alien_ceramic', 'ancient_coin', 'signal_prism']
        : ['data_core', 'antique_relic', 'data_fragment', 'encrypted_key', 'alien_ceramic', 'ancient_coin'];
    const pick = (keys: string[]) => keys[randomInt(0, keys.length - 1)];
    const stack = (key: string, quantity: number): CargoItem => ({
        key, quantity, durability: 0, maxDurability: 0, charges: 0,
    });

    if (kind === 'server' || kind === 'archive' || kind === 'lab') {
        if (kind === 'archive') return [stack(pick(zone === 'chaos' || coreBoost ? collectibles : ['data_fragment', 'ancient_coin', 'encrypted_key']), 1)];
        if (kind === 'lab') return [stack(pick(['bio_sample', 'optic_lens', 'quantum_cell', 'magnetic_core', 'signal_prism']), randomInt(1, zone === 'chaos' || coreBoost ? 2 : 1))];
        const electronic = zone === 'chaos'
            ? ['circuit_board', 'data_core', 'quantum_cell', 'plasma_coil', 'optic_lens', 'magnetic_core', 'signal_prism']
            : ['circuit_board', 'data_core', 'data_fragment', 'plasma_coil', 'optic_lens'];
        if (coreBoost) electronic.push('magnetic_core', 'signal_prism');
        return [stack(pick(electronic), randomInt(1, zone === 'chaos' ? 3 : 2))];
    }
    if (kind === 'safe') {
        const key = pick(zone === 'chaos' || coreBoost ? collectibles : ['data_core', 'antique_relic', 'data_fragment', 'encrypted_key', 'alien_ceramic', 'ancient_coin']);
        return [stack(key, 1), ...(Math.random() < 0.7 ? [stack(pick(materials), 1)] : [])];
    }
    if (kind === 'armory') {
        const gearTier = zone === 'chaos' || coreBoost ? randomInt(2, 6) : randomInt(1, 3);
        const gearKind = (['weapon', 'armor', 'backpack'] as const)[randomInt(0, 2)];
        const key = gearKind === 'weapon' ? `weapon_${gearTier}` : `${gearKind}_${gearTier}`;
        const maxDurability = item(key).maxDurability || 0;
        return [{ key, quantity: 1, durability: gearKind === 'armor' ? maxDurability : 0, maxDurability, charges: gearKind === 'weapon' ? randomInt(2, 5) : 0 }];
    }
    if (kind === 'medical') {
        return [stack(Math.random() < 0.55 ? 'med_gel' : 'medkit', randomInt(1, 2))];
    }
    if (kind === 'locker') return [stack(pick(['fiber_bundle', 'polymer_resin', 'alloy_plate', 'coolant_canister', 'ancient_coin']), randomInt(1, 2))];
    if (kind === 'reactor') return [stack(pick(['reactor_shard', 'magnetic_core', 'coolant_canister', 'star_crystal']), randomInt(1, 2))];
    const material = pick(materials);
    const loot = [stack(material, randomInt(1, Math.ceil(2 * multiplier)))];
    if (zone === 'chaos' && Math.random() < 0.3) loot.push(stack('star_crystal', 1));
    return loot;
}

function createMap(zone: RunRow['zone']): MapObject[] {
    const exitCandidates = STATION_TILES.filter(({ x, y }) =>
        x === 2 || x === STATION_WIDTH - 3 || y === 3 || y === STATION_HEIGHT - 4
    );
    const exit = exitCandidates[randomInt(0, exitCandidates.length - 1)];
    const objects: MapObject[] = [
        ...STATION_WALLS.map(({ x, y }, index) => ({
            id: `wall-${index + 1}`, x, y, kind: 'wall' as const, name: '舱段隔离墙',
        })),
        { id: 'extract', ...exit, kind: 'extract', name: '边缘撤离平台' },
    ];
    const occupied = new Set([
        '7,8', `${exit.x},${exit.y}`,
        ...STATION_WALLS.map(({ x, y }) => `${x},${y}`),
    ]);
    const candidates = STATION_TILES.filter(({ x, y }) => !occupied.has(`${x},${y}`));
    const place = (object: Omit<MapObject, 'x' | 'y'>) => {
        const available = candidates.filter(({ x, y }) => !object.area || stationArea(x, y) === object.area);
        const index = randomInt(0, available.length - 1);
        const position = available[index];
        if (!position) throw new Error('Not enough walkable station tiles to place map objects.');
        const { x, y } = position;
        occupied.add(`${x},${y}`);
        candidates.splice(candidates.findIndex(candidate => candidate.x === x && candidate.y === y), 1);
        objects.push({ ...object, x, y });
    };
    const containers: Array<{ kind: MapObject['kind']; area: NonNullable<MapObject['area']>; name: string }> = [
        { kind: 'locker', area: 'living', name: '船员储物柜' },
        { kind: 'medical', area: 'living', name: '医疗柜' },
        { kind: 'safe', area: 'management', name: '保险箱' },
        { kind: 'archive', area: 'management', name: '档案终端' },
        { kind: 'server', area: 'management', name: '服务器容器' },
        { kind: 'lab', area: 'research', name: '低温样本舱' },
        { kind: 'archive', area: 'research', name: '数据档案柜' },
        { kind: 'server', area: 'research', name: '量子服务器' },
        { kind: 'supply', area: 'reactor', name: '机组补给箱' },
        { kind: 'reactor', area: 'reactor', name: '反应堆维护舱' },
        { kind: 'safe', area: 'core', name: '核心保险箱' },
        { kind: 'archive', area: 'core', name: '核心资料柜' },
        { kind: 'server', area: 'core', name: '主控服务器' },
        { kind: 'armory', area: 'engineering', name: '装备架' },
        { kind: 'locker', area: 'engineering', name: '工程储物柜' },
        { kind: 'medical', area: 'engineering', name: '医疗柜' },
    ];
    containers.forEach(({ kind, area, name }, index) => {
        place({
            id: `container-${index + 1}`, kind, area,
            name, searched: false, loot: mapLoot(kind, zone, area),
        });
    });
    const enemyCount = zone === 'chaos' ? 15 : 10;
    const enemyTypes = zone === 'chaos'
        ? [
            { type: 'hunter' as const, name: '追猎型人机', health: 1, attack: 1.2 },
            { type: 'brute' as const, name: '重装破阵机', health: 1.55, attack: 1.35 },
            { type: 'wraith' as const, name: '幽影侦察机', health: 0.8, attack: 1.05 },
            { type: 'elite' as const, name: '精英镇压机', health: 1.25, attack: 1.55 },
        ]
        : [
            { type: 'patrol' as const, name: '巡逻机', health: 1, attack: 1 },
            { type: 'scout' as const, name: '侦察蜂群机', health: 0.7, attack: 0.75 },
            { type: 'sentry' as const, name: '舱门哨戒机', health: 1.2, attack: 1.25 },
            { type: 'support' as const, name: '维修支援机', health: 0.9, attack: 0.85 },
        ];
    for (let index = 0; index < enemyCount; index++) {
        const bounds = ZONES[zone];
        const variant = enemyTypes[index % enemyTypes.length];
        const area = STATION_REGIONS[index % STATION_REGIONS.length].id;
        const health = Math.round(randomInt(bounds.enemyHealth[0], bounds.enemyHealth[1]) * variant.health);
        place({
            id: `enemy-${index + 1}`, kind: 'enemy',
            name: variant.name, enemyType: variant.type,
            area,
            defeated: false, health, maxHealth: health,
            attack: Math.round(randomInt(bounds.enemyAttack[0], bounds.enemyAttack[1]) * variant.attack),
            loot: enemyLoot(zone),
        });
    }
    return objects;
}

function stationArea(x: number, y: number): NonNullable<MapObject['area']> | undefined {
    const region = STATION_REGIONS.find(value => x >= value.x1 && x <= value.x2 && y >= value.y1 && y <= value.y2);
    return region?.id;
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

function backpackShape(tier: number): { width: number; height: number; hasCell: (x: number, y: number) => boolean } {
    if (tier === 1) return { width: 5, height: 4, hasCell: (x, y) => x < 4 || (x === 4 && y < 2) };
    const dimensions: Record<number, [number, number]> = {
        2: [4, 6], 3: [5, 6], 4: [6, 6], 5: [6, 7], 6: [6, 8],
    };
    const [width, height] = dimensions[tier] || dimensions[1];
    return { width, height, hasCell: (x, y) => x < width && y < height };
}

function cargoFitsBackpack(cargo: CargoItem[], tier: number): boolean {
    const shape = backpackShape(tier);
    const occupied = new Set<string>();
    for (const entry of cargo) {
        const definition = item(entry.key);
        const stackable = !['weapon', 'armor', 'backpack'].includes(definition.kind);
        const count = stackable ? 1 : entry.quantity;
        for (let unit = 0; unit < count; unit++) {
            let placed = false;
            for (let y = 0; y <= shape.height - (definition.height || 1) && !placed; y++) {
                for (let x = 0; x <= shape.width - (definition.width || 1) && !placed; x++) {
                    const cells: string[] = [];
                    for (let dy = 0; dy < (definition.height || 1); dy++) {
                        for (let dx = 0; dx < (definition.width || 1); dx++) cells.push(`${x + dx},${y + dy}`);
                    }
                    if (cells.every(cell => {
                        const [cellX, cellY] = cell.split(',').map(Number);
                        return shape.hasCell(cellX, cellY) && !occupied.has(cell);
                    })) {
                        cells.forEach(cell => occupied.add(cell));
                        placed = true;
                    }
                }
            }
            if (!placed) return false;
        }
    }
    return true;
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
    const items = (inventory.results || []).map(row => {
        const definition = item(row.item_key);
        const saleMaximum = definition.maxDurability || row.max_durability;
        const condition = saleMaximum > 0
            ? Math.max(0, Math.min(1, row.durability / saleMaximum))
            : 1;
        return {
            ...row,
            ...definition,
            sale_value: Math.floor(definition.value * condition),
        };
    });
    let run = null;
    if (activeRun) {
        const objects = safeJson<MapObject[]>(activeRun.map_json, []);
        const largeStation = isLargeStation(objects);
        const legacyStation = !largeStation && objects.some(object => object.kind === 'wall');
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
            map_width: largeStation ? STATION_WIDTH : legacyStation ? 8 : 6,
            map_height: largeStation ? STATION_HEIGHT : legacyStation ? 7 : 6,
            map_tiles: stationCellsFor(objects),
                map_regions: (largeStation ? STATION_REGIONS : []).map(({ id, name, x1, x2, y1, y2 }) => ({
                    id, name, x: (x1 + x2 + 1) * 36, y: (y1 + y2 + 1) * 36,
                })),
            capacity: kit.capacity, cargo_weight: totalWeight(cargo),
            cargo: cargo.map(entry => ({ ...entry, ...item(entry.key) })),
            backpack: { ...kit.backpack, ...item(kit.backpack.key), durability: kit.backpack.durability },
            weapon: { ...kit.weapon, ...item(kit.weapon.key), durability: kit.weapon.durability },
            armor: { ...kit.armor, ...item(kit.armor.key), durability: kit.armor.durability },
            objects: objects.map(({ loot, ...object }) => object),
            client_objects: objects,
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
        catalog: Object.values(ITEMS),
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
    if (!row) {
        return jsonRes({ error: '请选择仓库中的有效物品。' }, 400);
    }
    if (item(row.item_key).kind === 'weapon' && row.charges > 0) {
        return jsonRes({ error: '请先卸载武器中的星晶充能，再出售武器。' }, 409);
    }
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > Number(row.quantity)) {
        return jsonRes({ error: '出售数量无效。' }, 400);
    }
    const saleMaximum = item(row.item_key).maxDurability || row.max_durability;
    const condition = saleMaximum > 0
        ? Math.max(0, Math.min(1, row.durability / saleMaximum))
        : 1;
    const earned = Math.floor(item(row.item_key).value * condition) * quantity;
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
    return jsonRes({ ok: true, notice: `出售成功，获得 ${earned} 星币${condition < 1 ? '（已按耐久折价）' : ''}。`, state: await getState(env, player.user_id) });
}

async function unloadWeapon(env: Env, player: PlayerRow, body: Record<string, unknown>): Promise<Response> {
    const id = Number(body.item_id);
    const weapon = await env.DB.prepare(
        'SELECT * FROM salvage_inventory WHERE id = ? AND user_id = ?'
    ).bind(id, player.user_id).first<InventoryRow>();
    if (!weapon || item(weapon.item_key).kind !== 'weapon') {
        return jsonRes({ error: '请选择仓库中的有效武器。' }, 400);
    }
    const crystals = Math.floor(weapon.charges / 3);
    if (crystals < 1) return jsonRes({ error: '至少需要 3 点充能才能卸载 1 个完整星晶；剩余充能仍保留在武器中。' }, 409);
    const token = crypto.randomUUID();
    const result = await env.DB.batch([
        env.DB.prepare(`
            UPDATE salvage_players SET star_crystals = star_crystals + ?, last_action_token = ?
            WHERE user_id = ? AND last_action_token = ?
              AND NOT EXISTS (SELECT 1 FROM salvage_runs WHERE user_id = ? AND status = 'active')
              AND EXISTS (SELECT 1 FROM salvage_inventory WHERE id = ? AND user_id = ? AND charges >= ?)
        `).bind(crystals, token, player.user_id, player.last_action_token, player.user_id, id, player.user_id, crystals * 3),
        env.DB.prepare(`
            UPDATE salvage_inventory SET charges = charges - ?
            WHERE id = ? AND user_id = ? AND charges >= ?
              AND EXISTS (SELECT 1 FROM salvage_players WHERE user_id = ? AND last_action_token = ?)
        `).bind(crystals * 3, id, player.user_id, crystals * 3, player.user_id, token),
    ]);
    if (Number(result[0]?.meta?.changes || 0) !== 1 || Number(result[1]?.meta?.changes || 0) !== 1) {
        return jsonRes({ error: '武器或仓库状态已变化，请刷新后重试。' }, 409);
    }
    return jsonRes({ ok: true, notice: `已卸载 ${crystals} 个完整星晶；不足 3 次的剩余充能保留在武器中。`, state: await getState(env, player.user_id) });
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

async function buyCraftMaterials(env: Env, player: PlayerRow, body: Record<string, unknown>): Promise<Response> {
    const recipe = RECIPES.find(entry => entry.key === String(body.item || ''));
    if (!recipe) return jsonRes({ error: '请选择有效的制造配方。' }, 400);
    const inventory = await env.DB.prepare(
        'SELECT id, item_key, quantity, durability, max_durability, charges FROM salvage_inventory WHERE user_id = ?'
    ).bind(player.user_id).all<InventoryRow>();
    const rows = inventory.results || [];
    const missing = Object.entries(recipe.requirements).map(([key, required]) => {
        const owned = rows.filter(row => row.item_key === key).reduce((sum, row) => sum + Number(row.quantity), 0);
        return { key, quantity: Math.max(0, required - owned) };
    }).filter(entry => entry.quantity > 0);
    if (!missing.length) return jsonRes({ error: '制造材料已经齐全，无需购买。' }, 409);
    const cost = missing.reduce((sum, entry) => sum + Math.ceil(item(entry.key).price * 1.1) * entry.quantity, 0);
    if (player.star_coins < cost) return jsonRes({ error: `星币不足；补齐材料需要 ${cost} 星币。` }, 409);
    const token = crypto.randomUUID();
    const result = await env.DB.batch([
        env.DB.prepare(`
            UPDATE salvage_players SET star_coins = star_coins - ?, last_action_token = ?
            WHERE user_id = ? AND last_action_token = ? AND star_coins >= ?
              AND NOT EXISTS (SELECT 1 FROM salvage_runs WHERE user_id = ? AND status = 'active')
        `).bind(cost, token, player.user_id, player.last_action_token, cost, player.user_id),
        ...missing.map(entry => inventoryInsert(env, player.user_id, {
            key: entry.key, quantity: entry.quantity, durability: 0, maxDurability: 0, charges: 0,
        }, token)),
    ]);
    if (Number(result[0]?.meta?.changes || 0) !== 1) {
        return jsonRes({ error: '星币不足、正在对局，或档案状态已变化，请刷新后重试。' }, 409);
    }
    return jsonRes({
        ok: true,
        notice: `已按材料原价的 1.1 倍补齐制造材料，花费 ${cost} 星币。`,
        state: await getState(env, player.user_id),
    });
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
    const runCargo = runItems.filter(entry => entry.key === 'medkit');
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
        INSERT INTO salvage_runs (user_id, zone, x, y, health, max_health, map_json, cargo_json, kit_json)
        SELECT ?, ?, 7, 8, ?, ?, ?, ?, ? FROM salvage_players
        WHERE user_id = ? AND last_action_token = ?
    `).bind(
        player.user_id, zone, maxHealth, maxHealth, JSON.stringify(map), JSON.stringify(runCargo),
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
    changes: { x?: number; y?: number; health?: number; map?: MapObject[]; cargo?: CargoItem[]; kit?: unknown; status?: RunRow['status']; ended?: boolean; turnCost?: number },
): Promise<boolean> {
    const result = await env.DB.prepare(`
        UPDATE salvage_runs
        SET x = ?, y = ?, health = ?, turn = turn + ?, status = ?,
            map_json = ?, cargo_json = ?, kit_json = ?,
            ended_at = CASE WHEN ? THEN ? ELSE ended_at END
        WHERE id = ? AND user_id = ? AND status = 'active' AND turn = ?
    `).bind(
        changes.x ?? run.x,
        changes.y ?? run.y,
        changes.health ?? run.health,
        changes.turnCost ?? 1,
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
    const objects = safeJson<MapObject[]>(run.map_json, []);
    const hasStationWalls = objects.some(object => object.kind === 'wall');
    const x = Number(body.x);
    const y = Number(body.y);
    const inMap = hasStationWalls
        ? stationCellsFor(objects).some(tile => tile.x === x && tile.y === y)
        : Number(body.x) >= 0 && Number(body.x) <= 5 && Number(body.y) >= 0 && Number(body.y) <= 5;
    if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || !inMap
        || Math.abs(x - run.x) + Math.abs(y - run.y) !== 1) {
        return jsonRes({ error: '只能移动到相邻的开放舱室，墙体和舱站外不可通行。' }, 400);
    }
    const target = objects.find(object => object.x === x && object.y === y);
    if (target?.kind === 'wall') return jsonRes({ error: '舱段隔离墙阻挡了去路。' }, 409);
    if (target?.kind === 'enemy' && !target.defeated) return jsonRes({ error: '该位置有敌人阻挡，请先击败它。' }, 409);
    if (!await updateRun(env, run, { x, y })) return jsonRes({ error: '对局状态已变化，请刷新后继续。' }, 409);
    return jsonRes({ ok: true, notice: `已移动至坐标 ${x + 1}, ${y + 1}。`, state: await getState(env, run.user_id) });
}

async function searchContainer(run: RunRow, env: Env): Promise<Response> {
    const objects = safeJson<MapObject[]>(run.map_json, []);
    const object = objects.find(entry => entry.x === run.x && entry.y === run.y);
    if (!object || !isContainerKind(object.kind)) {
        return jsonRes({ error: '当前位置没有可搜索的容器。' }, 409);
    }
    if (object.searched && !(object.loot || []).length) return jsonRes({ error: '这个容器已经搜索过了。' }, 409);
    const cargo = safeJson<CargoItem[]>(run.cargo_json, []);
    const kit = loadout(run);
    const loot = object.loot || [];
    const added: CargoItem[] = [];
    const remaining: CargoItem[] = [];
    let nextCargo = [...cargo];
    for (const entry of loot) {
        const definition = item(entry.key);
        const availableWeight = kit.capacity - totalWeight(nextCargo);
        const quantity = definition.weight === 0
            ? entry.quantity
            : Math.min(entry.quantity, Math.floor(availableWeight / definition.weight));
        if (quantity < 1) {
            remaining.push(entry);
            continue;
        }
        const candidate = { ...entry, quantity };
        const packed = mergeCargo(nextCargo, [candidate]);
        if (cargoFitsBackpack(packed, item(kit.backpack.key).tier)) {
            added.push(candidate);
            nextCargo = packed;
            if (quantity < entry.quantity) remaining.push({ ...entry, quantity: entry.quantity - quantity });
        } else remaining.push(entry);
    }
    if (!added.length && loot.length) {
        return jsonRes({ error: '背包格子已满，整理物资或前往撤离点后再来搜索。' }, 409);
    }
    object.searched = true;
    object.loot = remaining;
    if (!await updateRun(env, run, { map: objects, cargo: nextCargo, turnCost: 2 })) {
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
    const damage = item(kit.weapon.key).damage || 10 + kit.weaponTier * 7;
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

async function finishClientRun(run: RunRow, env: Env, body: Record<string, unknown>): Promise<Response> {
        const result = body.result as Record<string, unknown> | undefined;
        if (!result || Number(result.run_id) !== run.id) {
            return jsonRes({ error: '对局记录无效或已过期，请刷新档案后重试。' }, 400);
        }
        const status = result.status;
        if (status !== 'extracted' && status !== 'dead') {
            return jsonRes({ error: '对局必须以成功撤离或阵亡结束。' }, 400);
        }
        const x = Number(result.x);
        const y = Number(result.y);
        const health = Number(result.health);
        const turn = Number(result.turn);
        if (![x, y, health, turn].every(Number.isSafeInteger) || turn < 0 || turn > 10000) {
            return jsonRes({ error: '对局坐标或行动记录无效。' }, 400);
        }

        const originalObjects = safeJson<MapObject[]>(run.map_json, []);
        const submittedObjects = result.objects;
        if (!Array.isArray(submittedObjects) || submittedObjects.length !== originalObjects.length) {
            return jsonRes({ error: '地图记录不完整，无法结算。' }, 400);
        }
        const resolvedObjects = originalObjects.map(original => {
            const submitted = submittedObjects.find((entry: unknown) =>
                Boolean(entry) && typeof entry === 'object' && (entry as Record<string, unknown>).id === original.id
            ) as Record<string, unknown> | undefined;
            if (!submitted || submitted.kind !== original.kind
                || Number(submitted.x) !== original.x || Number(submitted.y) !== original.y) {
                return null;
            }
            if (original.kind === 'enemy') {
                const enemyHealth = Number(submitted.health);
                if (!Number.isSafeInteger(enemyHealth) || enemyHealth < 0 || enemyHealth > Number(original.maxHealth || 0)
                    || Boolean(submitted.defeated) !== (enemyHealth === 0)) return null;
                return { ...original, health: enemyHealth, defeated: enemyHealth === 0 };
            }
            if (isContainerKind(original.kind)) {
                if (typeof submitted.searched !== 'boolean') return null;
                return { ...original, searched: submitted.searched };
            }
            return original;
        });
        if (resolvedObjects.some(object => object === null)) {
            return jsonRes({ error: '地图状态无效，无法结算。' }, 400);
        }
        const objects = resolvedObjects as MapObject[];
        const tile = stationTilesFor(originalObjects)
            .some(candidate => candidate.x === x && candidate.y === y);
        if (!tile || objects.some(object => object.kind === 'wall' && object.x === x && object.y === y)) {
            return jsonRes({ error: '结算位置不在有效的开放舱室。' }, 400);
        }
        if (status === 'extracted') {
            const exit = objects.find(object => object.kind === 'extract');
            const worldX = Number(result.world_x);
            const worldY = Number(result.world_y);
            if (!exit || !Number.isFinite(worldX) || !Number.isFinite(worldY)
                || Math.abs(exit.x + 0.5 - worldX / 72) + Math.abs(exit.y + 0.5 - worldY / 72) > 1.5
                || Math.floor(worldX / 72) !== x || Math.floor(worldY / 72) !== y
                || health < 1 || health > run.max_health) {
                return jsonRes({ error: '只有在撤离点存活时才能结算成功撤离。' }, 409);
            }
        } else if (health !== 0) {
            return jsonRes({ error: '阵亡记录必须包含 0 点生命值。' }, 400);
        }

        const initialKit = loadout(run);
        const submittedKit = result.kit as Record<string, CargoItem> | undefined;
        if (!submittedKit || ['backpack', 'weapon', 'armor'].some(kind => {
            const submitted = submittedKit[kind] as CargoItem | undefined;
            return !submitted || !ITEMS[submitted.key]
                || item(submitted.key).kind !== kind || submitted.quantity !== 1
                || !Number.isSafeInteger(submitted.durability) || submitted.durability < 0
                || !Number.isSafeInteger(submitted.maxDurability) || submitted.maxDurability < 0
                || !Number.isSafeInteger(submitted.charges) || submitted.charges < 0;
        })) {
            return jsonRes({ error: '出战装备记录无效。' }, 400);
        }
        const cargo = result.cargo;
        if (!Array.isArray(cargo) || cargo.length > 100) return jsonRes({ error: '背包记录无效。' }, 400);
        const allowedLoot = safeJson<CargoItem[]>(run.cargo_json, []).map(entry => ({ ...entry }));
        for (const object of objects) {
            if ((object.kind === 'enemy' && object.defeated)
                || (isContainerKind(object.kind) && object.searched)) {
                allowedLoot.push(...(object.loot || []));
            }
        }
        const availableCrystals = allowedLoot.filter(entry => entry.key === 'star_crystal')
            .reduce((sum, entry) => sum + entry.quantity, 0);
        const carriedCrystals = (cargo as CargoItem[]).filter(entry => entry && entry.key === 'star_crystal')
            .reduce((sum, entry) => sum + Number(entry.quantity || 0), 0);
        if (carriedCrystals > availableCrystals) return jsonRes({ error: '星晶数量超过本局可获得数量。' }, 400);
        const spentCrystals = availableCrystals - carriedCrystals;
        const gearSources = [
            ...allowedLoot.filter(entry => ['weapon', 'armor', 'backpack'].includes(item(entry.key).kind)),
            initialKit.backpack, initialKit.weapon, initialKit.armor,
        ].map(entry => ({ ...entry }));
        const gearClaims = [
            ...(cargo as CargoItem[]).filter(entry => entry && ITEMS[entry.key] && ['weapon', 'armor', 'backpack'].includes(item(entry.key).kind)),
            ...['backpack', 'weapon', 'armor'].map(kind => submittedKit![kind] as CargoItem),
        ];
        let extraChargesUsed = 0;
        for (const entry of gearClaims) {
            if (!entry || !ITEMS[entry.key] || !Number.isSafeInteger(entry.quantity) || entry.quantity !== 1
                || !Number.isSafeInteger(entry.durability) || entry.durability < 0
                || !Number.isSafeInteger(entry.maxDurability) || entry.maxDurability < 0
                || !Number.isSafeInteger(entry.charges) || entry.charges < 0) {
                return jsonRes({ error: '装备物品记录无效。' }, 400);
            }
            const sourceIndex = gearSources.findIndex(source =>
                source.key === entry.key
                && source.maxDurability === entry.maxDurability
                && entry.durability <= source.durability
                && entry.charges <= source.charges + spentCrystals * 3
            );
            if (sourceIndex < 0) return jsonRes({ error: '局内装备来源、耐久或充能无效。' }, 400);
            extraChargesUsed += Math.max(0, entry.charges - gearSources[sourceIndex].charges);
            gearSources.splice(sourceIndex, 1);
        }
        if (extraChargesUsed > spentCrystals * 3) return jsonRes({ error: '星晶充能数量超过本局消耗。' }, 400);
        for (const entry of cargo as CargoItem[]) {
            if (!entry || typeof entry.key !== 'string' || !ITEMS[entry.key]
                || !Number.isSafeInteger(entry.quantity) || entry.quantity < 1 || entry.quantity > 1000
                || !Number.isSafeInteger(entry.durability) || entry.durability < 0
                || !Number.isSafeInteger(entry.maxDurability) || entry.maxDurability < 0
                || !Number.isSafeInteger(entry.charges) || entry.charges < 0) {
                return jsonRes({ error: '背包中包含无效物品。' }, 400);
            }
            if (['weapon', 'armor', 'backpack'].includes(item(entry.key).kind)) continue;
            const matching = allowedLoot.filter(allowed => allowed.key === entry.key
                && allowed.durability === entry.durability
                && allowed.maxDurability === entry.maxDurability
                && allowed.charges === entry.charges)
                .reduce((sum, allowed) => sum + allowed.quantity, 0);
            const submittedQuantity = (cargo as CargoItem[]).filter(candidate =>
                candidate.key === entry.key && candidate.durability === entry.durability
                && candidate.maxDurability === entry.maxDurability && candidate.charges === entry.charges
            ).reduce((sum, candidate) => sum + candidate.quantity, 0);
            if (submittedQuantity > matching) return jsonRes({ error: '背包物品数量超过本局可获得数量。' }, 400);
        }
        const finalCargo = mergeCargo(cargo as CargoItem[], []);
        const finalCapacity = 12 + item(submittedKit!.backpack.key).tier * 6;
        if (totalWeight(finalCargo) > finalCapacity
            || !cargoFitsBackpack(finalCargo, item(submittedKit!.backpack.key).tier)) {
            return jsonRes({ error: '背包的格子空间或负重超过容量，无法结算。' }, 400);
        }

        const token = crypto.randomUUID();
        const returned = status === 'extracted'
            ? mergeCargo(finalCargo, [submittedKit!.backpack, submittedKit!.weapon, submittedKit!.armor])
            : [];
        const crystals = status === 'extracted'
            ? finalCargo.filter(entry => entry.key === 'star_crystal').reduce((sum, entry) => sum + entry.quantity, 0)
            : 0;
        const statements: TypedD1PreparedStatement[] = [
            env.DB.prepare(`
                UPDATE salvage_players SET star_crystals = star_crystals + ?, last_action_token = ?
                WHERE user_id = ? AND last_action_token = ?
                  AND EXISTS (SELECT 1 FROM salvage_runs WHERE id = ? AND user_id = ? AND status = 'active')
            `).bind(crystals, token, run.user_id, (await getPlayer(env, run.user_id)).last_action_token, run.id, run.user_id),
            env.DB.prepare(`
                UPDATE salvage_runs SET x = ?, y = ?, health = ?, turn = ?, status = ?,
                    map_json = ?, cargo_json = '[]', kit_json = '{}', ended_at = ?
                WHERE id = ? AND user_id = ? AND status = 'active' AND turn = ?
                  AND EXISTS (SELECT 1 FROM salvage_players WHERE user_id = ? AND last_action_token = ?)
            `).bind(
                x, y, status === 'dead' ? 0 : health, turn, status,
                JSON.stringify(objects), new Date().toISOString(), run.id, run.user_id, run.turn,
                run.user_id, token,
            ),
            ...returned.filter(entry => entry.key !== 'star_crystal')
                .map(entry => inventoryInsert(env, run.user_id, entry, token)),
        ];
        const saved = await env.DB.batch(statements);
        if (Number(saved[0]?.meta?.changes || 0) !== 1 || Number(saved[1]?.meta?.changes || 0) !== 1) {
            return jsonRes({ error: '对局或档案状态已变化，请刷新后重试。' }, 409);
        }
        return jsonRes({
            ok: true,
            notice: status === 'extracted' ? '成功撤离，本局记录已提交，带回物资已存入仓库。' : '本局阵亡记录已提交，入局物资全部遗失。',
            state: await getState(env, run.user_id),
        });
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
    if (path === '/api/salvage/unload') return unloadWeapon(env, player, body);
    if (path === '/api/salvage/sell') return sellLoot(env, player, body);
    if (path === '/api/salvage/repair') return repairArmor(env, player, body);
    if (path === '/api/salvage/craft') return startCraft(env, player, body);
    if (path === '/api/salvage/craft/materials') return buyCraftMaterials(env, player, body);
    if (path === '/api/salvage/craft/claim') return claimCraft(env, player, body);
    const run = await env.DB.prepare("SELECT * FROM salvage_runs WHERE user_id = ? AND status = 'active' LIMIT 1")
        .bind(userId).first<RunRow>();
    if (!run) return jsonRes({ error: '当前没有进行中的对局。' }, 409);
    if (path === '/api/salvage/finish') return finishClientRun(run, env, body);
    if (path === '/api/salvage/move') return move(run, body, env);
    if (path === '/api/salvage/search') return searchContainer(run, env);
    if (path === '/api/salvage/attack') return attack(run, env, body);
    if (path === '/api/salvage/heal') return heal(run, env);
    if (path === '/api/salvage/extract') return extract(run, env);
    return jsonRes({ error: '未知的空间站搜刮操作。' }, 404);
}
