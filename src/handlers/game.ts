import { getSessionUser, jsonRes } from '../utils/auth';
import type { Env } from '../env.d';

function todayKey() { return new Date().toISOString().slice(0, 10); }

export async function handleGame(request: Request, env: Env, path: string) {
    const user = await getSessionUser(env, request);
    if (!user) return jsonRes({ error: '请先登录' }, 403);
    await env.DB.prepare('INSERT OR IGNORE INTO garden_pets (user_id) VALUES (?)').bind(user.id).run();
    if (request.method === 'GET' && path === '/api/game/state') {
        return jsonRes({ pet: await env.DB.prepare('SELECT * FROM garden_pets WHERE user_id = ?').bind(user.id).first<any>() });
    }
    if (request.method !== 'POST') return jsonRes({ error: '请求方法不支持' }, 405);
    const action = path.slice('/api/game/'.length);
    const column = action === 'feed' ? 'last_fed_at' : action === 'train' ? 'last_trained_at' : action === 'explore' ? 'last_explored_at' : '';
    if (!column) return jsonRes({ error: '未知游戏操作' }, 404);
    const pet = await env.DB.prepare('SELECT * FROM garden_pets WHERE user_id = ?').bind(user.id).first<any>();
    if (!pet) return jsonRes({ error: '宠物初始化失败' }, 500);
    if (String(pet[column] || '').slice(0, 10) === todayKey()) return jsonRes({ error: '今天已经完成过这个行动' }, 429);
    const cost = action === 'feed' ? 0 : action === 'train' ? 20 : 10;
    if (Number(pet.energy) < cost) return jsonRes({ error: '宠物精力不足' }, 409);
    const gained = action === 'feed' ? 30 : action === 'train' ? 60 : 45;
    const totalExp = Number(pet.experience) + gained;
    const threshold = Number(pet.level) * 100;
    const level = Number(pet.level) + Math.floor(totalExp / threshold);
    const experience = totalExp % threshold;
    const energy = Math.min(100, Number(pet.energy) - cost + (action === 'feed' ? 15 : 0));
    await env.DB.prepare(`UPDATE garden_pets SET experience = ?, level = ?, energy = ?, ${column} = ? WHERE user_id = ?`)
        .bind(experience, level, energy, new Date().toISOString(), user.id).run();
    if (action === 'explore') await env.DB.prepare('UPDATE users SET points = points + 5 WHERE id = ?').bind(user.id).run();
    return jsonRes({ ok: true, pet: await env.DB.prepare('SELECT * FROM garden_pets WHERE user_id = ?').bind(user.id).first<any>(), reward: action === 'explore' ? 5 : 0 });
}
