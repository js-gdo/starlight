// 运势数据
const FORTUNES = [
    { level: '大吉', color: '#e74c3c', desc: '今日运势极佳，诸事皆宜！' },
    { level: '中吉', color: '#f39c12', desc: '运势不错，把握机会！' },
    { level: '小吉', color: '#2ecc71', desc: '平稳向好，耐心等待。' },
    { level: '吉', color: '#1abc9c', desc: '好运相伴，顺其自然。' },
    { level: '中平', color: '#3498db', desc: '平淡是真，做好自己。' },
    { level: '小凶', color: '#9b59b6', desc: '略有波折，谨慎行事。' },
    { level: '凶', color: '#e67e22', desc: '诸事不宜，静待时机。' },
    { level: '大凶', color: '#c0392b', desc: '万事小心，以退为进。' },
];

const FORTUNE_ACTIVITIES = [
    { name: '上SLOJ', good: '全方位提升', bad: '被冤枉恶意卡评测封号' },
    { name: '玩Minecraft', good: '下界挖到远古残骸', bad: '遇到苦力怕，刚好旁边就是你家' },
    { name: '玩三角洲', good: '出非洲之星', bad: '绝航就吃20万丢包的时候还被踹死了' },
    { name: '写代码', good: '写出高质量代码', bad: '写脱发' },
    { name: '出门运动', good: '俺变得更强壮了', bad: '横纹肌溶解' },
    { name: '看视频', good: '愉悦身心', bad: '被抓包' },
    { name: '出去玩', good: '心情好', bad: '被人碰瓷' },
    { name: '上StarLight', good: '发现有趣的东西', bad: '发现系统宕机了' },
    { name: '用豆包', good: 'AI太好用了', bad: '《请输入文本》' },
    { name: '听音乐', good: '豪庭', bad: '南亭的钥匙' },
	{ name: '听音乐', good: '豪庭', bad: '南亭的钥匙' },
	{ name: '交友', good: '志同道合，关系很好', bad: '被背刺'},
	{ name: '交StarLightPR', good: '一遍过，被管理员赏识', bad: '没有pull，冲突了'},
	{ name: '交工单', good: '快速解决', bad: '被认为是无意义内容，禁言了'},
	{ name: '下棋', good: '这盘棋，分明就是《老叟戏顽童》', bad: '你走！'},
	{ name: '打OI比赛', good: 'rk1', bad: 'freopen写错'},
	{ name: '考试', good: '分数1e9', bad: '排名1e9'},
	{ name: '上洛谷', good: '轻松晋升紫名', bad: '被神权压制'},
	{ name: '学whk', good: '血脉觉醒', bad: '血脉“觉醒”'}
];

const GAOKAO_ACTIVITY = { name: '高考', good: '金榜题名', bad: '无' };

function shuffle<T>(arr: T[]): T[] {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function isGaokaoPeriod(): boolean {
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    return month === 6 && day >= 7 && day <= 10;
}

function getRandomFortune() {
    return FORTUNES[Math.floor(Math.random() * FORTUNES.length)];
}

export function generateFortune() {
    if (isGaokaoPeriod()) {
        const daji = FORTUNES.find(f => f.level === '大吉')!;
        const others = shuffle(FORTUNE_ACTIVITIES);
        const activities = [
            { name: GAOKAO_ACTIVITY.name, type: '宜', desc: GAOKAO_ACTIVITY.good },
            { name: others[0].name, type: '宜', desc: others[0].good }
        ];
        return { ...daji, activities };
    }
    const fortune = getRandomFortune();
    const pool = shuffle(FORTUNE_ACTIVITIES);
    let activities: any[] = [];
    if (fortune.level === '大吉') {
        activities = pool.slice(0, 2).map(a => ({ name: a.name, type: '宜', desc: a.good }));
    } else if (fortune.level === '大凶') {
        activities = pool.slice(0, 2).map(a => ({ name: a.name, type: '忌', desc: a.bad }));
    } else {
        const picked = pool.slice(0, 4);
        activities = [
            { name: picked[0].name, type: '宜', desc: picked[0].good },
            { name: picked[1].name, type: '宜', desc: picked[1].good },
            { name: picked[2].name, type: '忌', desc: picked[2].bad },
            { name: picked[3].name, type: '忌', desc: picked[3].bad }
        ];
    }
    return { ...fortune, activities };
}
