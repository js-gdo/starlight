export interface LuoguUser {
    uid: number;
    name: string;
    avatar: string;
    slogan: string;
}

export function findLuoguUser(data: unknown, username: string): LuoguUser | null {
    if (!data || typeof data !== 'object' || !Array.isArray((data as { users?: unknown }).users)) return null;
    const users = (data as { users: unknown[] }).users;
    for (const value of users) {
        if (!value || typeof value !== 'object') continue;
        const candidate = value as Record<string, unknown>;
        if (candidate.name !== username) continue;
        const uid = Number(candidate.uid);
        if (!Number.isSafeInteger(uid) || uid <= 0
            || typeof candidate.name !== 'string'
            || typeof candidate.slogan !== 'string') return null;
        return {
            uid,
            name: candidate.name,
            avatar: typeof candidate.avatar === 'string' ? candidate.avatar : '',
            slogan: candidate.slogan,
        };
    }
    return null;
}

export function hasLuoguVerificationCode(slogan: string, code: string): boolean {
    return slogan.toLowerCase().includes(code.toLowerCase());
}
