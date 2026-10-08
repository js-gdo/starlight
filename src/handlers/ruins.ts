import { getSessionUser, jsonRes } from '../utils/auth';
import type { Env, TypedD1PreparedStatement } from '../env.d';

const MAX_STAMINA = 10;
const RUN_STAMINA_COST = 3;
const WEAPON_CAP = 25;
const ARMOR_CAP = 25;
const POTION_CAP = 10;

const CLASSES = {
    guardian: { name: '守卫', icon: 'fa-shield-halved', description: '高生命与防御，适合稳扎稳打。', hp: 125, attack: 14, defense: 7, skill: '盾击', skillMultiplier: 2.1 },
    ranger: { name: '游侠', icon: 'fa-bow-arrow', description: '行动敏捷，攻击有更高几率造成暴击。', hp: 95, attack: 19, defense: 3, skill: '穿云箭', skillMultiplier: 2.5 },
    arcanist: { name: '秘术师', icon: 'fa-wand-sparkles', description: '擅长爆发魔法，技能伤害最高。', hp: 85, attack: 16, defense: 2, skill: '星火术', skillMultiplier: 2.9 },
} as const;

const MONSTERS = [
    { key: 'mossling', name: '苔原史莱姆', hp: 27, attack: 7, xp: 22, gold: 18 },
    { key: 'bone_guard', name: '遗迹骸骨兵', hp: 36, attack: 9, xp: 30, gold: 25 },
    { key: 'shade_wolf', name: '幽影狼', hp: 31, attack: 12, xp: 33, gold: 29 },
    { key: 'rune_golem', name: '符文石像', hp: 50, attack: 10, xp: 40, gold: 35 },
] as const;

type Player = {
    user_id: number;
    class_key: keyof typeof CLASSES;
    level: number;
    experience: number;
    gold: number;
    crystals: number;
    potions: number;
    stamina: number;
    stamina_updated_at: string;
    weapon_level: number;
    armor_level: number;
    best_floor: number;
    defeated_monsters: number;
    completed_runs: number;
    last_daily_claim: string;
    daily_streak: number;
};

type Run = {
    id: number;
    floor: number;
    room: number;
    room_type: 'monster' | 'treasure' | 'camp' | 'shrine';
    room_cleared: number;
    hp: number;
    monster_key: string;
    monster_name: string;
    monster_hp: number;
    monster_max_hp: number;
    monster_attack: number;
    skill_ready_turn: number;
    turn: number;
    status: string;
};

export function getRuinsStats(player: Pick<Player, 'class_key' | 'level' | 'weapon_level' | 'armor_level'>) {
    const heroClass = CLASSES[player.class_key] || CLASSES.guardian;
    return {
        maxHp: heroClass.hp + (player.level - 1) * 9 + player.armor_level * 7,
        attack: heroClass.attack + (player.level - 1) * 2 + player.weapon_level * 3,
        defense: heroClass.defense + Math.floor((player.level - 1) / 2) + player.armor_level * 2,
    };
}

export function computeRuinsDamage(attack: number, defense: number, critical = false): number {
    return Math.max(1, Math.floor(attack * (critical ? 1.8 : 1)) - defense);
}

