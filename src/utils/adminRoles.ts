export const ADMIN_ROLE_KEYS = ['developer', 'community', 'mobile', 'unassigned'] as const;

export type AdminRoleKey = typeof ADMIN_ROLE_KEYS[number];

export const ADMIN_ROLE_LABELS: Record<AdminRoleKey, string> = {
    developer: '代码开发者',
    community: '社区管理员',
    mobile: '机动管理员',
    unassigned: '未分配管理',
};

export function parseAdminRoles(value: unknown): AdminRoleKey[] {
    try {
        const parsed = JSON.parse(String(value || '[]'));
        if (!Array.isArray(parsed)) return ['unassigned'];
        const roles = parsed.filter((role): role is AdminRoleKey => ADMIN_ROLE_KEYS.includes(role as AdminRoleKey));
        return roles.length ? Array.from(new Set(roles)) : ['unassigned'];
    } catch {
        return ['unassigned'];
    }
}

export function normalizeAdminRoles(values: unknown): AdminRoleKey[] {
    const input = Array.isArray(values) ? values : [values];
    const roles = input.filter((role): role is AdminRoleKey => ADMIN_ROLE_KEYS.includes(String(role) as AdminRoleKey)) as AdminRoleKey[];
    return roles.length ? Array.from(new Set(roles)) : ['unassigned'];
}
