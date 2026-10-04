export const ADMIN_PERMISSION_NODES = [
    { key: 'admin.dashboard.view', label: '查看运营仪表盘', group: '后台' },
    { key: 'admin.users.view', label: '查看用户', group: '用户管理' },
    { key: 'admin.users.profile.edit', label: '编辑用户资料', group: '用户管理' },
    { key: 'admin.users.permissions.edit', label: '修改用户站点权限', group: '用户管理' },
    { key: 'admin.users.delete', label: '删除用户', group: '用户管理' },
    { key: 'admin.users.avatar.clear', label: '清除用户头像', group: '用户管理' },
    { key: 'admin.content.articles.view', label: '查看文章', group: '内容管理' },
    { key: 'admin.content.articles.edit', label: '编辑文章分类', group: '内容管理' },
    { key: 'admin.content.articles.moderate', label: '置顶、锁定文章', group: '内容管理' },
    { key: 'admin.content.articles.delete', label: '删除文章', group: '内容管理' },
    { key: 'admin.content.comments.delete', label: '删除评论', group: '内容管理' },
    { key: 'admin.content.benben.delete', label: '删除短动态', group: '内容管理' },
    { key: 'admin.content.tickets.view', label: '查看工单', group: '内容管理' },
    { key: 'admin.content.tickets.manage', label: '指派与更新工单', group: '内容管理' },
    { key: 'admin.content.tickets.delete', label: '删除工单', group: '内容管理' },
    { key: 'admin.security.reports.view', label: '查看举报', group: '内容安全' },
    { key: 'admin.security.reports.resolve', label: '处理举报', group: '内容安全' },
    { key: 'admin.security.audit.view', label: '查看操作审计', group: '内容安全' },
    { key: 'admin.site.settings.edit', label: '修改站点状态', group: '站点管理' },
    { key: 'admin.site.banners.manage', label: '管理轮播图', group: '站点管理' },
    { key: 'admin.site.announcements.manage', label: '管理公告', group: '站点管理' },
    { key: 'admin.site.export', label: '导出站点数据', group: '站点管理' },
    { key: 'admin.permissions.view', label: '查看管理员节点', group: '管理员权限' },
    { key: 'admin.permissions.manage', label: '分配管理员节点', group: '管理员权限' },
] as const;

export type AdminPermissionNode = typeof ADMIN_PERMISSION_NODES[number]['key'];

const permissionPattern = /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)*(?:\.\*)?$|^\*$/;

export function parseAdminPermissions(value: unknown): string[] {
    try {
        const parsed = JSON.parse(String(value || '[]'));
        if (!Array.isArray(parsed)) return [];
        return [...new Set(parsed.filter((node): node is string =>
            typeof node === 'string' && permissionPattern.test(node)
        ))];
    } catch {
        return [];
    }
}

export function normalizeAdminPermissions(values: unknown): string[] {
    const input = Array.isArray(values) ? values : [values];
    return [...new Set(input
        .map(value => String(value || '').trim())
        .filter(value => permissionPattern.test(value)))];
}

export function hasAdminPermission(user: any, required: string): boolean {
    if (!user || !user.admin) return false;
    if (Number(user.id) === 1) return true;
    const assigned = parseAdminPermissions(user.admin_permissions);
    return assigned.some(pattern => {
        if (pattern === '*') return true;
        if (!pattern.endsWith('.*')) return pattern === required;
        const prefix = pattern.slice(0, -2);
        return required.startsWith(`${prefix}.`);
    });
}

export function getAdminSectionPermission(section: string): string {
    const permissions: Record<string, string> = {
        dashboard: 'admin.dashboard.view',
        user: 'admin.users.view',
        content: 'admin.content.articles.view',
        security: 'admin.security.reports.view',
        reviews: 'admin.dashboard.view',
        site: 'admin.site.settings.edit',
        permissions: 'admin.permissions.view',
    };
    return permissions[section] || 'admin.dashboard.view';
}