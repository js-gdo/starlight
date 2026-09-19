import { getSessionUser, jsonRes } from '../utils/auth';
import type { Env } from '../env.d';

const REWARDS: Record<string, number> = { E1: 30, E3: 5, E4: 50, E2: 0 };
const ENDING_NAMES: Record<string, string> = {
    E1: '第一个原住民',
    E2: '它消失了',
    E3: '未说出口的话',
    E4: '第一个',
};

function parseEndings(value: unknown): string[] {
    try {
        const parsed = JSON.parse(String(value || '[]'));
        return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
        return [];
    }
}

function isValidEnding(ending: string, choices: unknown): boolean {
    if (!Array.isArray(choices) || !choices.every(choice => Number.isInteger(choice))) return false;
    const selected = choices as number[];
    if (!selected.length) return false;
    let node = 'N1';
    for (const choice of selected.slice(0, -1)) {
        if (node === 'N1' && (choice === 0 || choice === 1)) node = 'N2';
        else if (node === 'N2' && (choice === 0 || choice === 2)) node = 'N3';
        else if (node === 'N2' && choice === 1) node = 'N4';
        else if (node === 'N3' && choice === 0) node = 'N5';
        else if (node === 'N3' && (choice === 1 || choice === 2)) node = 'N4';
        else if (node === 'N4' && (choice === 0 || choice === 1)) node = 'N5';
        else return false;
    }
    const finalChoice = selected[selected.length - 1];
    if (ending === 'E3') return node === 'N1' && finalChoice === 2;
    if (ending === 'E2') return (node === 'N1' && finalChoice === 3) || (node === 'N4' && finalChoice === 2);
    if (node !== 'N5') return false;
    const suspicion = selected.slice(0, -1).filter(choice => choice === 1).length;
    if (ending === 'E4') return finalChoice === 3 && suspicion >= 2;
    return ending === 'E1' && finalChoice >= 0 && finalChoice <= 2;
}

export async function handleEgg(request: Request, env: Env, path: string): Promise<Response> {
    const user = await getSessionUser(env, request);
    if (!user) return jsonRes({ error: '请先登录' }, 403);

    const row = await env.DB.prepare('SELECT points, egg_endings, egg_locked FROM users WHERE id = ?').bind(user.id).first<any>();
    const endings = parseEndings(row?.egg_endings);

    if (path === '/api/egg/status' && request.method === 'GET') {
        return jsonRes({ locked: false, endings });
    }

    if (path !== '/api/egg/claim' || request.method !== 'POST') {
        return jsonRes({ error: 'Method Not Allowed' }, 405);
    }

    let body: any;
    try { body = await request.json(); } catch { return jsonRes({ error: '参数格式错误' }, 400); }
    const ending = String(body?.ending || '');
    const choices = body?.choices;
    if (!(ending in REWARDS) || !isValidEnding(ending, choices)) {
        return jsonRes({ error: '结局路径校验失败' }, 400);
    }
    if (endings.includes(ending)) {
        return jsonRes({ success: true, claimed: false, ending, name: ENDING_NAMES[ending], reward: 0, points: Number(row?.points || 0) });
    }

    const reward = REWARDS[ending];
    const nextEndings = [...endings, ending];
    const nextLocked = 0;
    await env.DB.prepare(
        'UPDATE users SET points = points + ?, egg_endings = ?, egg_locked = ? WHERE id = ?'
    ).bind(reward, JSON.stringify(nextEndings), nextLocked, user.id).run();

    return jsonRes({
        success: true,
        claimed: true,
        ending,
        name: ENDING_NAMES[ending],
        reward,
        points: Number(row?.points || 0) + reward,
        locked: false,
    });
}