function chinaDate(now = new Date()): string {
    return new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function ensurePlayer(env: Env, userId: number): Promise<void> {
    await env.DB.prepare('INSERT OR IGNORE INTO ruins_players (user_id) VALUES (?)').bind(userId).run();
}

async function syncStamina(env: Env, player: Player): Promise<void> {
    const parsed = Date.parse(player.stamina_updated_at);
    if (!Number.isFinite(parsed)) return;
    const now = Date.now();
    const current = Number(player.stamina);
    if (current >= MAX_STAMINA) {
        if (now - parsed >= 60 * 60 * 1000) {
            await env.DB.prepare(
                'UPDATE ruins_players SET stamina_updated_at = ? WHERE user_id = ? AND stamina = ? AND stamina_updated_at = ?'
            ).bind(new Date(now).toISOString(), player.user_id, current, player.stamina_updated_at).run();
        }
        return;
    }
    const recovered = Math.min(MAX_STAMINA - current, Math.floor(Math.max(0, now - parsed) / (60 * 60 * 1000)));
    if (recovered <= 0) return;
    const updatedAt = current + recovered >= MAX_STAMINA
        ? new Date(now).toISOString()
        : new Date(parsed + recovered * 60 * 60 * 1000).toISOString();
    await env.DB.prepare(`
        UPDATE ruins_players SET stamina = stamina + ?, stamina_updated_at = ?
        WHERE user_id = ? AND stamina = ? AND stamina_updated_at = ?
    `).bind(recovered, updatedAt, player.user_id, current, player.stamina_updated_at).run();
}

function makeRoom(floor: number, room: number) {
    if (room === 5) {
        const base = 80 + floor * 22;
        return {
            type: 'monster' as const,
            monster: { key: 'guardian_boss', name: `第 ${floor} 层·遗迹守门者`, hp: base, attack: 12 + floor * 3, xp: 110 + floor * 16, gold: 95 + floor * 14 },
        };
    }
    const roll = Math.random();
    if (roll < 0.61) {
        const template = MONSTERS[randomInt(0, MONSTERS.length - 1)];
        const multiplier = 1 + (floor - 1) * 0.18;
        return {
            type: 'monster' as const,
            monster: {
                key: template.key,
                name: template.name,
                hp: Math.ceil(template.hp * multiplier),
                attack: Math.ceil(template.attack * (1 + (floor - 1) * 0.14)),
                xp: Math.ceil(template.xp * multiplier),
                gold: Math.ceil(template.gold * multiplier),
            },
        };
    }
    if (roll < 0.79) return { type: 'treasure' as const, monster: null };
    if (roll < 0.94) return { type: 'camp' as const, monster: null };
    return { type: 'shrine' as const, monster: null };
}

async function getState(env: Env, userId: number) {
    await ensurePlayer(env, userId);
    let player = await env.DB.prepare('SELECT * FROM ruins_players WHERE user_id = ?').bind(userId).first<Player>();
    if (!player) throw new Error('Ruins player initialization failed.');
    await syncStamina(env, player);
    player = await env.DB.prepare('SELECT * FROM ruins_players WHERE user_id = ?').bind(userId).first<Player>();
    if (!player) throw new Error('Ruins player disappeared after stamina update.');

    const [activeRun, standings, recentRuns, historyCount] = await Promise.all([
        env.DB.prepare("SELECT * FROM ruins_runs WHERE user_id = ? AND status = 'active' LIMIT 1").bind(userId).first<Run>(),
        env.DB.prepare(`
            SELECT p.user_id, u.username, p.level, p.best_floor, p.defeated_monsters, p.completed_runs,
                   p.level * 120 + p.best_floor * 550 + p.defeated_monsters * 12 + p.completed_runs * 100 AS score
            FROM ruins_players p JOIN users u ON u.id = p.user_id
            WHERE u.use = 1
            ORDER BY score DESC, p.best_floor DESC, p.user_id
            LIMIT 20
        `).all<any>(),
        env.DB.prepare(`
            SELECT floor, status, started_at, completed_at
            FROM ruins_runs WHERE user_id = ? ORDER BY id DESC LIMIT 8
        `).bind(userId).all<any>(),
        env.DB.prepare('SELECT COUNT(*) AS count FROM ruins_runs WHERE user_id = ?').bind(userId).first<{ count: number }>(),
    ]);
    const stats = getRuinsStats(player);
    const nextLevelXp = player.level * 100;
    const weaponCost = Math.ceil(90 * Math.pow(1.42, player.weapon_level - 1));
    const armorCost = Math.ceil(80 * Math.pow(1.42, player.armor_level - 1));
    return {
        player: {
            ...player,
            class_name: CLASSES[player.class_key]?.name || CLASSES.guardian.name,
            class_icon: CLASSES[player.class_key]?.icon || CLASSES.guardian.icon,
            class_description: CLASSES[player.class_key]?.description || CLASSES.guardian.description,
            skill_name: CLASSES[player.class_key]?.skill || CLASSES.guardian.skill,
            ...stats,
            next_level_xp: nextLevelXp,
            stamina_cap: MAX_STAMINA,
            stamina_recovery_minutes: 60,
            can_claim_daily: player.last_daily_claim !== chinaDate(),
            weapon_cost: player.weapon_level >= WEAPON_CAP ? null : weaponCost,
            armor_cost: player.armor_level >= ARMOR_CAP ? null : armorCost,
            potion_cost: 35,
        },
        run: activeRun,
        leaderboard: standings.results || [],
        recent_runs: recentRuns.results || [],
        class_locked: Number(historyCount?.count || 0) > 0,
        classes: Object.entries(CLASSES).map(([key, value]) => ({ key, ...value })),
        room_limit: 5,
        run_stamina_cost: RUN_STAMINA_COST,
    };
}

function parseBody(request: Request): Promise<Record<string, unknown> | null> {
    return request.json().then((value: unknown) =>
        value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
    ).catch(() => null);
}

async function createRun(env: Env, user: Player): Promise<Response> {
    await syncStamina(env, user);
    const refreshedPlayer = await env.DB.prepare('SELECT * FROM ruins_players WHERE user_id = ?').bind(user.user_id).first<Player>();
    if (!refreshedPlayer) throw new Error('Ruins player initialization failed.');
    user = refreshedPlayer;
    const stats = getRuinsStats(user);
    const floor = Number(user.best_floor) + 1;
    const room = makeRoom(floor, 1);
    const now = new Date().toISOString();
    const launchToken = crypto.randomUUID();
    const statements: TypedD1PreparedStatement[] = [
        env.DB.prepare(`
            INSERT INTO ruins_runs
                (user_id, floor, room, room_type, hp, monster_key, monster_name,
                 monster_hp, monster_max_hp, monster_attack, started_at, launch_token)
            SELECT ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?
            WHERE EXISTS (SELECT 1 FROM ruins_players WHERE user_id = ? AND stamina >= ?)
              AND NOT EXISTS (SELECT 1 FROM ruins_runs WHERE user_id = ? AND status = 'active')
        `).bind(
            user.user_id, floor, room.type, stats.maxHp, room.monster?.key || '', room.monster?.name || '',
            room.monster?.hp || 0, room.monster?.hp || 0, room.monster?.attack || 0, now, launchToken,
            user.user_id, RUN_STAMINA_COST, user.user_id,
        ),
        env.DB.prepare(`
            UPDATE ruins_players SET stamina = stamina - ?, stamina_updated_at = ?
            WHERE user_id = ? AND stamina >= ?
              AND EXISTS (SELECT 1 FROM ruins_runs WHERE launch_token = ? AND user_id = ?)
        `).bind(RUN_STAMINA_COST, now, user.user_id, RUN_STAMINA_COST, launchToken, user.user_id),
    ];
    const result = await env.DB.batch(statements);
    if (Number(result[0]?.meta?.changes || 0) !== 1) {
        const active = await env.DB.prepare("SELECT id FROM ruins_runs WHERE user_id = ? AND status = 'active'").bind(user.user_id).first();
        return jsonRes({ error: active ? '你已经在遗迹中，先完成或撤退。' : '体力不足，等待恢复或领取每日补给。' }, 409);
    }
    return jsonRes({ ok: true, state: await getState(env, user.user_id) });
}

function progressAfterXp(player: Player, gained: number) {
    let level = Number(player.level);
    let experience = Number(player.experience) + gained;
    while (experience >= level * 100) {
        experience -= level * 100;
        level++;
    }
    return { level, experience };
}

async function takeTurn(env: Env, user: Player, body: Record<string, unknown>): Promise<Response> {
    const action = typeof body.action === 'string' ? body.action : '';
    const expectedTurn = Number(body.turn);
    if (!Number.isSafeInteger(expectedTurn) || expectedTurn < 0) return jsonRes({ error: '回合编号无效，请刷新游戏状态。' }, 400);
    const run = await env.DB.prepare("SELECT * FROM ruins_runs WHERE user_id = ? AND status = 'active'").bind(user.user_id).first<Run>();
    if (!run) return jsonRes({ error: '当前没有进行中的远征。' }, 409);
    if (run.turn !== expectedTurn) return jsonRes({ error: '遗迹状态已更新，请刷新后继续。' }, 409);
    if (run.room_cleared) return jsonRes({ error: '本房间已经探索完毕，请前往下一间。' }, 409);

    let hp = Number(run.hp);
    let monsterHp = Number(run.monster_hp);
    let skillReadyTurn = Number(run.skill_ready_turn);
    let rewardXp = 0;
    let rewardGold = 0;
    let rewardCrystals = 0;
    let potionDelta = 0;
    let defeated = false;
    let cleared = false;
    let notice = '';
    const stats = getRuinsStats(user);
    const heroClass = CLASSES[user.class_key] || CLASSES.guardian;
    const isMonster = run.room_type === 'monster';

    if (isMonster) {
        if (!['attack', 'skill', 'guard', 'potion'].includes(action)) return jsonRes({ error: '无效的战斗行动。' }, 400);
        if (action === 'potion') {
            if (Number(user.potions) <= 0) return jsonRes({ error: '治疗药剂不足，可在营地或商店补充。' }, 409);
            const heal = Math.min(stats.maxHp - hp, Math.ceil(stats.maxHp * 0.42));
            if (heal <= 0) return jsonRes({ error: '生命值已满，不需要使用药剂。' }, 409);
            hp += heal;
            potionDelta = -1;
            notice = `使用药剂恢复了 ${heal} 点生命。`;
        } else if (action === 'guard') {
            notice = '摆好防御架势，抵挡本回合的攻击。';
        } else {
            if (action === 'skill' && expectedTurn < skillReadyTurn) {
                return jsonRes({ error: `技能冷却中，还需 ${skillReadyTurn - expectedTurn} 回合。` }, 409);
            }
            const critical = user.class_key === 'ranger' && Math.random() < 0.22;
            const multiplier = action === 'skill' ? heroClass.skillMultiplier : 1;
            const damage = computeRuinsDamage(Math.ceil(stats.attack * multiplier) + randomInt(0, Math.ceil(stats.attack * 0.35)), 0, critical);
            monsterHp = Math.max(0, monsterHp - damage);
            notice = `${action === 'skill' ? `${heroClass.skill}命中` : '攻击命中'}，造成 ${damage} 点伤害${critical ? '（暴击）' : ''}。`;
            if (action === 'skill') skillReadyTurn = expectedTurn + 3;
        }
        if (monsterHp <= 0) {
            defeated = true;
            cleared = true;
            const template = MONSTERS.find((monster) => monster.key === run.monster_key);
            const scale = run.monster_key === 'guardian_boss' ? 1 : 1 + (Number(run.floor) - 1) * 0.18;
            rewardXp = template ? Math.ceil(template.xp * scale) : 110 + Number(run.floor) * 16;
            rewardGold = template ? Math.ceil(template.gold * scale) : 95 + Number(run.floor) * 14;
            if (run.monster_key === 'guardian_boss') rewardCrystals = Math.max(1, Math.ceil(Number(run.floor) / 2));
            notice += ` 击败 ${run.monster_name}，获得 ${rewardXp} 经验和 ${rewardGold} 金币${rewardCrystals ? `、${rewardCrystals} 星晶` : ''}。`;
        } else {
            const incoming = Math.max(1, Number(run.monster_attack) - Math.floor(stats.defense * 0.55));
            const taken = action === 'guard' || user.class_key === 'guardian' && action === 'skill'
                ? Math.max(1, Math.floor(incoming * (action === 'guard' ? 0.42 : 0.65)))
                : incoming;
            hp = Math.max(0, hp - taken);
            notice += ` ${run.monster_name}反击，造成 ${taken} 点伤害。`;
            if (hp <= 0) {
                defeated = true;
                notice += ' 你在遗迹中倒下了，本次远征结束。';
            }
        }
    } else {
        const choices: Record<string, { cleared: boolean; hp: number; xp: number; gold: number; crystals: number; potion: number; notice: string }> = {
            treasure_open: {
                cleared: true, hp, xp: 0, gold: randomInt(35, 65) + run.floor * 8,
                crystals: Math.random() < 0.45 ? 1 : 0, potion: 0, notice: '宝箱打开了，里面有金币和一些稀有星晶。',
            },
            treasure_careful: {
                cleared: true, hp, xp: 8, gold: randomInt(20, 40) + run.floor * 5,
                crystals: 0, potion: 0, notice: '你仔细拆除了机关，拿到少量金币和探索经验。',
            },
            camp_rest: {
                cleared: true, hp: Math.min(stats.maxHp, hp + Math.ceil(stats.maxHp * 0.32)),
                xp: 0, gold: 0, crystals: 0, potion: 0, notice: '在营地休整，恢复了部分生命值。',
            },
            camp_train: {
                cleared: true, hp, xp: 28 + run.floor * 3, gold: 0, crystals: 0, potion: 0,
                notice: '你利用营地磨练技巧，获得额外经验。',
            },
            shrine_heal: {
                cleared: true, hp: Math.min(stats.maxHp, hp + Math.ceil(stats.maxHp * 0.5)),
                xp: 0, gold: 0, crystals: 0, potion: 0, notice: '遗迹神龛治愈了你的伤势。',
            },
            shrine_bless: {
                cleared: true, hp, xp: 38 + run.floor * 4, gold: 0, crystals: 2, potion: 0,
                notice: '你接受了星辉祝福，获得经验与星晶。',
            },
        };
        const choice = choices[action];
        if (!choice || !(action.startsWith(run.room_type))) return jsonRes({ error: '这个房间没有该选项。' }, 400);
        hp = choice.hp;
        rewardXp = choice.xp;
        rewardGold = choice.gold;
        rewardCrystals = choice.crystals;
        cleared = choice.cleared;
        notice = choice.notice;
    }

    const newTurn = expectedTurn + 1;
    const status = hp <= 0 ? 'defeated' : 'active';
    const nextProgress = progressAfterXp(user, rewardXp);
    const levelUp = nextProgress.level - Number(user.level);
    if (levelUp > 0) {
        hp = Math.min(stats.maxHp + levelUp * 9, hp + levelUp * 9);
        notice += ` 等级提升至 ${nextProgress.level} 级！`;
    }
    const now = new Date().toISOString();
    const actionToken = crypto.randomUUID();
    const statements: TypedD1PreparedStatement[] = [
        env.DB.prepare(`
            UPDATE ruins_runs
            SET hp = ?, monster_hp = ?, room_cleared = ?, skill_ready_turn = ?,
                turn = ?, status = ?, last_action_token = ?,
                completed_at = CASE WHEN ? != 'active' THEN ? ELSE completed_at END
            WHERE id = ? AND user_id = ? AND status = 'active' AND turn = ? AND room_cleared = 0
        `).bind(
            hp, monsterHp, cleared ? 1 : 0, skillReadyTurn, newTurn, status, actionToken, status, now,
            run.id, user.user_id, expectedTurn,
        ),
        env.DB.prepare(`
            UPDATE ruins_players
            SET experience = ?, level = ?, gold = gold + ?, crystals = crystals + ?,
                potions = MAX(0, potions + ?), defeated_monsters = defeated_monsters + ?
            WHERE user_id = ? AND level = ? AND experience = ?
              AND EXISTS (SELECT 1 FROM ruins_runs WHERE id = ? AND user_id = ? AND turn = ? AND last_action_token = ?)
        `).bind(
            nextProgress.experience, nextProgress.level, rewardGold, rewardCrystals, potionDelta,
            defeated && isMonster && monsterHp <= 0 ? 1 : 0,
            user.user_id, user.level, user.experience, run.id, user.user_id, newTurn, actionToken,
        ),
    ];
    const result = await env.DB.batch(statements);
    if (Number(result[0]?.meta?.changes || 0) !== 1) return jsonRes({ error: '行动未生效，遗迹状态已变化，请刷新。' }, 409);
    return jsonRes({ ok: true, notice, state: await getState(env, user.user_id) });
}

async function advanceRoom(env: Env, user: Player, body: Record<string, unknown>): Promise<Response> {
    const expectedTurn = Number(body.turn);
    if (!Number.isSafeInteger(expectedTurn) || expectedTurn < 0) return jsonRes({ error: '回合编号无效。' }, 400);
    const run = await env.DB.prepare("SELECT * FROM ruins_runs WHERE user_id = ? AND status = 'active'").bind(user.user_id).first<Run>();
    if (!run) return jsonRes({ error: '当前没有进行中的远征。' }, 409);
    if (Number(run.turn) !== expectedTurn) return jsonRes({ error: '遗迹状态已更新，请刷新后继续。' }, 409);
    if (!run.room_cleared) return jsonRes({ error: '先完成当前房间的战斗或探索。' }, 409);

    const now = new Date().toISOString();
    if (run.room >= 5) {
        const actionToken = crypto.randomUUID();
        const results = await env.DB.batch([
            env.DB.prepare(`
                UPDATE ruins_runs SET status = 'completed', completed_at = ?, turn = turn + 1, last_action_token = ?
                WHERE id = ? AND user_id = ? AND status = 'active' AND turn = ? AND room_cleared = 1
            `).bind(now, actionToken, run.id, user.user_id, expectedTurn),
            env.DB.prepare(`
                UPDATE ruins_players SET best_floor = MAX(best_floor, ?), completed_runs = completed_runs + 1
                WHERE user_id = ? AND EXISTS (
                    SELECT 1 FROM ruins_runs
                    WHERE id = ? AND user_id = ? AND status = 'completed' AND turn = ? AND last_action_token = ?
                )
            `).bind(run.floor, user.user_id, run.id, user.user_id, expectedTurn + 1, actionToken),
        ]);
        if (Number(results[0]?.meta?.changes || 0) !== 1) return jsonRes({ error: '远征状态已变化，请刷新。' }, 409);
        return jsonRes({ ok: true, notice: `恭喜！你攻克了第 ${run.floor} 层，新的遗迹层数已解锁。`, state: await getState(env, user.user_id) });
    }

    const nextRoomNumber = Number(run.room) + 1;
    const nextRoom = makeRoom(Number(run.floor), nextRoomNumber);
    const results = await env.DB.prepare(`
        UPDATE ruins_runs SET room = ?, room_type = ?, room_cleared = 0,
            monster_key = ?, monster_name = ?, monster_hp = ?, monster_max_hp = ?,
            monster_attack = ?, guarding = 0, turn = turn + 1
        WHERE id = ? AND user_id = ? AND status = 'active' AND turn = ? AND room_cleared = 1
    `).bind(
        nextRoomNumber, nextRoom.type, nextRoom.monster?.key || '', nextRoom.monster?.name || '',
        nextRoom.monster?.hp || 0, nextRoom.monster?.hp || 0, nextRoom.monster?.attack || 0,
        run.id, user.user_id, expectedTurn,
    ).run();
    if (Number(results.meta?.changes || 0) !== 1) return jsonRes({ error: '前往下一间时状态已变化，请刷新。' }, 409);
    return jsonRes({ ok: true, notice: `你进入了第 ${run.floor} 层的第 ${nextRoomNumber} 个房间。`, state: await getState(env, user.user_id) });
}

async function upgradeGear(env: Env, player: Player, kind: unknown): Promise<Response> {
    if (kind !== 'weapon' && kind !== 'armor') return jsonRes({ error: '未知装备类型。' }, 400);
    const level = kind === 'weapon' ? Number(player.weapon_level) : Number(player.armor_level);
    const cap = kind === 'weapon' ? WEAPON_CAP : ARMOR_CAP;
    if (level >= cap) return jsonRes({ error: '装备已经达到最高等级。' }, 409);
    const goldCost = Math.ceil((kind === 'weapon' ? 90 : 80) * Math.pow(1.42, level - 1));
    const crystalCost = Math.floor(level / 4) + (kind === 'weapon' ? 0 : 1);
    const column = kind === 'weapon' ? 'weapon_level' : 'armor_level';
    const result = await env.DB.prepare(`
        UPDATE ruins_players SET ${column} = ${column} + 1, gold = gold - ?, crystals = crystals - ?
        WHERE user_id = ? AND ${column} = ? AND gold >= ? AND crystals >= ?
          AND NOT EXISTS (SELECT 1 FROM ruins_runs WHERE user_id = ? AND status = 'active')
    `).bind(goldCost, crystalCost, player.user_id, level, goldCost, crystalCost, player.user_id).run();
    if (Number(result.meta?.changes || 0) !== 1) {
        const active = await env.DB.prepare("SELECT id FROM ruins_runs WHERE user_id = ? AND status = 'active'").bind(player.user_id).first();
        return jsonRes({ error: active ? '远征途中无法交易，请撤退或完成本层后再强化。' : '金币或星晶不足，或装备已被其他操作升级。' }, 409);
    }
    return jsonRes({ ok: true, notice: `${kind === 'weapon' ? '武器' : '护甲'}强化至 Lv.${level + 1}。`, state: await getState(env, player.user_id) });
}

async function buyPotion(env: Env, player: Player): Promise<Response> {
    const result = await env.DB.prepare(`
        UPDATE ruins_players SET gold = gold - 35, potions = potions + 1
        WHERE user_id = ? AND gold >= 35 AND potions < ?
          AND NOT EXISTS (SELECT 1 FROM ruins_runs WHERE user_id = ? AND status = 'active')
    `).bind(player.user_id, POTION_CAP, player.user_id).run();
    if (Number(result.meta?.changes || 0) !== 1) {
        const active = await env.DB.prepare("SELECT id FROM ruins_runs WHERE user_id = ? AND status = 'active'").bind(player.user_id).first();
        if (active) return jsonRes({ error: '远征途中无法购物，撤退或完成本层后再补充药剂。' }, 409);
        return jsonRes({ error: Number(player.potions) >= POTION_CAP ? '药剂携带量已满。' : '金币不足。' }, 409);
    }
    return jsonRes({ ok: true, notice: '购买了 1 瓶治疗药剂。', state: await getState(env, player.user_id) });
}

async function claimDaily(env: Env, player: Player): Promise<Response> {
    const today = chinaDate();
    const yesterday = chinaDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
    const result = await env.DB.prepare(`
        UPDATE ruins_players
        SET daily_streak = CASE WHEN last_daily_claim = ? THEN MIN(daily_streak + 1, 30) ELSE 1 END,
            gold = gold + 70 + 15 * CASE WHEN last_daily_claim = ? THEN MIN(daily_streak + 1, 30) ELSE 1 END,
            crystals = crystals + 2,
            potions = MIN(potions + 1, ?),
            stamina = MIN(stamina + 3, ?),
            last_daily_claim = ?,
            stamina_updated_at = ?
        WHERE user_id = ? AND last_daily_claim != ?
    `).bind(yesterday, yesterday, POTION_CAP, MAX_STAMINA, today, new Date().toISOString(), player.user_id, today).run();
    if (Number(result.meta?.changes || 0) !== 1) return jsonRes({ error: '今日悬赏补给已经领取，明天再来。' }, 409);
    return jsonRes({ ok: true, notice: '领取了金币、星晶、药剂和 3 点体力。', state: await getState(env, player.user_id) });
}

async function selectClass(env: Env, player: Player, classKey: unknown): Promise<Response> {
    if (typeof classKey !== 'string' || !Object.hasOwn(CLASSES, classKey)) {
        return jsonRes({ error: '请选择有效的职业。' }, 400);
    }
    const result = await env.DB.prepare(`
        UPDATE ruins_players SET class_key = ?
        WHERE user_id = ? AND NOT EXISTS (SELECT 1 FROM ruins_runs WHERE user_id = ?)
    `).bind(classKey, player.user_id, player.user_id).run();
    if (Number(result.meta?.changes || 0) !== 1) return jsonRes({ error: '进入遗迹后不能更换职业。' }, 409);
    return jsonRes({ ok: true, notice: `已选择${CLASSES[classKey as keyof typeof CLASSES].name}。`, state: await getState(env, player.user_id) });
}

async function retreat(env: Env, user: Player, body: Record<string, unknown>): Promise<Response> {
    const turn = Number(body.turn);
    const result = await env.DB.prepare(`
        UPDATE ruins_runs SET status = 'retreated', completed_at = ?, turn = turn + 1
        WHERE user_id = ? AND status = 'active' AND turn = ?
    `).bind(new Date().toISOString(), user.user_id, turn).run();
    if (Number(result.meta?.changes || 0) !== 1) return jsonRes({ error: '当前远征状态已变化，请刷新。' }, 409);
    return jsonRes({ ok: true, notice: '你已安全撤出遗迹，本次尚未领取的探索奖励作废。', state: await getState(env, user.user_id) });
}

export async function handleRuins(request: Request, env: Env, path: string): Promise<Response> {
    const user = await getSessionUser(env, request);
    if (!user) return jsonRes({ error: '请先登录后再进入遗迹远征。' }, 403);
    await ensurePlayer(env, Number(user.id));
    if (request.method === 'GET' && path === '/api/ruins/state') {
        return jsonRes({ ok: true, ...(await getState(env, Number(user.id))) });
    }
    if (request.method !== 'POST') return jsonRes({ error: '请求方法不支持。' }, 405);
    const body = await parseBody(request);
    if (!body) return jsonRes({ error: '请求内容必须是有效的 JSON 对象。' }, 400);
    const player = await env.DB.prepare('SELECT * FROM ruins_players WHERE user_id = ?').bind(user.id).first<Player>();
    if (!player) throw new Error('Ruins player initialization failed.');
    if (path === '/api/ruins/run/start') return createRun(env, player);
    if (path === '/api/ruins/run/action') return takeTurn(env, player, body);
    if (path === '/api/ruins/run/advance') return advanceRoom(env, player, body);
    if (path === '/api/ruins/run/retreat') return retreat(env, player, body);
    if (path === '/api/ruins/class/select') return selectClass(env, player, body.class);
    if (path === '/api/ruins/gear/upgrade') return upgradeGear(env, player, body.kind);
    if (path === '/api/ruins/shop/potion') return buyPotion(env, player);
    if (path === '/api/ruins/daily/claim') return claimDaily(env, player);
    return jsonRes({ error: '未知的遗迹远征操作。' }, 404);
}
