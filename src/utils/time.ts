export function formatTimeToChina(timestamp: any): string {
    if (!timestamp) return '';
    try {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return String(timestamp);
        const utcTime = date.getTime();
        const chinaTime = new Date(utcTime + 8 * 60 * 60 * 1000);
        const year = chinaTime.getUTCFullYear();
        const month = String(chinaTime.getUTCMonth() + 1).padStart(2, '0');
        const day = String(chinaTime.getUTCDate()).padStart(2, '0');
        const hours = String(chinaTime.getUTCHours()).padStart(2, '0');
        const minutes = String(chinaTime.getUTCMinutes()).padStart(2, '0');
        const seconds = String(chinaTime.getUTCSeconds()).padStart(2, '0');
        return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
    } catch {
        return String(timestamp);
    }
}

export function getChinaTime() {
    const now = new Date();
    const chinaTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const year = chinaTime.getUTCFullYear();
    const month = String(chinaTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(chinaTime.getUTCDate()).padStart(2, '0');
    const hours = String(chinaTime.getUTCHours()).padStart(2, '0');
    const minutes = String(chinaTime.getUTCMinutes()).padStart(2, '0');
    const seconds = String(chinaTime.getUTCSeconds()).padStart(2, '0');
    const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    const weekday = weekdays[chinaTime.getUTCDay()];
    return {
        date: `${year}/${month}/${day}`,
        time: `${hours}:${minutes}:${seconds}`,
        weekday: weekday,
        full: `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`
    };
}

export async function getHitokoto() {
    try {
        const response = await fetch('https://v1.hitokoto.cn');
        if (response.ok) {
            const data = await response.json() as { hitokoto: string; from: string };
            return { sentence: data.hitokoto || '', from: data.from || '未知来源' };
        }
        return { sentence: '向着天星的歌者，早已隐没在人群中。', from: '星辰的怀念' };
    } catch {
        return { sentence: '向着天星的歌者，早已隐没在人群中。', from: '星辰的怀念' };
    }
}