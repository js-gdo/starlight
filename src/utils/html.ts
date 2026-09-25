import { getUserColor, getUserColorTextStyle, getUserTagStyle } from './constants';

export type MentionUser = {
    id: number;
    username: string;
    color?: string;
    tag?: string;
};

export function htmlEscape(text: string): string {
    if (!text) return '';
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function validateAtMentionSpacing(text: string): string[] {
    if (!text) return [];
    const invalid: string[] = [];
    const regex = /@([A-Za-z0-9_]+)/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        const prev = start === 0 ? ' ' : text[start - 1];
        const next = end >= text.length ? ' ' : text[end];
        if ((start > 0 && !/\s/.test(prev)) || !/\s/.test(next)) {
            invalid.push(match[0]);
        }
    }
    return invalid;
}

export function extractAtMentionTokens(text: string): string[] {
    if (!text) return [];
    const tokens: string[] = [];
    const regex = /(?:^|\s)@([A-Za-z0-9_]+)(?=\s|$)/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
        const token = match[1];
        if (token && !tokens.includes(token)) tokens.push(token);
    }
    return tokens;
}

export function replaceAtMentionsWithMarkdown(text: string, resolveUser: (token: string) => MentionUser | null): string {
    if (!text) return '';
    const regex = /(^|\s)@([A-Za-z0-9_]+)(?=\s|$)/g;
    let result = '';
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
        const prefix = match[1] || '';
        const token = match[2];
        const start = match.index;
        const end = start + match[0].length;
        result += text.slice(lastIndex, start);
        const user = resolveUser(token);
        if (user) {
            const safeUsername = String(user.username || '').replace(/\\/g, '\\\\').replace(/\[/g, '\\[').replace(/\]/g, '\\]');
            result += `${prefix}[${safeUsername}](/user/${user.id})`;
        } else {
            result += `${prefix}@${token}`;
        }
        lastIndex = end;
    }
    result += text.slice(lastIndex);
    return result;
}

export async function normalizeAtMentionsInContent(db: any, text: string): Promise<string> {
    if (!text) return text;
    const tokens = extractAtMentionTokens(text);
    if (!tokens.length) return text;

    const mentionMap = new Map<string, MentionUser>();
    const numericTokens = tokens.filter((token) => /^\d+$/.test(token));
    const usernameTokens = tokens.filter((token) => !/^\d+$/.test(token));

    if (numericTokens.length > 0) {
        const ids = numericTokens.map((token) => parseInt(token, 10));
        const idRows = await db.prepare(`SELECT id, username, color, tag FROM users WHERE id IN (${ids.map(() => '?').join(',')})`)
            .bind(...ids).all();
        for (const row of idRows.results) mentionMap.set(String(row.id), row);
    }

    if (usernameTokens.length > 0) {
        const nameRows = await db.prepare(`SELECT id, username, color, tag FROM users WHERE username IN (${usernameTokens.map(() => '?').join(',')})`)
            .bind(...usernameTokens).all();
        for (const row of nameRows.results) mentionMap.set(String(row.username).toLowerCase(), row);
    }

    return replaceAtMentionsWithMarkdown(text, (token) => {
        if (/^\d+$/.test(token)) return mentionMap.get(token) || null;
        return mentionMap.get(token.toLowerCase()) || null;
    });
}

