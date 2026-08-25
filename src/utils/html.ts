import { getUserColor } from './constants';

export type MentionUser = {
    id: number;
    username: string;
    color?: string;
    tag?: string;
};

export function htmlEscape(text: string): string {
    if (!text) return '';
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
            result += `${htmlEscape(prefix)}<a href="/user/${user.id}" style="color:${getUserColor(user.color || 'purple')};text-decoration:none;font-weight:500;" target="_blank">${htmlEscape('@' + token)}</a>`;
        } else {
            result += `${htmlEscape(prefix)}${htmlEscape('@' + token)}`;
        }
        lastIndex = end;
    }
    result += htmlEscape(text.slice(lastIndex));
    return result.replace(/\n/g, '<br>');
}

export function renderUsernameLink(username: string, color: string, tag: string, uid: number, extraClass = '') {
    if (!username) return '';
    const displayColor = getUserColor(color);
    const tagHtml = tag ? `<span style="background:${displayColor};color:#fff;padding:0 10px;border-radius:3px;font-size:11px;margin-left:4px;display:inline-block;">${htmlEscape(tag)}</span>` : '';
    return `<a href="/user/${uid}" style="color:${displayColor};text-decoration:none;font-weight:500;${extraClass}" target="_blank">${htmlEscape(username)}${tagHtml}</a>`;
}