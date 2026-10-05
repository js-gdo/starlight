export type SitePopupConfig = {
    enabled: boolean;
    revision: number;
    targetMode: 'all' | 'selected';
    userIds: number[];
    title: string;
    message: string;
    startsAt: number | null;
    endsAt: number | null;
    durationSeconds: number;
};

export const SITE_POPUP_SETTING_KEY = 'site_popup';

export function parseSitePopupConfig(value: unknown): SitePopupConfig | null {
    try {
        const parsed = JSON.parse(String(value || ''));
        if (!parsed || typeof parsed !== 'object') return null;
        const targetMode = parsed.targetMode === 'selected' ? 'selected' : 'all';
        const userIds: number[] = [];
        if (Array.isArray(parsed.userIds)) {
            for (const value of parsed.userIds) {
                const id = Number(value);
                if (Number.isSafeInteger(id) && id > 0 && !userIds.includes(id)) userIds.push(id);
            }
        }
        const startsAt = Number(parsed.startsAt);
        const endsAt = Number(parsed.endsAt);
        const revision = Number(parsed.revision);
        const durationSeconds = Number(parsed.durationSeconds);
        return {
            enabled: parsed.enabled === true,
            revision: Number.isSafeInteger(revision) && revision > 0 ? revision : 0,
            targetMode,
            userIds,
            title: String(parsed.title || '').slice(0, 120),
            message: String(parsed.message || '').slice(0, 5000),
            startsAt: Number.isFinite(startsAt) && startsAt > 0 ? startsAt : null,
            endsAt: Number.isFinite(endsAt) && endsAt > 0 ? endsAt : null,
            durationSeconds: Number.isInteger(durationSeconds) ? Math.min(3600, Math.max(0, durationSeconds)) : 0,
        };
    } catch {
        return null;
    }
}

export function parseChinaDateTime(value: string): number | null {
    if (!value) return null;
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
    if (!match) return null;
    const [, yearText, monthText, dayText, hourText, minuteText] = match;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const hour = Number(hourText);
    const minute = Number(minuteText);
    const localDate = new Date(Date.UTC(year, month - 1, day, hour, minute));
    if (localDate.getUTCFullYear() !== year || localDate.getUTCMonth() !== month - 1 ||
        localDate.getUTCDate() !== day || localDate.getUTCHours() !== hour ||
        localDate.getUTCMinutes() !== minute) return null;
    return localDate.getTime() - 8 * 60 * 60 * 1000;
}

export function formatChinaDateTime(value: number | null): string {
    if (!value) return '';
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(new Date(value));
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}