export function renderUserVerificationBadge(level: 'gold' | 'blue' | 'green' | 'default' = 'default'): string {
    const svgMap = {
        gold: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="#f1c40f" style="margin-bottom: -3px; vertical-align: -2px; display:inline-block; margin-left:4px;" aria-label="verified" title="verified"><path d="M16 8C16 6.84375 15.25 5.84375 14.1875 5.4375C14.6562 4.4375 14.4688 3.1875 13.6562 2.34375C12.8125 1.53125 11.5625 1.34375 10.5625 1.8125C10.1562 0.75 9.15625 0 8 0C6.8125 0 5.8125 0.75 5.40625 1.8125C4.40625 1.34375 3.15625 1.53125 2.34375 2.34375C1.5 3.1875 1.3125 4.4375 1.78125 5.4375C0.71875 5.84375 0 6.84375 0 8C0 9.1875 0.71875 10.1875 1.78125 10.5938C1.3125 11.5938 1.5 12.8438 2.34375 13.6562C3.15625 14.5 4.40625 14.6875 5.40625 14.2188C5.8125 15.2812 6.8125 16 8 16C9.15625 16 10.1562 15.2812 10.5625 14.2188C11.5938 14.6875 12.8125 14.5 13.6562 13.6562C14.4688 12.8438 14.6562 11.5938 14.1875 10.5938C15.25 10.1875 16 9.1875 16 8ZM11.4688 6.625L7.375 10.6875C7.21875 10.8438 7 10.8125 6.875 10.6875L4.5 8.3125C4.375 8.1875 4.375 7.96875 4.5 7.8125L5.3125 7C5.46875 6.875 5.6875 6.875 5.8125 7.03125L7.125 8.34375L10.1562 5.34375C10.3125 5.1875 10.5312 5.1875 10.6562 5.34375L11.4688 6.15625C11.5938 6.28125 11.5938 6.5 11.4688 6.625Z"></path></svg>`,
        blue: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="#3498db" style="margin-bottom: -3px; vertical-align: -2px; display:inline-block; margin-left:4px;" aria-label="verified" title="verified"><path d="M16 8C16 6.84375 15.25 5.84375 14.1875 5.4375C14.6562 4.4375 14.4688 3.1875 13.6562 2.34375C12.8125 1.53125 11.5625 1.34375 10.5625 1.8125C10.1562 0.75 9.15625 0 8 0C6.8125 0 5.8125 0.75 5.40625 1.8125C4.40625 1.34375 3.15625 1.53125 2.34375 2.34375C1.5 3.1875 1.3125 4.4375 1.78125 5.4375C0.71875 5.84375 0 6.84375 0 8C0 9.1875 0.71875 10.1875 1.78125 10.5938C1.3125 11.5938 1.5 12.8438 2.34375 13.6562C3.15625 14.5 4.40625 14.6875 5.40625 14.2188C5.8125 15.2812 6.8125 16 8 16C9.15625 16 10.1562 15.2812 10.5625 14.2188C11.5938 14.6875 12.8125 14.5 13.6562 13.6562C14.4688 12.8438 14.6562 11.5938 14.1875 10.5938C15.25 10.1875 16 9.1875 16 8ZM11.4688 6.625L7.375 10.6875C7.21875 10.8438 7 10.8125 6.875 10.6875L4.5 8.3125C4.375 8.1875 4.375 7.96875 4.5 7.8125L5.3125 7C5.46875 6.875 5.6875 6.875 5.8125 7.03125L7.125 8.34375L10.1562 5.34375C10.3125 5.1875 10.5312 5.1875 10.6562 5.34375L11.4688 6.15625C11.5938 6.28125 11.5938 6.5 11.4688 6.625Z"></path></svg>`,
        green: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="#5eb95e" style="margin-bottom: -3px; vertical-align: -2px; display:inline-block; margin-left:4px;" aria-label="verified" title="verified"><path d="M16 8C16 6.84375 15.25 5.84375 14.1875 5.4375C14.6562 4.4375 14.4688 3.1875 13.6562 2.34375C12.8125 1.53125 11.5625 1.34375 10.5625 1.8125C10.1562 0.75 9.15625 0 8 0C6.8125 0 5.8125 0.75 5.40625 1.8125C4.40625 1.34375 3.15625 1.53125 2.34375 2.34375C1.5 3.1875 1.3125 4.4375 1.78125 5.4375C0.71875 5.84375 0 6.84375 0 8C0 9.1875 0.71875 10.1875 1.78125 10.5938C1.3125 11.5938 1.5 12.8438 2.34375 13.6562C3.15625 14.5 4.40625 14.6875 5.40625 14.2188C5.8125 15.2812 6.8125 16 8 16C9.15625 16 10.1562 15.2812 10.5625 14.2188C11.5938 14.6875 12.8125 14.5 13.6562 13.6562C14.4688 12.8438 14.6562 11.5938 14.1875 10.5938C15.25 10.1875 16 9.1875 16 8ZM11.4688 6.625L7.375 10.6875C7.21875 10.8438 7 10.8125 6.875 10.6875L4.5 8.3125C4.375 8.1875 4.375 7.96875 4.5 7.8125L5.3125 7C5.46875 6.875 5.6875 6.875 5.8125 7.03125L7.125 8.34375L10.1562 5.34375C10.3125 5.1875 10.5312 5.1875 10.6562 5.34375L11.4688 6.15625C11.5938 6.28125 11.5938 6.5 11.4688 6.625Z"></path></svg>`,
        default: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="#8E44AD" style="margin-bottom: -3px; vertical-align: -2px; display:inline-block; margin-left:4px;" aria-label="verified" title="verified"><path d="M16 8C16 6.84375 15.25 5.84375 14.1875 5.4375C14.6562 4.4375 14.4688 3.1875 13.6562 2.34375C12.8125 1.53125 11.5625 1.34375 10.5625 1.8125C10.1562 0.75 9.15625 0 8 0C6.8125 0 5.8125 0.75 5.40625 1.8125C4.40625 1.34375 3.15625 1.53125 2.34375 2.34375C1.5 3.1875 1.3125 4.4375 1.78125 5.4375C0.71875 5.84375 0 6.84375 0 8C0 9.1875 0.71875 10.1875 1.78125 10.5938C1.3125 11.5938 1.5 12.8438 2.34375 13.6562C3.15625 14.5 4.40625 14.6875 5.40625 14.2188C5.8125 15.2812 6.8125 16 8 16C9.15625 16 10.1562 15.2812 10.5625 14.2188C11.5938 14.6875 12.8125 14.5 13.6562 13.6562C14.4688 12.8438 14.6562 11.5938 14.1875 10.5938C15.25 10.1875 16 9.1875 16 8ZM11.4688 6.625L7.375 10.6875C7.21875 10.8438 7 10.8125 6.875 10.6875L4.5 8.3125C4.375 8.1875 4.375 7.96875 4.5 7.8125L5.3125 7C5.46875 6.875 5.6875 6.875 5.8125 7.03125L7.125 8.34375L10.1562 5.34375C10.3125 5.1875 10.5312 5.1875 10.6562 5.34375L11.4688 6.15625C11.5938 6.28125 11.5938 6.5 11.4688 6.625Z"></path></svg>`,
    } as const;
    return svgMap[level] || svgMap.default;
}

