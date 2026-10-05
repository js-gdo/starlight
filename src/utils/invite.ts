import { sha256 } from './crypto';

export async function createInviteCode(username: string): Promise<string> {
    const digest = await sha256(username);
    return `${digest.slice(0, 2)}${digest.slice(-2)}`;
}
