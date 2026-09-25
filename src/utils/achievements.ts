import { htmlEscape } from './html';

export type AchievementDefinition = {
    id: string;
    name: string;
    description: string;
    icon: string;
    color: string;
};

export const ACHIEVEMENTS: AchievementDefinition[] = [
    { id: 'welcome', name: '欢迎来到 StarLight', description: '注册 StarLight 账号', icon: '★', color: '#8E44AD' },
    { id: 'administrator', name: '我是管理员', description: '拥有管理员权限', icon: '♛', color: '#d4a017' },
    { id: 'writer-1', name: '帖子大佬 I', description: '发布过 5 篇帖子', icon: '✎', color: '#3498db' },
    { id: 'writer-2', name: '帖子大佬 II', description: '发布过 10 篇帖子', icon: '✎', color: '#2980b9' },
    { id: 'writer-3', name: '帖子大佬 III', description: '发布过 25 篇帖子', icon: '✎', color: '#1f618d' },
    { id: 'first-post', name: '初次创作', description: '发布过 1 篇帖子', icon: '✦', color: '#5dade2' },
    { id: 'master-writer', name: '全能创作者', description: '发布过 50 篇帖子', icon: '✍', color: '#154360' },
    { id: 'bug-hunter', name: 'Bug 寻找者', description: '创建过 10 个工单', icon: '⚒', color: '#e67e22' },
    { id: 'first-report', name: '首次反馈', description: '创建过 1 个工单', icon: '⚑', color: '#ca6f1e' },
    { id: 'commentator', name: '热心评论家', description: '发表过 10 条评论', icon: '✦', color: '#16a085' },
    { id: 'first-comment', name: '留下足迹', description: '发表过 1 条评论', icon: '☄', color: '#48c9b0' },
    { id: 'checkin-veteran', name: '每日打卡', description: '完成过一次每日签到', icon: '✓', color: '#27ae60' },
    { id: 'popular', name: '社区熟面孔', description: '拥有 5 位粉丝', icon: '♥', color: '#e74c3c' },
    { id: 'community-star', name: '社区明星', description: '拥有 20 位粉丝', icon: '✹', color: '#c0392b' },
    { id: 'points-collector', name: '积分收藏家', description: '累计获得 500 积分', icon: '◆', color: '#f39c12' },
    { id: 'points-master', name: '积分达人', description: '累计获得 2000 积分', icon: '◇', color: '#b9770e' },
    { id: 'profile-complete', name: '资料完整', description: '完善个人签名、头像和主页链接', icon: '●', color: '#7f8c8d' },
    { id: 'server-operator', name: '服务器运营者', description: '拥有超过 1000 Server 币', icon: '⚙', color: '#5b6ee1' },
    { id: 'server-tycoon', name: '服务器富翁', description: '拥有超过 10000 Server 币', icon: '♜', color: '#34495e' },
];

const definitionMap = new Map(ACHIEVEMENTS.map((achievement) => [achievement.id, achievement]));

export async function syncAchievements(db: any, userId: number): Promise<void> {
    const user = await db.prepare(
        `SELECT id, admin, points, checkin_date, bio, avatar_url, profile_link, server_coin
         FROM users WHERE id = ?`
    ).bind(userId).first();
    if (!user) return;

    const [articles, tickets, comments, followers] = await Promise.all([
        db.prepare('SELECT COUNT(*) AS count FROM articles WHERE author_id = ?').bind(userId).first(),
        db.prepare('SELECT COUNT(*) AS count FROM tickets WHERE author_id = ?').bind(userId).first(),
        db.prepare('SELECT COUNT(*) AS count FROM comments WHERE author_id = ?').bind(userId).first(),
        db.prepare('SELECT COUNT(*) AS count FROM follows WHERE followee_id = ?').bind(userId).first(),
    ]);
    const articleCount = Number(articles?.count || 0);
    const ticketCount = Number(tickets?.count || 0);
    const commentCount = Number(comments?.count || 0);
    const followerCount = Number(followers?.count || 0);
    const earned = new Set<string>();
    earned.add('welcome');
    if (Number(user.admin) === 1) earned.add('administrator');
    if (articleCount >= 5) earned.add('writer-1');
    if (articleCount >= 10) earned.add('writer-2');
    if (articleCount >= 25) earned.add('writer-3');
    if (articleCount >= 1) earned.add('first-post');
    if (articleCount >= 50) earned.add('master-writer');
    if (ticketCount >= 10) earned.add('bug-hunter');
    if (ticketCount >= 1) earned.add('first-report');
    if (commentCount >= 10) earned.add('commentator');
    if (commentCount >= 1) earned.add('first-comment');
    if (user.checkin_date) earned.add('checkin-veteran');
    if (followerCount >= 5) earned.add('popular');
    if (followerCount >= 20) earned.add('community-star');
    if (Number(user.points || 0) >= 500) earned.add('points-collector');
    if (Number(user.points || 0) >= 2000) earned.add('points-master');
    if (user.bio && user.avatar_url && user.profile_link) earned.add('profile-complete');
    if (Number(user.server_coin || 0) > 1000) earned.add('server-operator');
    if (Number(user.server_coin || 0) > 10000) earned.add('server-tycoon');

    for (const achievementId of earned) {
        await db.prepare('INSERT OR IGNORE INTO user_achievements (user_id, achievement_id) VALUES (?, ?)')
            .bind(userId, achievementId).run();
    }
}

export async function getUserAchievementIds(db: any, userId: number): Promise<string[]> {
    const rows = await db.prepare('SELECT achievement_id FROM user_achievements WHERE user_id = ?')
        .bind(userId).all();
    return (rows.results || []).map((row: any) => String(row.achievement_id));
}

export async function getAchievementBadges(db: any, userId: number): Promise<string> {
    await syncAchievements(db, userId);
    const ids = await getUserAchievementIds(db, userId);
    return ids.map((id) => {
        const achievement = definitionMap.get(id);
        if (!achievement) return '';
        return `<span class="achievement-badge" title="${htmlEscape(achievement.name + '：' + achievement.description)}" aria-label="${htmlEscape(achievement.name)}" style="color:${achievement.color};">${htmlEscape(achievement.icon)}</span>`;
    }).join('');
}

export function getAchievementDefinition(id: string): AchievementDefinition | undefined {
    return definitionMap.get(id);
}
