import { getUserColor } from './constants';

export function htmlEscape(text: string): string {
    if (!text) return '';
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function renderUsernameLink(username: string, color: string, tag: string, uid: number, extraClass = '') {
    if (!username) return '';
    const displayColor = getUserColor(color);
    const tagHtml = tag ? `<span style="background:${displayColor};color:#fff;padding:0 10px;border-radius:3px;font-size:11px;margin-left:4px;display:inline-block;">${htmlEscape(tag)}</span>` : '';
    return `<a href="/user/${uid}" style="color:${displayColor};text-decoration:none;font-weight:500;${extraClass}" target="_blank">${htmlEscape(username)}${tagHtml}</a>`;
}