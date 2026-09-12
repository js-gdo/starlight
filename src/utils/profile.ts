export function normalizeProfileFields(fields: {
    bio?: string;
    avatar_url?: string;
    location?: string;
    profile_link?: string;
    real_name?: string;
}) {
    const normalized = {
        bio: String(fields.bio ?? '').trim(),
        avatar_url: String(fields.avatar_url ?? '').trim(),
        location: String(fields.location ?? '').trim(),
        profile_link: String(fields.profile_link ?? '').trim(),
        real_name: String(fields.real_name ?? '').trim(),
    };

    if (normalized.bio.length > 180) normalized.bio = normalized.bio.slice(0, 180);
    if (normalized.location.length > 50) normalized.location = normalized.location.slice(0, 50);
    if (normalized.real_name.length > 50) normalized.real_name = normalized.real_name.slice(0, 50);
    if (normalized.profile_link.length > 300) normalized.profile_link = normalized.profile_link.slice(0, 300);
    if (normalized.avatar_url.length > 500) normalized.avatar_url = normalized.avatar_url.slice(0, 500);

    return normalized;
}

export function validateAvatarUrl(value: string): boolean {
    if (!value) return true;
    try {
        const url = new URL(value);
        return (url.protocol === 'http:' || url.protocol === 'https:') && !!url.hostname;
    } catch {
        return false;
    }
}

export function validateProfileUrl(value: string): boolean {
    if (!value) return true;
    try {
        const url = new URL(value);
        return (url.protocol === 'http:' || url.protocol === 'https:') && !!url.hostname;
    } catch {
        return false;
    }
}