export function getUserVerificationLevel(uid: number): 'gold' | 'blue' | 'green' | 'default' {
    if (!Number.isFinite(uid) || uid <= 0) return 'default';
    if (uid === 1) return 'gold';
    if (uid === 2) return 'blue';
    if (uid === 3) return 'green';
    return 'blue';
}

export function renderAtMentions(text: string, resolveUser: (token: string) => MentionUser | null): string {
    if (!text) return '';
    const regex = /(^|\s)@([A-Za-z0-9_]+)(?=\s|$)/g;
    let result = '';
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
        const prefix = match[1] || '';
        const token = match[2];
        const start = match.index;
        const end = start + match[0].length;
        result += htmlEscape(text.slice(lastIndex, start));
        const user = resolveUser(token);
        if (user) {
            const badge = renderUserVerificationBadge(getUserVerificationLevel(user.id));
            result += `${htmlEscape(prefix)}<a href="/user/${user.id}" style="${getUserColorTextStyle(user.color || 'purple')}text-decoration:none;font-weight:500;" target="_blank">${htmlEscape('@' + token)}${badge}</a>`;
        } else {
            result += `${htmlEscape(prefix)}${htmlEscape('@' + token)}`;
        }
        lastIndex = end;
    }
    result += htmlEscape(text.slice(lastIndex));
    return result.replace(/\n/g, '<br>');
}

export function renderUsernameLink(username: string, color: string, tag: string, uid: number, extraClass = '', rankLevel?: 'gold' | 'blue' | 'green' | 'default') {
    if (!username) return '';
    const tagHtml = tag ? `<span style="${htmlEscape(getUserTagStyle(color))}">${htmlEscape(tag)}</span>` : '';
    const badge = renderUserVerificationBadge(rankLevel ?? getUserVerificationLevel(uid));
    return `<a href="/user/${uid}" class="username-link" data-user-id="${uid}" style="${htmlEscape(getUserColorTextStyle(color))}text-decoration:none;font-weight:500;${extraClass}" target="_blank">${htmlEscape(username)}${tagHtml}${badge}</a>`;
}

export function renderAvatar(user: { id?: number; username?: string; avatar_url?: string }, size = 42): string {
    const initial = htmlEscape(String(user.username || '?').charAt(0).toUpperCase());
    const fallback = `this.onerror=null;this.style.display='none';this.nextElementSibling.style.display='flex';`;
    const image = user.avatar_url
        ? `<img src="${htmlEscape(String(user.avatar_url))}" alt="${initial}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="${fallback}">`
        : '';
    return `<span style="display:inline-flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:50%;overflow:hidden;background:#8E44AD;color:#fff;font-weight:700;flex-shrink:0;">${image}<span style="display:${user.avatar_url ? 'none' : 'flex'};align-items:center;justify-content:center;width:100%;height:100%;">${initial}</span></span>`;
}