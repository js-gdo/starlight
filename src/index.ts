// @ts-nocheck
// index.js - StarLight 平台（完整版：Markdown + 积分 + 签到 + 私信/消息通知）

export default {
	async fetch(request, env, ctx) {
		try {
			const url = new URL(request.url);
			const path = url.pathname;

			await initDB(env);

			if (path === '/' || path === '/index.html') {
				return new Response(await renderHome(env, request), {
					headers: { 'Content-Type': 'text/html; charset=utf-8' }
				});
			}

			if (path === '/login') {
				const result = await renderLogin(env, request);
				if (result.redirect) {
					return new Response(null, { status: 302, headers: { Location: result.redirect } });
				}
				return new Response(result.html, {
					headers: { 'Content-Type': 'text/html; charset=utf-8' }
				});
			}

			if (path === '/register') {
				const result = await renderRegister(env, request);
				if (result.redirect) {
					return new Response(null, { status: 302, headers: { Location: result.redirect } });
				}
				return new Response(result.html, {
					headers: { 'Content-Type': 'text/html; charset=utf-8' }
				});
			}

			if (path === '/logout') {
				return new Response(null, {
					status: 302,
					headers: {
						'Location': '/',
						'Set-Cookie': 'uid=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
					}
				});
			}

			if (path === '/benben') {
				return new Response(await renderBenben(env, request), {
					headers: { 'Content-Type': 'text/html; charset=utf-8' }
				});
			}

			if (path === '/messages') {
				return new Response(await renderMessages(env, request), {
					headers: { 'Content-Type': 'text/html; charset=utf-8' }
				});
			}
			// ===== 私信聊天路由 =====
			if (path === '/pm') {
				return new Response(await renderPmIndex(env, request), {
					headers: { 'Content-Type': 'text/html; charset=utf-8' }
				});
			}
			if (path.startsWith('/pm/') && path.length > 4) {
				return new Response(await renderPmChat(env, request, path), {
					headers: { 'Content-Type': 'text/html; charset=utf-8' }
				});
			}

			if (path === '/api/benben' && request.method === 'POST') {
				return await handleApi(request, env, path);
			}

			if (path.startsWith('/api/')) {
				return await handleApi(request, env, path);
			}

			if (path === '/articles/list') {
				return new Response(await renderArticleList(env, request), {
					headers: { 'Content-Type': 'text/html; charset=utf-8' }
				});
			}
			if (path === '/articles/new') {
				return new Response(await renderArticleNew(env, request), {
					headers: { 'Content-Type': 'text/html; charset=utf-8' }
				});
			}
			if (path.startsWith('/articles/') && path.length > 10) {
				if (path.endsWith('/edit')) {
					return new Response(await renderArticleEdit(env, request, path), {
						headers: { 'Content-Type': 'text/html; charset=utf-8' }
					});
				}
				return new Response(await renderArticleDetail(env, request, path), {
					headers: { 'Content-Type': 'text/html; charset=utf-8' }
				});
			}

			if (path.startsWith('/user/') && path.length > 6) {
				return new Response(await renderUser(env, request, path), {
					headers: { 'Content-Type': 'text/html; charset=utf-8' }
				});
			}

			if (path === '/ticket/list') {
				return new Response(await renderTicketList(env, request), {
					headers: { 'Content-Type': 'text/html; charset=utf-8' }
				});
			}
			if (path === '/ticket/new') {
				return new Response(await renderTicketNew(env, request), {
					headers: { 'Content-Type': 'text/html; charset=utf-8' }
				});
			}
			if (path.startsWith('/ticket/') && path.length > 8) {
				if (path.endsWith('/edit')) {
					return new Response(await renderTicketEdit(env, request, path), {
						headers: { 'Content-Type': 'text/html; charset=utf-8' }
					});
				}
				return new Response(await renderTicketDetail(env, request, path), {
					headers: { 'Content-Type': 'text/html; charset=utf-8' }
				});
			}

			if (path === '/judgement') {
				return new Response(await renderJudgement(env, request), {
					headers: { 'Content-Type': 'text/html; charset=utf-8' }
				});
			}

			if (path === '/clipboard') {
				return new Response(await renderClipboard(env, request), {
					headers: { 'Content-Type': 'text/html; charset=utf-8' }
				});
			}

			if (path === '/backend') {
				return new Response(await renderBackend(env, request), {
					headers: { 'Content-Type': 'text/html; charset=utf-8' }
				});
			}

			return new Response('Not Found', { status: 404 });
		} catch (e) {
			console.error('Worker error:', e);
			return new Response(`Error: ${e.message}`, { status: 500 });
		}
	}
};

// ============ 加密工具 ============
async function sha256(message) {
	const msgBuffer = new TextEncoder().encode(message);
	const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ============ 运势数据 ============
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

function getRandomFortune() {
	return FORTUNES[Math.floor(Math.random() * FORTUNES.length)];
}

// ============ 运势做的事 ============
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
	{ name: '听音乐', good: '豪庭', bad: '南亭的钥匙' }
];
const GAOKAO_ACTIVITY = { name: '高考', good: '金榜题名', bad: '无' };

function shuffle(arr) {
	const a = arr.slice();
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

function isGaokaoPeriod() {
	const now = new Date();
	const month = now.getMonth() + 1;
	const day = now.getDate();
	return month === 6 && day >= 7 && day <= 10;
}

function generateFortune() {
	if (isGaokaoPeriod()) {
		const daji = FORTUNES.find(f => f.level === '大吉');
		const others = shuffle(FORTUNE_ACTIVITIES);
		const activities = [
			{ name: GAOKAO_ACTIVITY.name, type: '宜', desc: GAOKAO_ACTIVITY.good },
			{ name: others[0].name, type: '宜', desc: others[0].good }
		];
		return { ...daji, activities };
	}
	const fortune = getRandomFortune();
	const pool = shuffle(FORTUNE_ACTIVITIES);
	let activities = [];
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

// ============ 工单状态配置 ============
const TICKET_STATUSES = {
	'pending': { label: '待处理', icon: 'fa-circle-ellipsis', color: '#f39c12' },
	'completed': { label: '已完成', icon: 'fa-circle-check', color: '#2ecc71' },
	'closed': { label: '已关闭', icon: 'fa-circle-x', color: '#e74c3c' },
	'suspended': { label: '挂起', icon: 'fa-circle-pause', color: '#9b59b6' },
	'waiting': { label: '待补充', icon: 'fa-circle-question', color: '#3498db' }
};

function getTicketStatus(status) {
	return TICKET_STATUSES[status] || TICKET_STATUSES['pending'];
}

// ============ 时间格式化 ============
function formatTimeToChina(timestamp) {
	if (!timestamp) return '';
	try {
		const date = new Date(timestamp);
		if (isNaN(date.getTime())) return timestamp;
		const utcTime = date.getTime();
		const chinaTime = new Date(utcTime + 8 * 60 * 60 * 1000);
		const year = chinaTime.getUTCFullYear();
		const month = String(chinaTime.getUTCMonth() + 1).padStart(2, '0');
		const day = String(chinaTime.getUTCDate()).padStart(2, '0');
		const hours = String(chinaTime.getUTCHours()).padStart(2, '0');
		const minutes = String(chinaTime.getUTCMinutes()).padStart(2, '0');
		const seconds = String(chinaTime.getUTCSeconds()).padStart(2, '0');
		return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
	} catch (e) {
		return timestamp;
	}
}

function getChinaTime() {
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

// ============ 数据库初始化 ============
async function initDB(env) {
	const db = env.DB;

	const tables = [
		`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      use INTEGER DEFAULT 1,
      speak INTEGER DEFAULT 1,
      admin INTEGER DEFAULT 0,
      color TEXT DEFAULT 'red',
      tag TEXT DEFAULT '',
      bio TEXT DEFAULT '',
      checkin_date TEXT,
      last_fortune TEXT,
      points INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )`,

		`CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hex_id TEXT UNIQUE,
      title TEXT,
      content TEXT,
      author_id INTEGER,
      is_pinned INTEGER DEFAULT 0,
      is_locked INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(author_id) REFERENCES users(id) ON DELETE CASCADE
    )`,

		`CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id INTEGER,
      author_id INTEGER,
      content TEXT,
      parent_id INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(article_id) REFERENCES articles(id) ON DELETE CASCADE,
      FOREIGN KEY(author_id) REFERENCES users(id) ON DELETE CASCADE
    )`,

		`CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      content TEXT,
      author_id INTEGER,
      assignee_id INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(author_id) REFERENCES users(id) ON DELETE CASCADE
    )`,

		`CREATE TABLE IF NOT EXISTS ticket_replies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER,
      author_id INTEGER,
      content TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
      FOREIGN KEY(author_id) REFERENCES users(id) ON DELETE CASCADE
    )`,

		`CREATE TABLE IF NOT EXISTS judgements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_id INTEGER,
      reason TEXT,
      author_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(target_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(author_id) REFERENCES users(id) ON DELETE CASCADE
    )`,

		`CREATE TABLE IF NOT EXISTS follows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      follower_id INTEGER,
      followee_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(follower_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(followee_id) REFERENCES users(id) ON DELETE CASCADE
    )`,

		`CREATE TABLE IF NOT EXISTS permission_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_id INTEGER,
      admin_id INTEGER,
      action TEXT,
      permission TEXT,
      reason TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(target_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(admin_id) REFERENCES users(id) ON DELETE CASCADE
    )`,

		`CREATE TABLE IF NOT EXISTS benben (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT,
      author_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(author_id) REFERENCES users(id) ON DELETE CASCADE
    )`,

		`CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_user_id INTEGER,
      to_user_id INTEGER,
      content TEXT,
      is_read INTEGER DEFAULT 0,
      type TEXT DEFAULT 'private',
      related_id INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(from_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(to_user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
		`CREATE TABLE IF NOT EXISTS banners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      image_url TEXT NOT NULL,
      link_url TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )`
	];

	for (const sql of tables) {
		try {
			await db.prepare(sql).run();
		} catch (e) {
			if (!e.message.includes('already exists')) {
				console.error('Table creation error:', e);
			}
		}
	}

	const admin = await db.prepare('SELECT * FROM users WHERE id = 1').first();
	if (!admin) {
		const hashedPassword = 'f1d0b7f4df42bf1b97865e03fac74872d109c6c3ee5d2789d2cbe03e5cd55bd5';
		await db.prepare(
			`INSERT INTO users (id, username, password, admin, color, tag, points)
       VALUES (1, 'lin114514', ?, 1, 'purple', '管理员', 100)`
		).bind(hashedPassword).run();
	}
	// 初始化默认轮播图
	const bannerCount = await db.prepare('SELECT COUNT(*) as cnt FROM banners').first();
	if (!bannerCount || bannerCount.cnt === 0) {
		const defaultBanners = [
			{ image_url: 'https://static.lin114514.top/img/starlight/starlight.png', link_url: 'https://sl.lj1.cc.cd', sort_order: 1 },
			{ image_url: 'https://picsum.photos/seed/starlight1/1280/720', link_url: '', sort_order: 2 },
			{ image_url: 'https://picsum.photos/seed/starlight2/1280/720', link_url: '', sort_order: 3 }
		];
		for (const b of defaultBanners) {
			await db.prepare('INSERT INTO banners (image_url, link_url, sort_order) VALUES (?, ?, ?)')
				.bind(b.image_url, b.link_url, b.sort_order).run();
		}
	}
	// 为旧数据库补充 IP 相关字段
	const alterColumns = [
		'ALTER TABLE users ADD COLUMN last_ip TEXT DEFAULT ""',
		'ALTER TABLE users ADD COLUMN last_region TEXT DEFAULT ""',
		'ALTER TABLE users ADD COLUMN last_city TEXT DEFAULT ""',
		'ALTER TABLE users ADD COLUMN last_login_at TEXT DEFAULT ""',
		'ALTER TABLE users ADD COLUMN last_active_at TEXT DEFAULT ""',
		'ALTER TABLE users ADD COLUMN violation_count INTEGER DEFAULT 0',
		'ALTER TABLE articles ADD COLUMN is_locked INTEGER DEFAULT 0'
	];
	for (const sql of alterColumns) {
		try { await db.prepare(sql).run(); } catch (e) {}
	}
}

// ============ 辅助函数 ============
function getCookie(req, name) {
	const cookie = req.headers.get('Cookie') || '';
	const match = cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
	return match ? match[2] : null;
}

async function getSessionUser(env, req) {
	const uid = getCookie(req, 'uid');
	if (!uid) return null;
	try {
		const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(parseInt(uid)).first();
		if (user) {
			// 节流更新活跃时间：距离上次活跃超过60秒才写入，避免每次请求都写库
			const now = new Date();
			const lastActive = user.last_active_at ? new Date(user.last_active_at) : null;
			if (!lastActive || (now - lastActive) > 60000) {
				await env.DB.prepare('UPDATE users SET last_active_at = ? WHERE id = ?')
					.bind(now.toISOString(), user.id).run();
				user.last_active_at = now.toISOString();
			}
		}
		return user;
	} catch (e) {
		return null;
	}
}

function generateHex() {
	return 'xxxxxxxxxxxxxxxx'.replace(/x/g, () => (Math.random() * 16 | 0).toString(16));
}

function htmlEscape(text) {
	if (!text) return '';
	return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function jsonRes(data, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});
}

function getPermissionName(permission) {
	const map = {
		'use': '进入网站',
		'speak': '发言',
		'admin': '管理员'
	};
	return map[permission] || permission;
}

function getUserColor(color) {
	const colorMap = {
		'purple': '#8E44AD',
		'red': '#E74C3C',
		'orange': '#E67E22',
		'green': '#5EB95E',
		'blue': '#0E90D2',
		'gray': '#BFBFBF'
	};
	return colorMap[color] || color || '#E74C3C';
}
// ============ 违禁词检测 ============
const VIOLATION_API_KEY = 'bdc4eb58b4da0ecc';
async function checkViolation(content) {
	if (!content || !String(content).trim()) return { violated: false, words: [] };
	try {
		const ctrl = new AbortController();
		const timer = setTimeout(() => ctrl.abort(), 5000);
		const res = await fetch(
			`https://api.auth.top/api/aidetect?key=${VIOLATION_API_KEY}&content=${encodeURIComponent(String(content))}`,
			{ signal: ctrl.signal }
		);
		clearTimeout(timer);
		if (!res.ok) return { violated: false, words: [], error: 'API状态异常' };
		const data = await res.json();
		if (data.code === 200 && data.data) {
			return {
				violated: data.data.is_violated === true,
				count: data.data.violation_count || 0,
				words: (data.data.violated_words || []).map(w => w.word)
			};
		}
		return { violated: false, words: [] };
	} catch (e) {
		console.error('违禁词检测失败:', e);
		return { violated: false, words: [], error: e.message };
	}
}
function violationErrorPage(violation) {
	const words = (violation.words || []).join('、') || '未知违规内容';
	const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<link rel="icon" type="image/x-icon" href="https://static.lin114514.top/icon/sl/favicon.ico">
<title>内容违规 - StarLight</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);}
.box{background:#fff;padding:40px;border-radius:12px;text-align:center;max-width:420px;box-shadow:0 8px 30px rgba(0,0,0,0.15);}
.icon{font-size:52px;margin-bottom:14px;}
h2{color:#333;margin-bottom:10px;font-size:20px;}
p{color:#666;margin-bottom:6px;font-size:14px;}
.words{background:#fee;color:#c33;padding:10px 16px;border-radius:6px;margin:14px 0;display:inline-block;font-size:14px;font-weight:500;word-break:break-all;}
.btn{background:#8E44AD;color:#fff;border:none;padding:10px 28px;border-radius:6px;cursor:pointer;font-size:14px;font-weight:500;margin-top:14px;transition:background 0.2s;}
.btn:hover{background:#7d3c98;}
</style></head>
<body><div class="box">
<div class="icon">⚠️</div>
<h2>内容包含违禁词</h2>
<p>您提交的内容中检测到违规词汇：</p>
<div class="words">${words}</div>
<p style="margin-top:10px;">请修改后重新提交。</p>
<button class="btn" onclick="history.back()">返回修改</button>
</div></body></html>`;
	return new Response(html, { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
// ============ 中国省级行政区中文映射 ============
const REGION_CN_MAP = {
	'Beijing': '北京市', 'Tianjin': '天津市', 'Shanghai': '上海市', 'Chongqing': '重庆市',
	'Hebei': '河北省', 'Shanxi': '山西省', 'Liaoning': '辽宁省', 'Jilin': '吉林省',
	'Heilongjiang': '黑龙江省', 'Jiangsu': '江苏省', 'Zhejiang': '浙江省', 'Anhui': '安徽省',
	'Fujian': '福建省', 'Jiangxi': '江西省', 'Shandong': '山东省', 'Henan': '河南省',
	'Hubei': '湖北省', 'Hunan': '湖南省', 'Guangdong': '广东省', 'Hainan': '海南省',
	'Sichuan': '四川省', 'Guizhou': '贵州省', 'Yunnan': '云南省', 'Shaanxi': '陕西省',
	'Gansu': '甘肃省', 'Qinghai': '青海省', 'Taiwan': '台湾省',
	'Inner Mongolia': '内蒙古自治区', 'Guangxi': '广西壮族自治区', 'Tibet': '西藏自治区',
	'Ningxia': '宁夏回族自治区', 'Ningxia Hui': '宁夏回族自治区',
	'Xinjiang': '新疆维吾尔自治区', 'Xinjiang Uyghur': '新疆维吾尔自治区',
	'Hong Kong': '香港特别行政区', 'Macau': '澳门特别行政区', 'Macao': '澳门特别行政区'
};
function regionToChinese(region) {
	if (!region) return '';
	return REGION_CN_MAP[region] || region;
}

function renderUsernameLink(username, color, tag, uid, extraClass = '') {
	if (!username) return '';
	const displayColor = getUserColor(color);
	const tagHtml = tag ? `<span style="background:${displayColor};color:#fff;padding:0 10px;border-radius:3px;font-size:11px;margin-left:4px;display:inline-block;">${htmlEscape(tag)}</span>` : '';
	return `<a href="/user/${uid}" style="color:${displayColor};text-decoration:none;font-weight:500;${extraClass}" target="_blank">${htmlEscape(username)}${tagHtml}</a>`;
}

// ============ 消息通知发送函数 ============
async function sendNotification(env, toUserId, fromUserId, content, type = 'private', relatedId = 0) {
	if (toUserId === fromUserId) return; // 不给自己发消息
	const db = env.DB;
	await db.prepare(
		`INSERT INTO messages (from_user_id, to_user_id, content, type, related_id) VALUES (?, ?, ?, ?, ?)`
	).bind(fromUserId, toUserId, content, type, relatedId).run();
}
// ============ 私信聊天辅助函数 ============
async function getSystemUnreadCount(db, uid) {
	const row = await db.prepare(`SELECT COUNT(*) AS cnt FROM messages WHERE to_user_id = ? AND is_read = 0 AND type != 'pm_chat'`).bind(uid).first();
	return row ? row.cnt : 0;
}
async function getPmUnreadCount(db, uid) {
	const row = await db.prepare(`SELECT COUNT(*) AS cnt FROM messages WHERE to_user_id = ? AND is_read = 0 AND type = 'pm_chat'`).bind(uid).first();
	return row ? row.cnt : 0;
}
async function sendPmChatMessage(env, fromUid, toUid, content) {
	if (fromUid === toUid) return;
	const db = env.DB;
	await db.prepare(
		`INSERT INTO messages (from_user_id, to_user_id, content, type, is_read, related_id) VALUES (?, ?, ?, 'pm_chat', 0, 0)`
	).bind(fromUid, toUid, content).run();
}

// ============ 获取一言 ============
async function getHitokoto() {
	try {
		const response = await fetch('https://v1.hitokoto.cn');
		if (response.ok) {
			const data = await response.json();
			return {
				sentence: data.hitokoto || '',
				from: data.from || '未知来源'
			};
		}
		return { sentence: '向着天星的歌者，早已隐没在人群中。', from: '星辰的怀念' };
	} catch (e) {
		return { sentence: '向着天星的歌者，早已隐没在人群中。', from: '星辰的怀念' };
	}
}

// ============ 登录页面 ============
async function renderLogin(env, req) {
	const user = await getSessionUser(env, req);
	if (user) {
		return { redirect: '/' };
	}

	const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="icon" type="image/x-icon" href="https://static.lin114514.top/icon/sl/favicon.ico">
  <title>登录 - StarLight</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .login-container {
      background: #fff;
      border-radius: 12px;
      padding: 48px;
      width: 100%;
      max-width: 400px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.15);
    }
    .logo {
      font-size: 28px;
      font-weight: 700;
      color: #8E44AD;
      text-align: center;
      margin-bottom: 6px;
    }
    .logo-sub {
      text-align: center;
      color: #999;
      font-size: 14px;
      margin-bottom: 30px;
    }
    .form-group { margin-bottom: 18px; }
    .form-group label {
      display: block;
      margin-bottom: 4px;
      font-weight: 500;
      color: #333;
      font-size: 14px;
    }
    .form-group input {
      width: 100%;
      padding: 10px 14px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 14px;
      transition: border-color 0.3s;
      background: #fafafa;
    }
    .form-group input:focus {
      outline: none;
      border-color: #8E44AD;
      background: #fff;
    }
    .btn {
      width: 100%;
      padding: 12px;
      background: #8E44AD;
      color: #fff;
      border: none;
      border-radius: 6px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    .btn:hover { background: #7d3c98; }
    .register-link {
      text-align: center;
      margin-top: 16px;
      color: #666;
      font-size: 14px;
    }
    .register-link a {
      color: #8E44AD;
      text-decoration: none;
      font-weight: 500;
    }
    .register-link a:hover { text-decoration: underline; }
    .error-msg {
      background: #fee;
      color: #c33;
      padding: 10px;
      border-radius: 6px;
      margin-bottom: 16px;
      display: none;
      font-size: 14px;
    }
    .demo-info {
      background: #f5f0f8;
      padding: 10px 14px;
      border-radius: 6px;
      margin-bottom: 16px;
      font-size: 13px;
      color: #666;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .demo-info strong { color: #8E44AD; }
  </style>
</head>
<body>
  <div class="login-container">
    <div class="logo">StarLight</div>
    <div class="logo-sub">登录您的账号</div>
    <div class="demo-info">
      <span><i class="fas fa-info-circle"></i> 管理员</span>
      <span><strong>lin114514</strong></span>
    </div>
    <div id="error-msg" class="error-msg"></div>
    <form id="login-form">
      <div class="form-group">
        <label>用户名</label>
        <input type="text" id="username" placeholder="请输入用户名" required>
      </div>
      <div class="form-group">
        <label>密码</label>
        <input type="password" id="password" placeholder="请输入密码" required>
      </div>
      <button type="submit" class="btn">登录</button>
    </form>
    <div class="register-link">
      还没有账号？ <a href="/register">立即注册</a>
    </div>
  </div>
  <script>
    document.getElementById('login-form').addEventListener('submit', async function(e) {
      e.preventDefault();
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;
      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (res.ok) {
          window.location.href = '/';
        } else {
          const errorEl = document.getElementById('error-msg');
          errorEl.textContent = data.error || '登录失败';
          errorEl.style.display = 'block';
        }
      } catch (err) {
        const errorEl = document.getElementById('error-msg');
        errorEl.textContent = '网络错误，请重试';
        errorEl.style.display = 'block';
      }
    });
  </script>
</body>
</html>`;

	return { html };
}

// ============ 注册页面 ============
async function renderRegister(env, req) {
	const user = await getSessionUser(env, req);
	if (user) {
		return { redirect: '/' };
	}

	const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="icon" type="image/x-icon" href="https://static.lin114514.top/icon/sl/favicon.ico">
  <title>注册 - StarLight</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .register-container {
      background: #fff;
      border-radius: 12px;
      padding: 48px;
      width: 100%;
      max-width: 400px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.15);
    }
    .logo {
      font-size: 28px;
      font-weight: 700;
      color: #8E44AD;
      text-align: center;
      margin-bottom: 6px;
    }
    .logo-sub {
      text-align: center;
      color: #999;
      font-size: 14px;
      margin-bottom: 30px;
    }
    .form-group { margin-bottom: 18px; }
    .form-group label {
      display: block;
      margin-bottom: 4px;
      font-weight: 500;
      color: #333;
      font-size: 14px;
    }
    .form-group input {
      width: 100%;
      padding: 10px 14px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 14px;
      transition: border-color 0.3s;
      background: #fafafa;
    }
    .form-group input:focus {
      outline: none;
      border-color: #8E44AD;
      background: #fff;
    }
    .btn {
      width: 100%;
      padding: 12px;
      background: #8E44AD;
      color: #fff;
      border: none;
      border-radius: 6px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    .btn:hover { background: #7d3c98; }
    .login-link {
      text-align: center;
      margin-top: 16px;
      color: #666;
      font-size: 14px;
    }
    .login-link a {
      color: #8E44AD;
      text-decoration: none;
      font-weight: 500;
    }
    .login-link a:hover { text-decoration: underline; }
    .error-msg {
      background: #fee;
      color: #c33;
      padding: 10px;
      border-radius: 6px;
      margin-bottom: 16px;
      display: none;
      font-size: 14px;
    }
    .success-msg {
      background: #efe;
      color: #3c3;
      padding: 10px;
      border-radius: 6px;
      margin-bottom: 16px;
      display: none;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="register-container">
    <div class="logo">StarLight</div>
    <div class="logo-sub">创建新账号</div>
    <div id="error-msg" class="error-msg"></div>
    <div id="success-msg" class="success-msg"></div>
    <form id="register-form">
      <div class="form-group">
        <label>用户名</label>
        <input type="text" id="username" placeholder="3-25个字符" required minlength="3" maxlength="25">
      </div>
      <div class="form-group">
        <label>密码</label>
        <input type="password" id="password" placeholder="至少6个字符" required minlength="6">
      </div>
      <button type="submit" class="btn">注册</button>
    </form>
    <div class="login-link">
      已有账号？ <a href="/login">立即登录</a>
    </div>
  </div>
  <script>
    document.getElementById('register-form').addEventListener('submit', async function(e) {
      e.preventDefault();
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;
      try {
        const res = await fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (res.ok) {
          const successEl = document.getElementById('success-msg');
          successEl.textContent = data.message || '注册成功！即将跳转...';
          successEl.style.display = 'block';
          document.getElementById('error-msg').style.display = 'none';
          setTimeout(() => { window.location.href = '/login'; }, 1500);
        } else {
          const errorEl = document.getElementById('error-msg');
          errorEl.textContent = data.error || '注册失败';
          errorEl.style.display = 'block';
          document.getElementById('success-msg').style.display = 'none';
        }
      } catch (err) {
        const errorEl = document.getElementById('error-msg');
        errorEl.textContent = '网络错误，请重试';
        errorEl.style.display = 'block';
      }
    });
  </script>
</body>
</html>`;

	return { html };
}

// ============ 布局模板 ============
async function getLayout(env, user, title, content, extraStyles = '') {
	let systemUnread = 0;
	let pmUnread = 0;
	if (user && env && env.DB) {
		systemUnread = await getSystemUnreadCount(env.DB, user.id);
		pmUnread = await getPmUnreadCount(env.DB, user.id);
	}
	const chinaTime = getChinaTime();
	const hitokoto = await getHitokoto();

	return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="icon" type="image/x-icon" href="https://static.lin114514.top/icon/sl/favicon.ico">
  <title>${title} - StarLight</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f0f2f5;
      color: #333;
      min-height: 100vh;
      padding: 12px;
    }
    .app-layout {
      display: grid;
      grid-template-columns: 60px 1fr 200px;
      gap: 16px;
      max-width: 1360px;
      margin: 0 auto;
      min-height: calc(100vh - 24px);
      align-items: stretch;
    }
    .sidebar-left {
      background: #34495e;
      border-radius: 8px;
      padding: 8px 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      position: sticky;
      top: 12px;
      align-self: start;
      max-height: calc(100vh - 24px);
      overflow-y: auto;
    }
    .sidebar-left .brand {
      color: #fff;
      font-size: 14px;
      font-weight: 700;
      padding-bottom: 8px;
      border-bottom: 1px solid rgba(255,255,255,0.1);
      width: 100%;
      text-align: center;
    }
    .sidebar-left .nav-label {
      font-size: 8px;
      text-transform: uppercase;
      color: rgba(255,255,255,0.3);
      padding: 4px 0 1px;
      font-weight: 600;
      letter-spacing: 0.5px;
    }
    .sidebar-left a {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 5px 0;
      border-radius: 6px;
      color: rgba(255,255,255,0.6);
      text-decoration: none;
      font-size: 9px;
      transition: all 0.2s;
      width: 100%;
      text-align: center;
      position: relative;
    }
    .sidebar-left a:hover {
      color: #fff;
      background: rgba(255,255,255,0.08);
    }
    .sidebar-left a.active {
      color: #fff;
      background: rgba(255,255,255,0.12);
    }
    .sidebar-left a .icon { font-size: 14px; margin-bottom: 1px; }
    .sidebar-left a .badge {
      position: absolute;
      top: 2px;
      right: 8px;
      background: #e74c3c;
      color: #fff;
      font-size: 9px;
      border-radius: 50%;
      padding: 1px 5px;
      min-width: 16px;
      text-align: center;
      line-height: 1.4;
    }
    .sidebar-left .user-section {
      margin-top: auto;
      padding-top: 6px;
      border-top: 1px solid rgba(255,255,255,0.08);
      width: 100%;
      text-align: center;
    }
    .sidebar-left .user-section .avatar {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-weight: 600;
      font-size: 11px;
      margin: 0 auto 3px;
    }
    .sidebar-left .user-section .user-name a {
      color: rgba(255,255,255,0.8);
      font-size: 9px;
      text-decoration: none;
    }
    .sidebar-left .user-section .logout-btn {
      margin-top: 3px;
      padding: 3px 10px;
      background: rgba(255,255,255,0.08);
      border: none;
      border-radius: 4px;
      font-size: 9px;
      cursor: pointer;
      color: rgba(255,255,255,0.6);
      transition: all 0.2s;
    }
    .sidebar-left .user-section .logout-btn:hover {
      background: rgba(255,255,255,0.15);
      color: #fff;
    }
    .sidebar-left .auth-btns a {
      font-size: 10px;
      padding: 4px 0;
      color: rgba(255,255,255,0.7);
    }
    .sidebar-left .auth-btns a:hover { color: #fff; }
    .main-content {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .main-content .card {
      background: #fff;
      border-radius: 8px;
      padding: 16px 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }
    .page-header { margin-bottom: 0; }
    .page-header h1 {
      font-size: 22px;
      font-weight: 700;
      color: #333;
    }
    .page-header p {
      color: #999;
      font-size: 14px;
      margin-top: 2px;
    }
    .sidebar-right {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .sidebar-right .card {
      background: #fff;
      border-radius: 8px;
      padding: 16px 18px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }
    .sidebar-right .card h3 {
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 10px;
      color: #333;
    }
    .sidebar-right .card h3 i { margin-right: 6px; color: #8E44AD; }
    .time-display { text-align: center; padding: 4px 0; }
    .time-display .date { font-size: 13px; color: #999; }
    .time-display .time { font-size: 24px; font-weight: 700; color: #333; font-variant-numeric: tabular-nums; }
    .time-display .weekday { font-size: 12px; color: #999; margin-top: 2px; }
    .hitokoto-box { font-size: 13px; color: #666; line-height: 1.6; }
    .hitokoto-box .sentence { font-style: italic; color: #333; }
    .hitokoto-box .from { font-size: 12px; color: #999; text-align: right; margin-top: 4px; }
    .quick-link {
      display: block;
      padding: 5px 0;
      color: #555;
      text-decoration: none;
      font-size: 13px;
      transition: color 0.2s;
    }
    .quick-link:hover { color: #8E44AD; }
    .quick-link i { width: 20px; color: #8E44AD; margin-right: 6px; }
    .footer-note {
      font-size: 11px;
      color: #bbb;
      margin-top: 8px;
      text-align: center;
      border-top: 1px solid #f0f0f0;
      padding-top: 8px;
    }
    .footer-note .admin-entry { color: #8E44AD; font-weight: 500; }
    .markdown-body {
      font-size: 14px;
      line-height: 1.7;
      color: #333;
    }
    .markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4, .markdown-body h5, .markdown-body h6 {
      margin: 12px 0 8px;
      font-weight: 600;
      line-height: 1.3;
    }
    .markdown-body h1 { font-size: 24px; border-bottom: 1px solid #eee; padding-bottom: 6px; }
    .markdown-body h2 { font-size: 20px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
    .markdown-body h3 { font-size: 17px; }
    .markdown-body h4 { font-size: 15px; }
    .markdown-body h5 { font-size: 14px; }
    .markdown-body h6 { font-size: 13px; color: #777; }
    .markdown-body p { margin: 8px 0; }
    .markdown-body ul, .markdown-body ol { padding-left: 24px; margin: 8px 0; }
    .markdown-body li { margin: 4px 0; }
    .markdown-body blockquote {
      border-left: 4px solid #ddd;
      padding: 8px 16px;
      margin: 8px 0;
      background: #f8f9fa;
      color: #555;
    }
    .markdown-body blockquote p { margin: 4px 0; }
    .markdown-body pre {
      background: #f6f8fa;
      padding: 12px;
      border-radius: 6px;
      overflow-x: auto;
      font-size: 13px;
      line-height: 1.6;
      margin: 8px 0;
    }
    .markdown-body code {
      background: #f6f8fa;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 13px;
      font-family: 'SF Mono', Monaco, 'Courier New', monospace;
    }
    .markdown-body pre code { background: transparent; padding: 0; font-size: 13px; }
    .markdown-body a { color: #8E44AD; text-decoration: none; }
    .markdown-body a:hover { text-decoration: underline; }
    .markdown-body img { max-width: 100%; border-radius: 6px; }
    .markdown-body hr { border: none; border-top: 1px solid #eee; margin: 16px 0; }
    .markdown-body table { border-collapse: collapse; width: 100%; margin: 8px 0; }
    .markdown-body th, .markdown-body td { border: 1px solid #ddd; padding: 6px 12px; text-align: left; }
    .markdown-body th { background: #f6f8fa; font-weight: 600; }
    .markdown-body strong { font-weight: 700; }
    .markdown-body em { font-style: italic; }
    .markdown-body del { text-decoration: line-through; }
    .markdown-body input[type="checkbox"] { margin-right: 6px; }
    @media (max-width: 1024px) {
      .app-layout { grid-template-columns: 1fr; }
      .sidebar-left { display: none; }
      .sidebar-right { display: none; }
      .mobile-menu-toggle { display: flex !important; }
    }
    .mobile-menu-toggle {
      display: none;
      position: fixed;
      top: 10px;
      left: 10px;
      z-index: 200;
      background: #34495e;
      color: #fff;
      border: none;
      border-radius: 6px;
      padding: 8px 12px;
      font-size: 18px;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    }
    .mobile-overlay {
      display: none;
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.3);
      z-index: 99;
    }
    .mobile-overlay.show { display: block; }
    .sidebar-left.mobile-open {
      display: flex !important;
      position: fixed;
      top: 0;
      left: 0;
      bottom: 0;
      width: 200px;
      z-index: 100;
      border-radius: 0 8px 8px 0;
    }
    ${extraStyles}
  </style>
  <script>
    function renderMarkdown(text) {
      if (!text) return '';
      try {
        if (typeof marked !== 'undefined' && typeof marked.parse === 'function') {
          marked.setOptions({
            breaks: true,
            gfm: true,
            sanitize: false,
            headerIds: false,
            mangle: false
          });
          return marked.parse(text);
        }
      } catch(e) {
        console.warn('Markdown parse error:', e);
      }
      return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\\n/g, '<br>');
    }

    document.addEventListener('DOMContentLoaded', function() {
      document.querySelectorAll('.markdown-content').forEach(function(el) {
        var text = el.textContent;
        el.innerHTML = renderMarkdown(text);
      });
    });

    function toggleMobileMenu() {
      document.getElementById('sidebarLeft').classList.toggle('mobile-open');
      document.getElementById('mobileOverlay').classList.toggle('show');
    }
    function closeMobileMenu() {
      document.getElementById('sidebarLeft').classList.remove('mobile-open');
      document.getElementById('mobileOverlay').classList.remove('show');
    }
    function updateClock() {
      const now = new Date();
      const chinaTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
      const h = String(chinaTime.getUTCHours()).padStart(2, '0');
      const m = String(chinaTime.getUTCMinutes()).padStart(2, '0');
      const s = String(chinaTime.getUTCSeconds()).padStart(2, '0');
      const el = document.getElementById('clockTime');
      if (el) el.textContent = h + ':' + m + ':' + s;
    }
    setInterval(updateClock, 1000);
    // 全局轻量提示
    window.toast = function(title, icon) {
      if (typeof Swal === 'undefined') { alert(title); return; }
      Swal.fire({ title: title, icon: icon || 'success', toast: true, position: 'top-end', showConfirmButton: false, timer: 2200, timerProgressBar: true });
    };
    function openOJ() {
      Swal.fire({
        title: 'OJ 在线评测系统',
        html: '要使用OJ，请登录，<br>登录的用户名和密码与StarLight中的用户名和密码相同。',
        icon: 'info',
        confirmButtonText: '确定',
        confirmButtonColor: '#8E44AD'
      }).then(function(result) {
        if (result.isConfirmed) {
          window.location.href = 'https://oj.lin114514.top';
        }
      });
    }
  </script>
</head>
<body>
  <button class="mobile-menu-toggle" onclick="toggleMobileMenu()"><i class="fas fa-bars"></i></button>
  <div class="mobile-overlay" onclick="closeMobileMenu()" id="mobileOverlay"></div>

  <div class="app-layout">
    <aside class="sidebar-left" id="sidebarLeft">
      <div class="brand">✦</div>
      <a href="/" class="${title === '首页' ? 'active' : ''}"><span class="icon"><i class="fas fa-home"></i></span> 首页</a>
      <a href="/benben" class="${title === '动态' ? 'active' : ''}"><span class="icon"><i class="fas fa-comment"></i></span> 动态</a>
      <a href="/articles/list" class="${title === '帖子列表' || title === '帖子详情' || title === '发布帖子' || title === '编辑帖子' ? 'active' : ''}"><span class="icon"><i class="fas fa-file-alt"></i></span> 帖子</a>
      <a href="/ticket/list" class="${title === '工单列表' || title === '工单详情' || title === '创建工单' || title === '编辑工单' ? 'active' : ''}"><span class="icon"><i class="fas fa-ticket-alt"></i></span> 工单</a>
      <a href="/judgement" class="${title === '陶片放逐' ? 'active' : ''}"><span class="icon"><i class="fas fa-gavel"></i></span> 放逐</a>
      <a href="/clipboard" class="${title === '云剪贴板' ? 'active' : ''}"><span class="icon"><i class="fas fa-clipboard"></i></span> 剪贴板</a>
      <a href="javascript:void(0)" onclick="openOJ()"><span class="icon"><i class="fas fa-code"></i></span> OJ</a>
      <a href="/messages" class="${title === '消息' ? 'active' : ''}"><span class="icon"><i class="fas fa-bell"></i></span> 消息${systemUnread > 0 ? `<span class="badge">${systemUnread}</span>` : ''}</a>
      <a href="/pm" class="${title === '私信' ? 'active' : ''}"><span class="icon"><i class="fas fa-envelope"></i></span> 私信${pmUnread > 0 ? `<span class="badge">${pmUnread}</span>` : ''}</a>
      ${user && user.admin ? `
        <a href="/backend" class="${title === '后台管理' ? 'active' : ''}"><span class="icon"><i class="fas fa-cog"></i></span> 管理</a>
      ` : ''}
      <div class="user-section">
        ${user ? `
          <div class="avatar" style="background:${getUserColor(user.color)}">${user.username.charAt(0).toUpperCase()}</div>
          <div class="user-name">${renderUsernameLink(user.username, user.color, user.tag, user.id)}</div>
          <form action="/logout" method="GET">
            <button type="submit" class="logout-btn"><i class="fas fa-sign-out-alt"></i> 登出</button>
          </form>
        ` : `
          <div class="auth-btns">
            <a href="/login">登录</a>
            <a href="/register">注册</a>
          </div>
        `}
      </div>
    </aside>

    <main class="main-content">
      ${content}
    </main>

    <aside class="sidebar-right">
      <div class="card">
        <div class="time-display">
          <div class="date">${chinaTime.date}</div>
          <div class="time" id="clockTime">${chinaTime.time}</div>
          <div class="weekday">${chinaTime.weekday}</div>
        </div>
      </div>
      <div class="card">
        <h3><i class="fas fa-quote-left"></i> 一言</h3>
        <div class="hitokoto-box">
          <div class="sentence">「${htmlEscape(hitokoto.sentence)}」</div>
          <div class="from">—— ${htmlEscape(hitokoto.from)}</div>
        </div>
      </div>
      <div class="card">
        <h3><i class="fas fa-link"></i> 快速链接</h3>
        <a href="/articles/new" class="quick-link"><i class="fas fa-plus-circle"></i> 发布帖子</a>
        <a href="/ticket/new" class="quick-link"><i class="fas fa-plus-circle"></i> 创建工单</a>
        <a href="/judgement" class="quick-link"><i class="fas fa-gavel"></i> 陶片放逐</a>
        ${user ? `<a href="/user/${user.id}" class="quick-link"><i class="fas fa-user"></i> 我的主页</a>` : ''}
        <div class="footer-note">
          ${user && user.admin ? `
            <span class="admin-entry"><i class="fas fa-crown"></i> 管理员入口</span><br>
            <a href="/backend" style="color:#8E44AD;text-decoration:none;font-size:12px;">→ 进入后台管理</a>
          ` : `
            <i class="fas fa-users"></i> 注册加入社区
          `}
        </div>
      </div>
    </aside>
  </div>
</body>
</html>`;
}

// ============ 消息列表页面 ============
async function renderMessages(env, req) {
	const user = await getSessionUser(env, req);
	if (!user) return '请先登录';
	const db = env.DB;
	const messages = await db.prepare(
		`SELECT m.*, u.username as from_name, u.color as from_color, u.tag as from_tag
     FROM messages m
     LEFT JOIN users u ON m.from_user_id = u.id
     WHERE m.to_user_id = ? AND m.type != 'pm_chat'
     ORDER BY m.created_at DESC`
	).bind(user.id).all();

	await db.prepare('UPDATE messages SET is_read = 1 WHERE to_user_id = ? AND is_read = 0 AND type != \'pm_chat\'')
		.bind(user.id).run();

	const content = `
    <div class="page-header"><h1><i class="fas fa-bell"></i> 系统通知</h1><p style="margin-top:4px;">工单状态变更、帖子回复、权限变动等系统消息</p></div>
    <div class="card">
      ${messages.results.length === 0 ? '<div style="color:#999;padding:20px 0;text-align:center;">暂无系统通知</div>' : ''}
      ${messages.results.map(m => `
        <div style="padding:10px 0;border-bottom:1px solid #f5f5f5;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div>
              ${m.from_user_id ? renderUsernameLink(m.from_name, m.from_color, m.from_tag, m.from_user_id) : '系统'}
              <span style="font-size:12px;color:#999;margin-left:8px;">${formatTimeToChina(m.created_at)}</span>
              ${m.is_read ? '<span style="font-size:11px;color:#999;margin-left:6px;">已读</span>' : '<span style="font-size:11px;color:#e74c3c;margin-left:6px;">未读</span>'}
            </div>
            <span style="font-size:11px;color:#8E44AD;">${m.type}</span>
          </div>
          <div style="margin-top:4px;font-size:14px;color:#333;">${htmlEscape(m.content)}</div>
        </div>
      `).join('')}
    </div>
  `;
	const unreadCount = 0;
	return await getLayout(env, user, '消息', content);
}


// ============ 私信主页：输入用户名/UID开启对话 ============
async function renderPmIndex(env, req) {
	const user = await getSessionUser(env, req);
	if (!user) return '请先登录';
	const db = env.DB;
	const convRows = await db.prepare(`
    SELECT DISTINCT CASE WHEN from_user_id = ? THEN to_user_id ELSE from_user_id END AS other_uid
    FROM messages WHERE type = 'pm_chat' AND (from_user_id = ? OR to_user_id = ?)
  `).bind(user.id, user.id, user.id).all();
	let convHtml = '';
	for (const row of convRows.results) {
		const oUid = row.other_uid;
		if (!oUid) continue;
		const other = await db.prepare('SELECT * FROM users WHERE id = ?').bind(oUid).first();
		if (!other) continue;
		const lastMsg = await db.prepare(`
      SELECT * FROM messages WHERE type = 'pm_chat' AND
      ((from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?))
      ORDER BY id DESC LIMIT 1
    `).bind(user.id, oUid, oUid, user.id).first();
		const unread = await db.prepare(`
      SELECT COUNT(*) AS cnt FROM messages WHERE type = 'pm_chat' AND from_user_id = ? AND to_user_id = ? AND is_read = 0
    `).bind(oUid, user.id).first();
		const unreadCnt = unread ? unread.cnt : 0;
		convHtml += `
      <div onclick="location.href='/pm/${oUid}'" style="display:block;padding:10px;border-bottom:1px solid #f5f5f5;color:#333;border-radius:4px;cursor:pointer;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>${renderUsernameLink(other.username, other.color, other.tag, other.id)}</div>
          ${unreadCnt > 0 ? `<span style="background:#e74c3c;color:#fff;font-size:11px;border-radius:10px;padding:1px 8px;">${unreadCnt}</span>` : ''}
        </div>
        <div style="font-size:12px;color:#999;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${lastMsg ? htmlEscape(lastMsg.content) : ''}</div>
      </div>
    `;
	}
	if (!convHtml) convHtml = '<div style="color:#999;padding:20px 0;text-align:center;">暂无私信会话，在上方输入用户名开始聊天</div>';
	const content = `
    <div class="page-header"><h1><i class="fas fa-envelope"></i> 私信</h1>
    <p style="margin-top:4px;">与其他用户的私人聊天</p></div>
    <div class="card">
      <h3 style="margin-bottom:10px;font-size:15px;"><i class="fas fa-paper-plane" style="color:#8E44AD;"></i> 发起新对话</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px;">
        <input id="pm-target-input" placeholder="输入用户名或UID" style="flex:1;min-width:220px;padding:8px 12px;border:1px solid #ddd;border-radius:4px;font-size:14px;">
        <button onclick="openPmChat()" style="background:#8E44AD;color:#fff;border:none;border-radius:4px;padding:8px 18px;cursor:pointer;font-size:14px;">打开对话</button>
      </div>
      <h3 style="margin-bottom:8px;font-size:15px;"><i class="fas fa-comments" style="color:#8E44AD;"></i> 最近会话</h3>
      ${convHtml}
    </div>
    <script>
      async function openPmChat(){
        const val = document.getElementById('pm-target-input').value.trim();
        if(!val) { toast('请输入用户名或UID','warning'); return; }
        let targetUid = null;
        if(/^\\d+$/.test(val)){
          targetUid = parseInt(val);
        } else {
          try {
            const res = await fetch('/api/user/find?username=' + encodeURIComponent(val));
            const json = await res.json();
            if(!res.ok || !json.uid){ toast('找不到该用户','error'); return; }
            targetUid = json.uid;
          } catch(e){ toast('查询失败','error'); return; }
        }
        window.location.href = '/pm/' + targetUid;
      }
      document.getElementById('pm-target-input').addEventListener('keydown', function(e){
        if(e.key === 'Enter') openPmChat();
      });
    </script>
  `;
	return await getLayout(env, user, '私信', content);
}

// ============ 私信聊天窗口：轮询拉取消息 ============
async function renderPmChat(env, req, path) {
	const user = await getSessionUser(env, req);
	if (!user) return '请先登录';
	const db = env.DB;
	const targetUid = parseInt(path.split('/')[2]);
	if (!targetUid) return '用户ID错误';
	if (targetUid === user.id) return '不能和自己聊天';
	const targetUser = await db.prepare('SELECT * FROM users WHERE id = ?').bind(targetUid).first();
	if (!targetUser) return '该用户不存在';
	await db.prepare(`UPDATE messages SET is_read = 1 WHERE type = 'pm_chat' AND from_user_id = ? AND to_user_id = ? AND is_read = 0`)
		.bind(targetUid, user.id).run();
	const content = `
    <div class="page-header">
      <h1><i class="fas fa-envelope"></i> 与 ${htmlEscape(targetUser.username)} 的对话</h1>
      <p style="margin-top:4px;">UID: ${targetUid} &nbsp;|&nbsp; <a href="/pm" style="color:#8E44AD;text-decoration:none;">← 返回私信列表</a> &nbsp;|&nbsp; <a href="/user/${targetUid}" style="color:#8E44AD;text-decoration:none;" target="_blank">查看主页</a></p>
    </div>
    <div class="card" style="padding:0;overflow:hidden;">
      <div id="pm-chat-box" style="height:460px;overflow-y:auto;padding:14px;background:#fafbfc;"></div>
      <div style="display:flex;gap:8px;padding:12px;border-top:1px solid #eee;background:#fff;">
        <textarea id="pm-textarea" placeholder="输入消息，按 Enter 发送，Shift+Enter 换行..." rows="2" style="flex:1;padding:8px 12px;border:1px solid #ddd;border-radius:6px;resize:none;font-size:14px;font-family:inherit;"></textarea>
        <button onclick="sendPmMessage()" style="background:#8E44AD;color:#fff;border:none;border-radius:6px;padding:0 20px;cursor:pointer;font-size:14px;font-weight:500;white-space:nowrap;"><i class="fas fa-paper-plane"></i> 发送</button>
      </div>
    </div>
    <script>
      const PM_TARGET_UID = ${targetUid};
      const PM_MY_UID = ${user.id};
      let pmLastId = 0;
      const pmChatBox = document.getElementById('pm-chat-box');
      function appendPmMessage(m){
        const isMe = m.from_user_id === PM_MY_UID;
        const wrap = document.createElement('div');
        wrap.style.display = 'flex';
        wrap.style.justifyContent = isMe ? 'flex-end' : 'flex-start';
        wrap.style.margin = '6px 0';
        const bubble = document.createElement('div');
        bubble.style.maxWidth = '70%';
        bubble.style.padding = '8px 14px';
        bubble.style.borderRadius = isMe ? '14px 14px 2px 14px' : '14px 14px 14px 2px';
        bubble.style.wordBreak = 'break-word';
        bubble.style.whiteSpace = 'pre-wrap';
        bubble.style.fontSize = '14px';
        bubble.style.lineHeight = '1.5';
        if(isMe){
          bubble.style.background = '#8E44AD';
          bubble.style.color = '#fff';
        } else {
          bubble.style.background = '#fff';
          bubble.style.color = '#333';
          bubble.style.border = '1px solid #e0e0e0';
        }
        bubble.textContent = m.content;
        wrap.appendChild(bubble);
        pmChatBox.appendChild(wrap);
      }
      async function loadPmMessages(){
        try {
          const res = await fetch('/api/pm/chat?to_uid=' + PM_TARGET_UID + '&after=' + pmLastId);
          const json = await res.json();
          if(json.messages && json.messages.length > 0){
            for(const m of json.messages){
              appendPmMessage(m);
              if(m.id > pmLastId) pmLastId = m.id;
            }
            pmChatBox.scrollTop = pmChatBox.scrollHeight;
          }
        } catch(e){ console.warn('轮询失败', e); }
      }
      let pmSending = false;
      async function sendPmMessage(){
        if(pmSending) return;
        const ta = document.getElementById('pm-textarea');
        const text = ta.value.trim();
        if(!text) return;
        pmSending = true;
        ta.value = '';
        try {
          await fetch('/api/pm/send', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({to_uid: PM_TARGET_UID, content: text})
          });
        } catch(e){ toast('发送失败','error'); }
        pmSending = false;
        await loadPmMessages();
      }
      document.getElementById('pm-textarea').addEventListener('keydown', function(e){
        if(e.key === 'Enter' && !e.shiftKey){
          e.preventDefault();
          sendPmMessage();
        }
      });
      loadPmMessages();
      setInterval(loadPmMessages, 2000);
    </script>
  `;
	return await getLayout(env, user, '私信', content);
}

// ============ 首页 ============
async function renderHome(env, req) {
	const user = await getSessionUser(env, req);
	const db = env.DB;

	let unreadCount = 0;
	if (user) {
		const countResult = await db.prepare('SELECT COUNT(*) as cnt FROM messages WHERE to_user_id = ? AND is_read = 0')
			.bind(user.id).first();
		unreadCount = countResult ? countResult.cnt : 0;
	}

	const articles = await db.prepare(
		`SELECT a.*, u.username, u.color, u.tag
     FROM articles a JOIN users u ON a.author_id = u.id
     ORDER BY a.is_pinned DESC, a.created_at DESC LIMIT 10`
	).all();

	const benben = await db.prepare(
		`SELECT b.*, u.username, u.color, u.tag
     FROM benben b JOIN users u ON b.author_id = u.id
     ORDER BY b.created_at DESC LIMIT 5`
	).all();

	const articleCount = await db.prepare('SELECT COUNT(*) as count FROM articles').first();
	const ticketCount = await db.prepare('SELECT COUNT(*) as count FROM tickets').first();
	const banners = await db.prepare('SELECT * FROM banners ORDER BY sort_order ASC, id ASC').all();
	// 统计最近5分钟内活跃的用户数
	const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
	const onlineResult = await db.prepare('SELECT COUNT(*) as cnt FROM users WHERE last_active_at > ?').bind(fiveMinAgo).first();
	const onlineCount = onlineResult ? onlineResult.cnt : 0;

	const today = new Date().toISOString().split('T')[0];
	let isCheckedIn = false;
	let fortuneDisplay = '';
	let fortuneDetail = '';
	let userPoints = 0;

	if (user) {
		userPoints = user.points || 0;
		if (user.checkin_date === today && user.last_fortune) {
			isCheckedIn = true;
			try {
				const fortune = JSON.parse(user.last_fortune);
				fortuneDisplay = `<span style="color:${fortune.color};font-weight:700;font-size:18px;margin-left:6px;">${fortune.level}</span>`;
				if (fortune.activities && fortune.activities.length) {
					const yiList = fortune.activities.filter(a => a.type === '宜');
					const jiList = fortune.activities.filter(a => a.type === '忌');
					fortuneDetail = `
            <div style="margin-top:14px;padding-top:12px;border-top:1px solid #f0f0f0;">
              <div style="text-align:center;margin-bottom:10px;">
                <div style="font-size:22px;font-weight:700;color:${fortune.color};">${fortune.level}</div>
                <div style="font-size:12px;color:#bbb;margin-top:2px;">仅供娱乐</div>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <div>
                  ${yiList.map(a => `
                    <div style="margin-bottom:10px;">
                      <div style="color:#e74c3c;font-weight:700;font-size:15px;">宜：${htmlEscape(a.name)}</div>
                      <div style="color:#e74c3c;font-size:13px;margin-top:2px;">${htmlEscape(a.desc)}</div>
                    </div>
                  `).join('')}
                </div>
                <div>
                  ${jiList.map(a => `
                    <div style="margin-bottom:10px;">
                      <div style="color:#333;font-weight:700;font-size:15px;">忌：${htmlEscape(a.name)}</div>
                      <div style="color:#555;font-size:13px;margin-top:2px;">${htmlEscape(a.desc)}</div>
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>
          `;
				}
			} catch (e) {}
		}
	}

	const content = `
    <style>
      .home-grid { display: grid; grid-template-columns: 1fr; gap: 16px; }
      .home-row-top { display: grid; grid-template-columns: 2fr 1fr; gap: 16px; }
      .home-row-middle { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
      .home-row-bottom { display: grid; grid-template-columns: 2fr 1fr; gap: 16px; align-items: stretch; }
      .card { background: #fff; border-radius: 8px; padding: 16px 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
      .card h3 { font-size: 15px; font-weight: 600; margin-bottom: 10px; color: #333; }
      .card h3 i { margin-right: 6px; color: #8E44AD; }
      .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
      .card-header h3 { margin-bottom: 0; }
      .banner-carousel { position: relative; width: 100%; aspect-ratio: 16/9; overflow: hidden; border-radius: 6px; background: #e8ecf1; }
      .banner-slides { display: flex; width: 100%; height: 100%; transition: transform 0.5s ease; }
      .banner-slide { min-width: 100%; height: 100%; }
      .banner-slide img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .banner-slide a { display: block; width: 100%; height: 100%; }
      .banner-arrow { position: absolute; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,0.4); color: #fff; border: none; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center; transition: background 0.2s; z-index: 2; }
      .banner-arrow:hover { background: rgba(0,0,0,0.6); }
      .banner-arrow.prev { left: 10px; }
      .banner-arrow.next { right: 10px; }
      .banner-dots { position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%); display: flex; gap: 6px; z-index: 2; }
      .banner-dot { width: 8px; height: 8px; border-radius: 50%; background: rgba(255,255,255,0.5); cursor: pointer; transition: all 0.2s; }
      .banner-dot.active { background: #fff; width: 20px; border-radius: 4px; }
      .checkin-btn {
        background: #8E44AD; color: #fff; padding: 6px 18px; border: none; border-radius: 4px; cursor: pointer;
        font-weight: 500; font-size: 14px; transition: background 0.2s;
      }
      .checkin-btn:hover { background: #7d3c98; }
      .checkin-btn:disabled { opacity: 0.6; cursor: not-allowed; }
      .stat-box { text-align: center; padding: 12px 0; }
      .stat-box .num { font-size: 28px; font-weight: 700; color: #8E44AD; }
      .stat-box .label { font-size: 13px; color: #999; margin-top: 4px; }
      .discuss-item { padding: 8px 0; border-bottom: 1px solid #f5f5f5; }
      .discuss-item:last-child { border: none; }
      .discuss-item .title { font-size: 14px; }
      .discuss-item .title a { color: #333; text-decoration: none; }
      .discuss-item .title a:hover { color: #8E44AD; }
      .discuss-item .meta { font-size: 12px; color: #999; margin-top: 2px; }
      .pin-tag { background: #f39c12; color: #fff; font-size: 10px; padding: 1px 8px; border-radius: 3px; margin-left: 4px; }
      .right-side { display: flex; flex-direction: column; gap: 16px; height: 100%; }
      .right-side .card-dynamic { flex: 1; }
      .fortune-display { font-size: 14px; color: #666; margin-top: 4px; }
      .checked-in-badge {
        background: #2ecc71; color: #fff; padding: 4px 14px; border-radius: 4px; font-size: 14px;
        display: inline-flex; align-items: center; gap: 6px;
      }
      .points-display {
        font-size: 14px;
        color: #666;
        margin-top: 4px;
      }
      .points-display strong { color: #8E44AD; }
      @media (max-width: 768px) {
        .home-row-top, .home-row-middle, .home-row-bottom { grid-template-columns: 1fr; }
      }
    </style>

    <div class="home-grid">
      <div class="home-row-top">
        <div class="card" style="padding:0;overflow:hidden;">
          <div class="banner-carousel" id="bannerCarousel">
            <div class="banner-slides" id="bannerSlides">
              ${banners.results.map((b, i) => `
                <div class="banner-slide">
                  ${b.link_url ? `<a href="${htmlEscape(b.link_url)}" target="_blank" rel="noopener"><img src="${htmlEscape(b.image_url)}" alt="Banner ${i+1}" onerror="this.parentElement.parentElement.innerHTML='<div style=\\'padding:40px;text-align:center;color:#999;\\'>StarLight 社区</div>';"></a>` : `<img src="${htmlEscape(b.image_url)}" alt="Banner ${i+1}" onerror="this.parentElement.innerHTML='<div style=\\'padding:40px;text-align:center;color:#999;\\'>StarLight 社区</div>';">`}
                </div>
              `).join('')}
              ${banners.results.length > 1 ? `
                <div class="banner-slide">
                  ${banners.results[0].link_url ? `<a href="${htmlEscape(banners.results[0].link_url)}" target="_blank" rel="noopener"><img src="${htmlEscape(banners.results[0].image_url)}" alt="Banner clone" onerror="this.parentElement.parentElement.innerHTML='<div style=\\'padding:40px;text-align:center;color:#999;\\'>StarLight 社区</div>';"></a>` : `<img src="${htmlEscape(banners.results[0].image_url)}" alt="Banner clone" onerror="this.parentElement.innerHTML='<div style=\\'padding:40px;text-align:center;color:#999;\\'>StarLight 社区</div>';">`}
                </div>
              ` : ''}
            </div>
            ${banners.results.length > 1 ? `
              <button class="banner-arrow prev" onclick="bannerPrev()"><i class="fas fa-chevron-left"></i></button>
              <button class="banner-arrow next" onclick="bannerNext()"><i class="fas fa-chevron-right"></i></button>
              <div class="banner-dots">
                ${banners.results.map((_, i) => `<div class="banner-dot ${i === 0 ? 'active' : ''}" onclick="bannerGoTo(${i})"></div>`).join('')}
              </div>
            ` : ''}
          </div>
        </div>
        <div class="card" style="display:flex;flex-direction:column;justify-content:center;text-align:center;gap:6px;">
          <div style="font-size:14px;color:#666;"><i class="fas fa-calendar-check"></i> 每日签到</div>
          ${user ? `
            <div>
              ${isCheckedIn ? `
                <div style="display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;">
                  <span class="checked-in-badge">
                    <i class="fas fa-check-circle"></i> 今日已签到
                  </span>
                  ${fortuneDisplay}
                </div>
              ` : `
                <button class="checkin-btn" onclick="checkin()">
                  <i class="fas fa-check"></i> 签到 (+10积分)
                </button>
                <div id="checkin-status" style="font-size:13px;color:#999;margin-top:4px;"></div>
              `}
            </div>
            <div class="fortune-display">${isCheckedIn ? '今日运势 ' + fortuneDisplay : '签到获取今日运势'}</div>
            <div class="points-display"><i class="fas fa-coins"></i> 当前积分：<strong>${userPoints}</strong></div>
            ${fortuneDetail}
          ` : `
            <div style="color:#999;font-size:13px;">请 <a href="/login" style="color:#8E44AD;">登录</a> 后签到</div>
          `}
        </div>
      </div>

      <div class="home-row-middle">
        <div class="card">
          <div class="stat-box">
            <div class="num">${articleCount ? articleCount.count : 0}</div>
            <div class="label"><i class="fas fa-file-alt"></i> 帖子总数</div>
          </div>
        </div>
        <div class="card">
          <div class="stat-box">
            <div class="num">${ticketCount ? ticketCount.count : 0}</div>
            <div class="label"><i class="fas fa-ticket-alt"></i> 工单总数</div>
          </div>
        </div>
        <div class="card">
          <div class="stat-box">
            <div class="num">${onlineCount}</div>
            <div class="label"><i class="fas fa-users"></i> 在线用户</div>
          </div>
        </div>
      </div>

      <div class="home-row-bottom">
        <div style="display:flex;flex-direction:column;gap:16px;">
          <div class="card">
            <div class="card-header">
              <h3><i class="fas fa-thumbtack"></i> 置顶 / 最新讨论</h3>
              <a href="/articles/list" style="font-size:13px;color:#8E44AD;text-decoration:none;">查看全部 →</a>
            </div>
            ${articles.results.slice(0, 8).map(a => `
              <div class="discuss-item">
                <div class="title">
                  <a href="/articles/${a.hex_id}">${htmlEscape(a.title)}</a>
                  ${a.is_pinned ? '<span class="pin-tag">置顶</span>' : ''}
                  ${a.is_locked ? '<span class="pin-tag" style="background:#e74c3c;">锁定</span>' : ''}
                </div>
                <div class="meta">
                  ${renderUsernameLink(a.username, a.color, a.tag, a.author_id)}
                  · ${formatTimeToChina(a.created_at)}
                </div>
              </div>
            `).join('')}
            ${articles.results.length === 0 ? '<div style="color:#999;padding:12px 0;text-align:center;">暂无帖子</div>' : ''}
          </div>
        </div>

        <div class="right-side">
          <div class="card">
            <div class="card-header">
              <h3><i class="fas fa-comment-dots"></i> 动态</h3>
              <a href="/benben" style="font-size:13px;color:#8E44AD;text-decoration:none;">更多 →</a>
            </div>
            ${user ? `
              <form action="/api/benben" method="POST" style="display:flex;gap:6px;margin-bottom:10px;">
                <input type="text" name="content" placeholder="说点什么..." required style="flex:1;padding:6px 10px;border:1px solid #ddd;border-radius:4px;font-size:13px;">
                <button type="submit" style="background:#8E44AD;color:#fff;padding:6px 14px;border:none;border-radius:4px;cursor:pointer;font-size:13px;">发布</button>
              </form>
            ` : `
              <div style="color:#999;font-size:13px;margin-bottom:10px;">请 <a href="/login" style="color:#8E44AD;">登录</a> 后发布动态</div>
            `}
            ${benben.results.map(b => `
              <div class="benben-item">
                ${renderUsernameLink(b.username, b.color, b.tag, b.author_id)}
                <span style="font-size:11px;color:#999;margin-left:6px;">${formatTimeToChina(b.created_at)}</span>
                <div class="content">${htmlEscape(b.content)}</div>
              </div>
            `).join('')}
            ${benben.results.length === 0 ? '<div style="color:#999;padding:6px 0;text-align:center;">暂无动态</div>' : ''}
          </div>
        </div>
      </div>
    </div>

    <script>
      async function checkin() {
        const res = await fetch('/api/checkin', { method: 'POST' });
        const data = await res.json();
        const statusEl = document.getElementById('checkin-status');
        if (data.message) {
          statusEl.innerHTML = '<span style="color:#2ecc71;"><i class="fas fa-check-circle"></i> ' + data.message + '</span>';
          if (data.points !== undefined) {
            statusEl.innerHTML += '<br><span style="color:#8E44AD;">+ ' + data.points + ' 积分</span>';
          }
          setTimeout(() => location.reload(), 1500);
        }
      }
      // 轮播图（无缝循环）
      let bannerIndex = 0;
      const bannerTotal = ${banners.results.length};
      let bannerAnimating = false;
      function bannerUpdate(animate) {
        const slides = document.getElementById('bannerSlides');
        if (slides) {
          if (animate === false) {
            slides.style.transition = 'none';
            slides.style.transform = 'translateX(-' + (bannerIndex * 100) + '%)';
            slides.offsetHeight;
            slides.style.transition = '';
          } else {
            slides.style.transform = 'translateX(-' + (bannerIndex * 100) + '%)';
          }
        }
        const realIndex = bannerIndex % bannerTotal;
        document.querySelectorAll('.banner-dot').forEach((d, i) => d.classList.toggle('active', i === realIndex));
      }
      function bannerNext() {
        if (bannerAnimating) return;
        bannerAnimating = true;
        bannerIndex++;
        bannerUpdate();
        if (bannerIndex === bannerTotal) {
          setTimeout(function() { bannerIndex = 0; bannerUpdate(false); bannerAnimating = false; }, 550);
        } else {
          setTimeout(function() { bannerAnimating = false; }, 550);
        }
      }
      function bannerPrev() {
        if (bannerAnimating) return;
        bannerAnimating = true;
        if (bannerIndex === 0) {
          bannerIndex = bannerTotal;
          bannerUpdate(false);
          setTimeout(function() {
            bannerIndex = bannerTotal - 1;
            bannerUpdate();
            setTimeout(function() { bannerAnimating = false; }, 550);
          }, 50);
        } else {
          bannerIndex--;
          bannerUpdate();
          setTimeout(function() { bannerAnimating = false; }, 550);
        }
      }
      function bannerGoTo(i) { bannerIndex = i; bannerUpdate(); }
      if (bannerTotal > 1) setInterval(bannerNext, 5000);
    </script>
  `;

	return await getLayout(env, user, '首页', content);
}

// ============ 动态页面 ============
async function renderBenben(env, req) {
	const user = await getSessionUser(env, req);
	const db = env.DB;

	let unreadCount = 0;
	if (user) {
		const countResult = await db.prepare('SELECT COUNT(*) as cnt FROM messages WHERE to_user_id = ? AND is_read = 0')
			.bind(user.id).first();
		unreadCount = countResult ? countResult.cnt : 0;
	}

	const benben = await db.prepare(
		`SELECT b.*, u.username, u.color, u.tag
     FROM benben b JOIN users u ON b.author_id = u.id
     ORDER BY b.created_at DESC LIMIT 100`
	).all();

	const content = `
    <div class="page-header"><h1><i class="fas fa-comment-dots"></i> 动态</h1></div>
    ${user ? `
      <div class="card">
        <form action="/api/benben" method="POST" style="display:flex;gap:8px;">
          <input type="text" name="content" placeholder="说点什么..." required style="flex:1;padding:8px 12px;border:1px solid #ddd;border-radius:4px;font-size:14px;">
          <button type="submit" style="background:#8E44AD;color:#fff;padding:8px 20px;border:none;border-radius:4px;cursor:pointer;">发布</button>
        </form>
      </div>
    ` : `
      <div class="card" style="color:#999;text-align:center;">请 <a href="/login" style="color:#8E44AD;">登录</a> 后发布动态</div>
    `}
    <div class="card">
      ${benben.results.map(b => `
        <div style="padding:10px 0;border-bottom:1px solid #f5f5f5;">
          ${renderUsernameLink(b.username, b.color, b.tag, b.author_id)}
          <span style="font-size:13px;color:#999;margin-left:8px;">${formatTimeToChina(b.created_at)}</span>
          <div class="markdown-content" style="margin-top:4px;font-size:14px;">${htmlEscape(b.content)}</div>
          ${user && (user.id === b.author_id || user.admin) ? `
            <form action="/api/benben/${b.id}" method="POST" style="display:inline;margin-top:4px;">
              <button type="submit" style="background:none;border:none;color:#e74c3c;cursor:pointer;font-size:12px;"><i class="fas fa-trash-alt"></i> 删除</button>
            </form>
          ` : ''}
        </div>
      `).join('')}
      ${benben.results.length === 0 ? '<div style="color:#999;padding:20px 0;text-align:center;">暂无动态</div>' : ''}
    </div>
  `;
	return await getLayout(env, user, '动态', content);
}

// ============ 帖子列表 ============
async function renderArticleList(env, req) {
	const user = await getSessionUser(env, req);
	const db = env.DB;

	let unreadCount = 0;
	if (user) {
		const countResult = await db.prepare('SELECT COUNT(*) as cnt FROM messages WHERE to_user_id = ? AND is_read = 0')
			.bind(user.id).first();
		unreadCount = countResult ? countResult.cnt : 0;
	}

	const articles = await db.prepare(
		`SELECT a.*, u.username, u.color, u.tag
     FROM articles a JOIN users u ON a.author_id = u.id
     ORDER BY a.is_pinned DESC, a.created_at DESC`
	).all();

	const content = `
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
      <div><h1><i class="fas fa-file-alt"></i> 帖子列表</h1></div>
      <a href="/articles/new" style="background:#8E44AD;color:#fff;padding:6px 16px;border-radius:4px;text-decoration:none;font-size:14px;"><i class="fas fa-plus"></i> 发布新帖</a>
    </div>
    <div class="card">
      ${articles.results.map(a => `
        <div style="padding:10px 0;border-bottom:1px solid #f5f5f5;">
          <a href="/articles/${a.hex_id}" style="font-size:16px;font-weight:500;color:#333;text-decoration:none;">${htmlEscape(a.title)}</a>
          ${a.is_pinned ? '<span style="background:#f39c12;color:#fff;font-size:10px;padding:1px 8px;border-radius:3px;margin-left:4px;">置顶</span>' : ''}
          ${a.is_locked ? '<span style="background:#e74c3c;color:#fff;font-size:10px;padding:1px 8px;border-radius:3px;margin-left:4px;"><i class="fas fa-lock"></i> 锁定</span>' : ''}
          <div style="color:#999;font-size:13px;margin-top:2px;">
            ${renderUsernameLink(a.username, a.color, a.tag, a.author_id)}
            · ${formatTimeToChina(a.created_at)}
          </div>
        </div>
      `).join('')}
    </div>
  `;
	return await getLayout(env, user, '帖子列表', content);
}

// ============ 发布帖子 ============
async function renderArticleNew(env, req) {
	const user = await getSessionUser(env, req);
	if (!user) return '请先登录';

	const db = env.DB;
	let unreadCount = 0;
	if (user) {
		const countResult = await db.prepare('SELECT COUNT(*) as cnt FROM messages WHERE to_user_id = ? AND is_read = 0')
			.bind(user.id).first();
		unreadCount = countResult ? countResult.cnt : 0;
	}

	const content = `
    <div class="page-header"><h1><i class="fas fa-plus-circle"></i> 发布新帖</h1></div>
    <div class="card" style="max-width:800px;">
      <form action="/api/articles" method="POST">
        <div style="margin-bottom:14px;">
          <label style="display:block;font-weight:500;margin-bottom:4px;font-size:14px;">标题</label>
          <input name="title" placeholder="请输入标题" required style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:4px;font-size:14px;">
        </div>
        <div style="margin-bottom:14px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <label style="font-weight:500;font-size:14px;">内容（支持 Markdown）</label>
            <div style="display:flex;gap:4px;">
              <button type="button" id="mdEditBtn" onclick="toggleMdPreview('articleMd','edit')" style="padding:3px 12px;border:1px solid #8E44AD;background:#8E44AD;color:#fff;border-radius:4px;font-size:12px;cursor:pointer;">编辑</button>
              <button type="button" id="mdPreviewBtn" onclick="toggleMdPreview('articleMd','preview')" style="padding:3px 12px;border:1px solid #ddd;background:#fff;color:#666;border-radius:4px;font-size:12px;cursor:pointer;">预览</button>
            </div>
          </div>
          <textarea id="articleMd" name="content" placeholder="支持 Markdown 语法" rows="8" required style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:4px;font-size:14px;resize:vertical;font-family:monospace;"></textarea>
          <div id="articleMdPreview" class="markdown-body md-preview-box" style="display:none;width:100%;padding:12px;border:1px solid #eee;border-radius:4px;min-height:200px;background:#fafbfc;"></div>
        </div>
        <button type="submit" style="background:#8E44AD;color:#fff;padding:8px 24px;border:none;border-radius:4px;font-size:14px;font-weight:500;cursor:pointer;">发布</button>
        <a href="/articles/list" style="margin-left:10px;color:#999;text-decoration:none;">取消</a>
      </form>
    </div>
    <script>
    function toggleMdPreview(textareaId, mode) {
      var ta = document.getElementById(textareaId);
      var pv = document.getElementById(textareaId + 'Preview');
      var editBtn = document.getElementById('mdEditBtn');
      var previewBtn = document.getElementById('mdPreviewBtn');
      if (mode === 'preview') {
        ta.style.display = 'none';
        pv.style.display = 'block';
        editBtn.style.background = '#fff'; editBtn.style.color = '#666'; editBtn.style.borderColor = '#ddd';
        previewBtn.style.background = '#8E44AD'; previewBtn.style.color = '#fff'; previewBtn.style.borderColor = '#8E44AD';
        if (typeof marked !== 'undefined') {
          marked.setOptions({ breaks: true, gfm: true, sanitize: false, headerIds: false, mangle: false });
          pv.innerHTML = marked.parse(ta.value || '');
        } else {
          pv.textContent = ta.value || '';
        }
      } else {
        ta.style.display = 'block';
        pv.style.display = 'none';
        editBtn.style.background = '#8E44AD'; editBtn.style.color = '#fff'; editBtn.style.borderColor = '#8E44AD';
        previewBtn.style.background = '#fff'; previewBtn.style.color = '#666'; previewBtn.style.borderColor = '#ddd';
      }
    }
    </script>
  `;
	return await getLayout(env, user, '发布帖子', content);
}

// ============ 帖子详情 ============
async function renderArticleDetail(env, req, path) {
	const user = await getSessionUser(env, req);
	const db = env.DB;
	const hexId = path.split('/')[2];

	let unreadCount = 0;
	if (user) {
		const countResult = await db.prepare('SELECT COUNT(*) as cnt FROM messages WHERE to_user_id = ? AND is_read = 0')
			.bind(user.id).first();
		unreadCount = countResult ? countResult.cnt : 0;
	}

	const article = await db.prepare(
		`SELECT a.*, u.username, u.color, u.tag
     FROM articles a JOIN users u ON a.author_id = u.id
     WHERE a.hex_id = ?`
	).bind(hexId).first();
	if (!article) return '帖子不存在';
	const comments = await db.prepare(
		`SELECT c.*, u.username, u.color, u.tag
     FROM comments c JOIN users u ON c.author_id = u.id
     WHERE c.article_id = ? ORDER BY c.created_at ASC`
	).bind(article.id).all();

	const isAuthor = user && user.id === article.author_id;
	const isAdmin = user && user.admin;

	const content = `
    <div class="page-header"><h1>${htmlEscape(article.title)} ${article.is_pinned ? '<span style="background:#f39c12;color:#fff;font-size:12px;padding:1px 10px;border-radius:3px;margin-left:6px;">置顶</span>' : ''} ${article.is_locked ? '<span style="background:#e74c3c;color:#fff;font-size:12px;padding:1px 10px;border-radius:3px;margin-left:6px;"><i class="fas fa-lock"></i> 已锁定</span>' : ''}</h1></div>
    <div class="card">
      <div style="color:#999;margin-bottom:12px;font-size:14px;">
        ${renderUsernameLink(article.username, article.color, article.tag, article.author_id)}
        · ${formatTimeToChina(article.created_at)}
      </div>
      <div class="markdown-body markdown-content">${htmlEscape(article.content)}</div>
      <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap;">
        ${(isAuthor || isAdmin) ? `
          <a href="/articles/${hexId}/edit" style="background:#3498db;color:#fff;padding:4px 14px;border-radius:4px;text-decoration:none;font-size:13px;"><i class="fas fa-edit"></i> 编辑</a>
        ` : ''}
        ${user && (user.id === article.author_id || (user.admin && user.id === 1)) ? `
          <form action="/api/articles/${article.id}" method="POST" style="display:inline;">
            <input type="hidden" name="_method" value="DELETE">
            <button type="submit" style="background:#e74c3c;color:#fff;padding:4px 14px;border:none;border-radius:4px;cursor:pointer;font-size:13px;"><i class="fas fa-trash-alt"></i> 删除</button>
          </form>
        ` : ''}
      </div>
    </div>
    <div class="card">
      <h3 style="font-size:15px;font-weight:600;margin-bottom:10px;"><i class="fas fa-comments"></i> 评论</h3>
      ${comments.results.map(c => `
        <div style="padding:8px 0;border-bottom:1px solid #f5f5f5;">
          ${renderUsernameLink(c.username, c.color, c.tag, c.author_id)}
          <span style="font-size:13px;color:#999;margin-left:6px;">${formatTimeToChina(c.created_at)}</span>
          <div class="markdown-body markdown-content" style="margin-top:4px;">${htmlEscape(c.content)}</div>
          ${user && !article.is_locked ? `<button onclick="replyTo(${c.id})" style="background:none;border:none;color:#8E44AD;cursor:pointer;font-size:12px;"><i class="fas fa-reply"></i> 回复</button>` : ''}
          ${user && (user.id === c.author_id || user.admin) ? `
            <form action="/api/comments/${c.id}" method="POST" style="display:inline;">
              <input type="hidden" name="_method" value="DELETE">
              <button type="submit" style="background:none;border:none;color:#e74c3c;cursor:pointer;font-size:12px;"><i class="fas fa-trash-alt"></i> 删除</button>
            </form>
          ` : ''}
        </div>
      `).join('')}
      ${user && !article.is_locked ? `
        <form action="/api/comments" method="POST" style="margin-top:12px;">
          <input type="hidden" name="article_id" value="${article.id}">
          <textarea name="content" placeholder="写评论（支持 Markdown）..." rows="2" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;resize:vertical;font-size:14px;"></textarea>
          <button type="submit" style="margin-top:6px;background:#8E44AD;color:#fff;padding:6px 18px;border:none;border-radius:4px;cursor:pointer;">评论</button>
        </form>
        <div id="reply-box" style="display:none;margin-top:10px;">
          <form action="/api/comments" method="POST">
            <input type="hidden" name="article_id" value="${article.id}">
            <input type="hidden" name="parent_id" id="reply-parent-id" value="0">
            <textarea name="content" placeholder="回复..." rows="2" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;resize:vertical;font-size:14px;"></textarea>
            <button type="submit" style="margin-top:6px;background:#8E44AD;color:#fff;padding:6px 18px;border:none;border-radius:4px;cursor:pointer;">回复</button>
          </form>
        </div>
        <script>
          function replyTo(id) {
            document.getElementById('reply-parent-id').value = id;
            document.getElementById('reply-box').style.display = 'block';
          }
        </script>
      ` : article.is_locked ? `
        <div style="margin-top:12px;padding:12px;background:#fdf2f2;border:1px solid #f5c6c6;border-radius:6px;text-align:center;color:#c0392b;font-size:14px;">
          <i class="fas fa-lock"></i> 该帖子已被管理员锁定，无法评论
        </div>
      ` : ''}
    </div>
  `;
	return await getLayout(env, user, '帖子详情', content);
}

// ============ 帖子编辑 ============
async function renderArticleEdit(env, req, path) {
	const user = await getSessionUser(env, req);
	if (!user) return '请先登录';
	const hexId = path.split('/')[2];
	const db = env.DB;

	let unreadCount = 0;
	if (user) {
		const countResult = await db.prepare('SELECT COUNT(*) as cnt FROM messages WHERE to_user_id = ? AND is_read = 0')
			.bind(user.id).first();
		unreadCount = countResult ? countResult.cnt : 0;
	}

	const article = await db.prepare('SELECT * FROM articles WHERE hex_id = ?').bind(hexId).first();
	if (!article) return '帖子不存在';
	if (user.id !== article.author_id && !user.admin) return '无权限编辑此帖子';

	const content = `
    <div class="page-header"><h1><i class="fas fa-edit"></i> 编辑帖子</h1></div>
    <div class="card" style="max-width:800px;">
      <form action="/api/articles/${article.id}" method="POST">
        <input type="hidden" name="_method" value="PUT">
        <div style="margin-bottom:14px;">
          <label style="display:block;font-weight:500;margin-bottom:4px;font-size:14px;">标题</label>
          <input name="title" value="${htmlEscape(article.title)}" required style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:4px;font-size:14px;">
        </div>
        <div style="margin-bottom:14px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <label style="font-weight:500;font-size:14px;">内容（支持 Markdown）</label>
            <div style="display:flex;gap:4px;">
              <button type="button" id="mdEditBtn" onclick="toggleMdPreview('articleMd','edit')" style="padding:3px 12px;border:1px solid #8E44AD;background:#8E44AD;color:#fff;border-radius:4px;font-size:12px;cursor:pointer;">编辑</button>
              <button type="button" id="mdPreviewBtn" onclick="toggleMdPreview('articleMd','preview')" style="padding:3px 12px;border:1px solid #ddd;background:#fff;color:#666;border-radius:4px;font-size:12px;cursor:pointer;">预览</button>
            </div>
          </div>
          <textarea id="articleMd" name="content" rows="8" required style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:4px;font-size:14px;resize:vertical;font-family:monospace;">${htmlEscape(article.content)}</textarea>
          <div id="articleMdPreview" class="markdown-body md-preview-box" style="display:none;width:100%;padding:12px;border:1px solid #eee;border-radius:4px;min-height:200px;background:#fafbfc;"></div>
        </div>
        <button type="submit" style="background:#8E44AD;color:#fff;padding:8px 24px;border:none;border-radius:4px;font-size:14px;font-weight:500;cursor:pointer;">保存修改</button>
        <a href="/articles/${hexId}" style="margin-left:10px;color:#999;text-decoration:none;">取消</a>
      </form>
    </div>
    <script>
    function toggleMdPreview(textareaId, mode) {
      var ta = document.getElementById(textareaId);
      var pv = document.getElementById(textareaId + 'Preview');
      var editBtn = document.getElementById('mdEditBtn');
      var previewBtn = document.getElementById('mdPreviewBtn');
      if (mode === 'preview') {
        ta.style.display = 'none';
        pv.style.display = 'block';
        editBtn.style.background = '#fff'; editBtn.style.color = '#666'; editBtn.style.borderColor = '#ddd';
        previewBtn.style.background = '#8E44AD'; previewBtn.style.color = '#fff'; previewBtn.style.borderColor = '#8E44AD';
        if (typeof marked !== 'undefined') {
          marked.setOptions({ breaks: true, gfm: true, sanitize: false, headerIds: false, mangle: false });
          pv.innerHTML = marked.parse(ta.value || '');
        } else {
          pv.textContent = ta.value || '';
        }
      } else {
        ta.style.display = 'block';
        pv.style.display = 'none';
        editBtn.style.background = '#8E44AD'; editBtn.style.color = '#fff'; editBtn.style.borderColor = '#8E44AD';
        previewBtn.style.background = '#fff'; previewBtn.style.color = '#666'; previewBtn.style.borderColor = '#ddd';
      }
    }
    </script>
  `;
	return await getLayout(env, user, '编辑帖子', content);
}

// ============ 用户中心 ============
async function renderUser(env, req, path) {
	const uid = parseInt(path.split('/')[2]);
	if (!uid) return '用户ID无效';
	const db = env.DB;
	const user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(uid).first();
	if (!user) return '用户不存在';
	const currentUser = await getSessionUser(env, req);

	let unreadCount = 0;
	if (currentUser) {
		const countResult = await db.prepare('SELECT COUNT(*) as cnt FROM messages WHERE to_user_id = ? AND is_read = 0')
			.bind(currentUser.id).first();
		unreadCount = countResult ? countResult.cnt : 0;
	}

	const followers = await db.prepare('SELECT u.* FROM follows f JOIN users u ON f.follower_id = u.id WHERE f.followee_id = ?').bind(uid).all();
	const followees = await db.prepare('SELECT u.* FROM follows f JOIN users u ON f.followee_id = u.id WHERE f.follower_id = ?').bind(uid).all();
	const isFollowing = currentUser ? await db.prepare('SELECT * FROM follows WHERE follower_id = ? AND followee_id = ?').bind(currentUser.id, uid).first() : null;

	const content = `
    <div class="page-header"><h1 style="color:${getUserColor(user.color)}"><i class="fas fa-user-circle"></i> ${htmlEscape(user.username)}</h1></div>
    <div style="display:grid;gap:16px;">
      <div class="card">
        ${user.tag ? `<span style="background:${getUserColor(user.color)};color:#fff;padding:0 12px;border-radius:3px;display:inline-block;font-size:13px;">${htmlEscape(user.tag)}</span>` : ''}
        <p style="margin-top:8px;font-size:14px;"><i class="fas fa-quote-left" style="color:#999;"></i> ${htmlEscape(user.bio || '这个人很懒...')}</p>
        <p style="font-size:13px;color:#999;">UID: ${user.id} · ${user.admin ? '管理员' : '普通用户'} · 积分: ${user.points || 0} · 禁言: <span style="color:${user.violation_count > 0 ? '#e74c3c' : '#999'};font-weight:600;">${user.violation_count || 0}</span></p>
        ${currentUser && currentUser.id == user.id ? `
          <div style="margin-top:10px;padding-top:10px;border-top:1px solid #f0f0f0;">
            <h4 style="font-size:14px;margin-bottom:6px;"><i class="fas fa-pen"></i> 修改个性签名</h4>
            <form action="/api/user/bio" method="POST" style="display:flex;gap:6px;flex-wrap:wrap;">
              <input type="text" name="bio" placeholder="输入新的个性签名..." value="${htmlEscape(user.bio || '')}" style="flex:1;min-width:180px;padding:6px 10px;border:1px solid #ddd;border-radius:4px;font-size:14px;">
              <button type="submit" style="background:#8E44AD;color:#fff;padding:6px 16px;border:none;border-radius:4px;cursor:pointer;">更新</button>
            </form>
          </div>
        ` : ''}
        ${currentUser && currentUser.id != user.id ? `
          <button onclick="follow(${user.id})" style="margin-top:10px;background:#8E44AD;color:#fff;padding:5px 14px;border:none;border-radius:4px;cursor:pointer;">${isFollowing ? '取消关注' : '关注'}</button>
        ` : ''}
      </div>
      <div class="card">
        <h3 style="font-size:15px;font-weight:600;"><i class="fas fa-users"></i> 粉丝 (${followers.results.length})</h3>
        ${followers.results.map(f => renderUsernameLink(f.username, f.color, f.tag, f.id)).join(' ') || '暂无粉丝'}
      </div>
      <div class="card">
        <h3 style="font-size:15px;font-weight:600;"><i class="fas fa-user-friends"></i> 正在关注 (${followees.results.length})</h3>
        ${followees.results.map(f => renderUsernameLink(f.username, f.color, f.tag, f.id)).join(' ') || '暂未关注任何人'}
      </div>
    </div>
    <script>
      async function follow(uid) {
        const res = await fetch('/api/follow', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({followee_id: uid}) });
        const data = await res.json();
        toast(data.message);
        location.reload();
      }
    </script>
  `;
	return await getLayout(env, currentUser, '用户中心', content);
}

// ============ 工单列表 ============
async function renderTicketList(env, req) {
	const user = await getSessionUser(env, req);
	const db = env.DB;

	let unreadCount = 0;
	if (user) {
		const countResult = await db.prepare('SELECT COUNT(*) as cnt FROM messages WHERE to_user_id = ? AND is_read = 0')
			.bind(user.id).first();
		unreadCount = countResult ? countResult.cnt : 0;
	}

	const tickets = await db.prepare(
		`SELECT t.*, u.username, u.color, u.tag, a.username as assignee_name
     FROM tickets t
     JOIN users u ON t.author_id = u.id
     LEFT JOIN users a ON t.assignee_id = a.id
     ORDER BY t.created_at DESC`
	).all();

	const content = `
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
      <div><h1><i class="fas fa-ticket-alt"></i> 工单列表</h1></div>
      <a href="/ticket/new" style="background:#8E44AD;color:#fff;padding:6px 16px;border-radius:4px;text-decoration:none;font-size:14px;"><i class="fas fa-plus"></i> 创建工单</a>
    </div>
    <div class="card">
      ${tickets.results.map(t => {
		const statusInfo = getTicketStatus(t.status);
		return `
          <div style="padding:10px 0;border-bottom:1px solid #f5f5f5;">
            <a href="/ticket/${t.id}" style="font-size:16px;font-weight:500;color:#333;text-decoration:none;">${htmlEscape(t.title)}</a>
            <span style="background:${statusInfo.color};color:#fff;padding:2px 10px;border-radius:3px;font-size:11px;margin-left:4px;">
              <i class="fas ${statusInfo.icon}"></i> ${statusInfo.label}
            </span>
            <div style="color:#999;font-size:13px;margin-top:2px;">
              ${renderUsernameLink(t.username, t.color, t.tag, t.author_id)}
              ${t.assignee_name ? `· 指派：${htmlEscape(t.assignee_name)}` : '· 未指派'}
              · ${formatTimeToChina(t.created_at)}
            </div>
          </div>
        `;
	}).join('')}
    </div>
  `;
	return await getLayout(env, user, '工单列表', content);
}

// ============ 创建工单 ============
async function renderTicketNew(env, req) {
	const user = await getSessionUser(env, req);
	if (!user) return '请先登录';

	const db = env.DB;
	let unreadCount = 0;
	if (user) {
		const countResult = await db.prepare('SELECT COUNT(*) as cnt FROM messages WHERE to_user_id = ? AND is_read = 0')
			.bind(user.id).first();
		unreadCount = countResult ? countResult.cnt : 0;
	}

	const content = `
    <div class="page-header"><h1><i class="fas fa-plus-circle"></i> 创建工单</h1></div>
    <div class="card" style="max-width:800px;">
      <form action="/api/tickets" method="POST">
        <div style="margin-bottom:14px;">
          <label style="display:block;font-weight:500;margin-bottom:4px;font-size:14px;">标题</label>
          <input name="title" placeholder="请输入工单标题" required style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:4px;font-size:14px;">
        </div>
        <div style="margin-bottom:14px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <label style="font-weight:500;font-size:14px;">详细描述（支持 Markdown）</label>
            <div style="display:flex;gap:4px;">
              <button type="button" id="mdEditBtn" onclick="toggleMdPreview('ticketMd','edit')" style="padding:3px 12px;border:1px solid #8E44AD;background:#8E44AD;color:#fff;border-radius:4px;font-size:12px;cursor:pointer;">编辑</button>
              <button type="button" id="mdPreviewBtn" onclick="toggleMdPreview('ticketMd','preview')" style="padding:3px 12px;border:1px solid #ddd;background:#fff;color:#666;border-radius:4px;font-size:12px;cursor:pointer;">预览</button>
            </div>
          </div>
          <textarea id="ticketMd" name="content" placeholder="详细描述您的问题" rows="6" required style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:4px;font-size:14px;resize:vertical;font-family:monospace;"></textarea>
          <div id="ticketMdPreview" class="markdown-body md-preview-box" style="display:none;width:100%;padding:12px;border:1px solid #eee;border-radius:4px;min-height:150px;background:#fafbfc;"></div>
        </div>
        <button type="submit" style="background:#8E44AD;color:#fff;padding:8px 24px;border:none;border-radius:4px;font-size:14px;font-weight:500;cursor:pointer;">提交</button>
        <a href="/ticket/list" style="margin-left:10px;color:#999;text-decoration:none;">取消</a>
      </form>
    </div>
    <script>
    function toggleMdPreview(textareaId, mode) {
      var ta = document.getElementById(textareaId);
      var pv = document.getElementById(textareaId + 'Preview');
      var editBtn = document.getElementById('mdEditBtn');
      var previewBtn = document.getElementById('mdPreviewBtn');
      if (mode === 'preview') {
        ta.style.display = 'none';
        pv.style.display = 'block';
        editBtn.style.background = '#fff'; editBtn.style.color = '#666'; editBtn.style.borderColor = '#ddd';
        previewBtn.style.background = '#8E44AD'; previewBtn.style.color = '#fff'; previewBtn.style.borderColor = '#8E44AD';
        if (typeof marked !== 'undefined') {
          marked.setOptions({ breaks: true, gfm: true, sanitize: false, headerIds: false, mangle: false });
          pv.innerHTML = marked.parse(ta.value || '');
        } else {
          pv.textContent = ta.value || '';
        }
      } else {
        ta.style.display = 'block';
        pv.style.display = 'none';
        editBtn.style.background = '#8E44AD'; editBtn.style.color = '#fff'; editBtn.style.borderColor = '#8E44AD';
        previewBtn.style.background = '#fff'; previewBtn.style.color = '#666'; previewBtn.style.borderColor = '#ddd';
      }
    }
    </script>
  `;
	return await getLayout(env, user, '创建工单', content);
}

// ============ 工单详情 ============
async function renderTicketDetail(env, req, path) {
	const user = await getSessionUser(env, req);
	const db = env.DB;
	const id = parseInt(path.split('/')[2]);

	let unreadCount = 0;
	if (user) {
		const countResult = await db.prepare('SELECT COUNT(*) as cnt FROM messages WHERE to_user_id = ? AND is_read = 0')
			.bind(user.id).first();
		unreadCount = countResult ? countResult.cnt : 0;
	}

	const ticket = await db.prepare(
		`SELECT t.*, u.username, u.color, u.tag, a.username as assignee_name
     FROM tickets t JOIN users u ON t.author_id = u.id
     LEFT JOIN users a ON t.assignee_id = a.id
     WHERE t.id = ?`
	).bind(id).first();
	if (!ticket) return '工单不存在';
	const replies = await db.prepare(
		`SELECT r.*, u.username, u.color, u.tag FROM ticket_replies r JOIN users u ON r.author_id = u.id WHERE r.ticket_id = ? ORDER BY r.created_at ASC`
	).bind(id).all();
	const admins = await db.prepare('SELECT * FROM users WHERE admin = 1').all();

	const isAuthor = user && user.id === ticket.author_id;
	const isAdmin = user && user.admin;
	const statusInfo = getTicketStatus(ticket.status);

	const content = `
    <div class="page-header"><h1><i class="fas fa-ticket-alt"></i> 工单 #${id}</h1></div>
    <div class="card">
      <h2 style="font-size:18px;">${htmlEscape(ticket.title)}</h2>
      <div style="margin:6px 0;">
        状态：<span style="background:${statusInfo.color};color:#fff;padding:2px 12px;border-radius:3px;font-size:13px;">
          <i class="fas ${statusInfo.icon}"></i> ${statusInfo.label}
        </span>
        ${isAdmin ? `
          <form action="/api/tickets/${ticket.id}/status" method="POST" style="display:inline;margin-left:8px;">
            <select name="status" style="padding:4px 8px;border:1px solid #ddd;border-radius:4px;font-size:13px;">
              <option value="pending" ${ticket.status === 'pending' ? 'selected' : ''}>待处理</option>
              <option value="completed" ${ticket.status === 'completed' ? 'selected' : ''}>已完成</option>
              <option value="closed" ${ticket.status === 'closed' ? 'selected' : ''}>已关闭</option>
              <option value="suspended" ${ticket.status === 'suspended' ? 'selected' : ''}>挂起</option>
              <option value="waiting" ${ticket.status === 'waiting' ? 'selected' : ''}>待补充</option>
            </select>
            <button type="submit" style="background:#8E44AD;color:#fff;padding:4px 14px;border:none;border-radius:4px;cursor:pointer;font-size:13px;">更新状态</button>
          </form>
        ` : ''}
      </div>
      <div style="color:#999;font-size:14px;">
        ${renderUsernameLink(ticket.username, ticket.color, ticket.tag, ticket.author_id)}
        ${ticket.assignee_name ? `· 指派：${htmlEscape(ticket.assignee_name)}` : '· 未指派'}
        · ${formatTimeToChina(ticket.created_at)}
      </div>
      <div class="markdown-body markdown-content" style="margin-top:10px;">${htmlEscape(ticket.content)}</div>
      <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap;">
        ${(isAuthor || isAdmin) ? `
          <a href="/ticket/${id}/edit" style="background:#3498db;color:#fff;padding:4px 14px;border-radius:4px;text-decoration:none;font-size:13px;"><i class="fas fa-edit"></i> 编辑</a>
        ` : ''}
        ${isAdmin ? `
          <form action="/api/tickets/${ticket.id}" method="POST" style="display:flex;gap:6px;align-items:center;">
            <select name="assignee_id" style="padding:4px 8px;border:1px solid #ddd;border-radius:4px;">
              <option value="0">不指派</option>
              ${admins.results.map(a => `<option value="${a.id}" ${a.id == ticket.assignee_id ? 'selected' : ''}>${htmlEscape(a.username)}</option>`).join('')}
            </select>
            <button type="submit" style="background:#8E44AD;color:#fff;padding:4px 14px;border:none;border-radius:4px;cursor:pointer;">指派</button>
          </form>
          <form action="/api/admin/ticket/${ticket.id}/delete" method="POST" style="display:inline;">
            <button type="submit" style="background:#e74c3c;color:#fff;padding:4px 14px;border:none;border-radius:4px;cursor:pointer;"><i class="fas fa-trash-alt"></i> 删除</button>
          </form>
        ` : ''}
      </div>
    </div>
    <div class="card">
      <h3 style="font-size:15px;font-weight:600;margin-bottom:10px;"><i class="fas fa-reply-all"></i> 回复</h3>
      ${replies.results.map(r => `
        <div style="padding:8px 0;border-bottom:1px solid #f5f5f5;">
          ${renderUsernameLink(r.username, r.color, r.tag, r.author_id)}
          <span style="font-size:13px;color:#999;margin-left:6px;">${formatTimeToChina(r.created_at)}</span>
          <div class="markdown-body markdown-content" style="margin-top:4px;">${htmlEscape(r.content)}</div>
        </div>
      `).join('')}
      ${user ? `
        <form action="/api/tickets/${ticket.id}/replies" method="POST" style="margin-top:12px;">
          <textarea name="content" placeholder="回复..." rows="2" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;resize:vertical;font-size:14px;"></textarea>
          <button type="submit" style="margin-top:6px;background:#8E44AD;color:#fff;padding:6px 18px;border:none;border-radius:4px;cursor:pointer;">回复</button>
        </form>
      ` : ''}
    </div>
  `;
	return await getLayout(env, user, '工单详情', content);
}

// ============ 工单编辑 ============
async function renderTicketEdit(env, req, path) {
	const user = await getSessionUser(env, req);
	if (!user) return '请先登录';
	const id = parseInt(path.split('/')[2]);
	const db = env.DB;

	let unreadCount = 0;
	if (user) {
		const countResult = await db.prepare('SELECT COUNT(*) as cnt FROM messages WHERE to_user_id = ? AND is_read = 0')
			.bind(user.id).first();
		unreadCount = countResult ? countResult.cnt : 0;
	}

	const ticket = await db.prepare('SELECT * FROM tickets WHERE id = ?').bind(id).first();
	if (!ticket) return '工单不存在';
	if (user.id !== ticket.author_id && !user.admin) return '无权限编辑此工单';

	const content = `
    <div class="page-header"><h1><i class="fas fa-edit"></i> 编辑工单</h1></div>
    <div class="card" style="max-width:800px;">
      <form action="/api/tickets/${ticket.id}" method="POST">
        <input type="hidden" name="_method" value="PUT">
        <div style="margin-bottom:14px;">
          <label style="display:block;font-weight:500;margin-bottom:4px;font-size:14px;">标题</label>
          <input name="title" value="${htmlEscape(ticket.title)}" required style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:4px;font-size:14px;">
        </div>
        <div style="margin-bottom:14px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <label style="font-weight:500;font-size:14px;">详细描述（支持 Markdown）</label>
            <div style="display:flex;gap:4px;">
              <button type="button" id="mdEditBtn" onclick="toggleMdPreview('ticketMd','edit')" style="padding:3px 12px;border:1px solid #8E44AD;background:#8E44AD;color:#fff;border-radius:4px;font-size:12px;cursor:pointer;">编辑</button>
              <button type="button" id="mdPreviewBtn" onclick="toggleMdPreview('ticketMd','preview')" style="padding:3px 12px;border:1px solid #ddd;background:#fff;color:#666;border-radius:4px;font-size:12px;cursor:pointer;">预览</button>
            </div>
          </div>
          <textarea id="ticketMd" name="content" rows="6" required style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:4px;font-size:14px;resize:vertical;font-family:monospace;">${htmlEscape(ticket.content)}</textarea>
          <div id="ticketMdPreview" class="markdown-body md-preview-box" style="display:none;width:100%;padding:12px;border:1px solid #eee;border-radius:4px;min-height:150px;background:#fafbfc;"></div>
        </div>
        <button type="submit" style="background:#8E44AD;color:#fff;padding:8px 24px;border:none;border-radius:4px;font-size:14px;font-weight:500;cursor:pointer;">保存修改</button>
        <a href="/ticket/${id}" style="margin-left:10px;color:#999;text-decoration:none;">取消</a>
      </form>
    </div>
    <script>
    function toggleMdPreview(textareaId, mode) {
      var ta = document.getElementById(textareaId);
      var pv = document.getElementById(textareaId + 'Preview');
      var editBtn = document.getElementById('mdEditBtn');
      var previewBtn = document.getElementById('mdPreviewBtn');
      if (mode === 'preview') {
        ta.style.display = 'none';
        pv.style.display = 'block';
        editBtn.style.background = '#fff'; editBtn.style.color = '#666'; editBtn.style.borderColor = '#ddd';
        previewBtn.style.background = '#8E44AD'; previewBtn.style.color = '#fff'; previewBtn.style.borderColor = '#8E44AD';
        if (typeof marked !== 'undefined') {
          marked.setOptions({ breaks: true, gfm: true, sanitize: false, headerIds: false, mangle: false });
          pv.innerHTML = marked.parse(ta.value || '');
        } else {
          pv.textContent = ta.value || '';
        }
      } else {
        ta.style.display = 'block';
        pv.style.display = 'none';
        editBtn.style.background = '#8E44AD'; editBtn.style.color = '#fff'; editBtn.style.borderColor = '#8E44AD';
        previewBtn.style.background = '#fff'; previewBtn.style.color = '#666'; previewBtn.style.borderColor = '#ddd';
      }
    }
    </script>
  `;
	return await getLayout(env, user, '编辑工单', content);
}

// ============ 陶片放逐 ============
async function renderJudgement(env, req) {
	const user = await getSessionUser(env, req);
	const db = env.DB;

	let unreadCount = 0;
	if (user) {
		const countResult = await db.prepare('SELECT COUNT(*) as cnt FROM messages WHERE to_user_id = ? AND is_read = 0')
			.bind(user.id).first();
		unreadCount = countResult ? countResult.cnt : 0;
	}

	const logs = await db.prepare(
		`SELECT p.*, u.username as target_name, u.color as target_color, u.tag as target_tag,
            a.username as admin_name, a.color as admin_color, a.tag as admin_tag
     FROM permission_logs p
     JOIN users u ON p.target_id = u.id
     JOIN users a ON p.admin_id = a.id
     ORDER BY p.created_at DESC LIMIT 100`
	).all();

	const content = `
    <div class="page-header"><h1><i class="fas fa-gavel"></i> 陶片放逐</h1></div>
    <div class="card">
      <h2 style="font-size:16px;font-weight:600;margin-bottom:12px;"><i class="fas fa-history"></i> 权限变动日志</h2>
      ${logs.results.length === 0 ? `
        <div style="color:#999;padding:20px 0;text-align:center;">暂无权限变动记录</div>
      ` : `
        ${logs.results.map(log => `
          <div style="padding:10px 0;border-bottom:1px solid #f5f5f5;">
            <div>
              ${log.action === 'grant' ?
		`<span style="color:#2ecc71;font-weight:600;"><i class="fas fa-check-circle"></i> 授予权限</span>` :
		`<span style="color:#e74c3c;font-weight:600;"><i class="fas fa-times-circle"></i> 取消权限</span>`
	}
              ${renderUsernameLink(log.target_name, log.target_color, log.target_tag, log.target_id)}
              ${log.action === 'grant' ? '给予' : '撤销'}
              <strong>${getPermissionName(log.permission)}</strong> 权限
            </div>
            <div style="color:#999;font-size:13px;">原因：${htmlEscape(log.reason)}</div>
            <div style="color:#999;font-size:12px;">
              操作人：${renderUsernameLink(log.admin_name, log.admin_color, log.admin_tag, log.admin_id)}
              · ${formatTimeToChina(log.created_at)}
            </div>
          </div>
        `).join('')}
      `}
    </div>
  `;
	return await getLayout(env, user, '陶片放逐', content);
}

// ============ 云剪贴板 ============
async function renderClipboard(env, req) {
	const user = await getSessionUser(env, req);
	const content = `
    <div class="page-header">
      <h1><i class="fas fa-clipboard"></i> 云剪贴板</h1>
      <p style="margin-top:4px;">基于 Markdown 的在线剪贴板，5位密钥即可存取，支持分享链接</p>
    </div>
    <div class="card">
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:14px;">
        <div style="display:flex;gap:6px;align-items:center;flex:1;min-width:240px;">
          <label style="font-size:13px;color:#666;white-space:nowrap;">密钥:</label>
          <input type="text" id="clipKey" placeholder="5位小写字母" maxlength="5"
            style="flex:1;padding:6px 10px;border:1px solid #ddd;border-radius:4px;font-size:14px;font-family:monospace;text-transform:lowercase;letter-spacing:2px;">
          <button onclick="clipNew()" style="background:#3498db;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:13px;" title="生成新密钥"><i class="fas fa-magic"></i></button>
          <button onclick="clipLoad()" style="background:#2ecc71;color:#fff;border:none;padding:6px 14px;border-radius:4px;cursor:pointer;font-size:13px;"><i class="fas fa-download"></i> 读取</button>
        </div>
        <div style="display:flex;gap:6px;align-items:center;">
          <button onclick="clipSave()" style="background:#8E44AD;color:#fff;border:none;padding:6px 16px;border-radius:4px;cursor:pointer;font-size:13px;font-weight:500;"><i class="fas fa-save"></i> 保存</button>
          <button onclick="clipDelete()" style="background:#e74c3c;color:#fff;border:none;padding:6px 14px;border-radius:4px;cursor:pointer;font-size:13px;"><i class="fas fa-trash-alt"></i> 删除</button>
          <button onclick="clipShare()" style="background:#f39c12;color:#fff;border:none;padding:6px 14px;border-radius:4px;cursor:pointer;font-size:13px;"><i class="fas fa-share-alt"></i> 分享</button>
        </div>
      </div>
      <div id="clipStatus" style="font-size:13px;margin-bottom:10px;min-height:18px;"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div>
          <div style="font-size:12px;color:#999;margin-bottom:4px;"><i class="fas fa-edit"></i> Markdown 编辑</div>
          <textarea id="clipEditor" placeholder="在此输入 Markdown 内容..." rows="20"
            style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;resize:vertical;font-size:13px;font-family:'SF Mono',Monaco,'Courier New',monospace;line-height:1.6;"></textarea>
        </div>
        <div>
          <div style="font-size:12px;color:#999;margin-bottom:4px;"><i class="fas fa-eye"></i> 实时预览</div>
          <div id="clipPreview" class="markdown-body" style="padding:10px;border:1px solid #eee;border-radius:6px;min-height:400px;background:#fafbfc;"></div>
        </div>
      </div>
    </div>
    <script>
      const CLIP_API = 'https://api.slc.lj1.cc.cd';
      const clipEditor = document.getElementById('clipEditor');
      const clipPreview = document.getElementById('clipPreview');
      const clipKeyInput = document.getElementById('clipKey');
      const clipStatus = document.getElementById('clipStatus');

      function clipSetStatus(msg, type) {
        clipStatus.innerHTML = '<span style="color:' + (type === 'error' ? '#e74c3c' : type === 'success' ? '#2ecc71' : '#999') + ';">' + msg + '</span>';
        if (type) setTimeout(function(){ clipStatus.innerHTML = ''; }, 4000);
      }

      function clipRenderPreview() {
        var text = clipEditor.value;
        try {
          if (typeof marked !== 'undefined' && typeof marked.parse === 'function') {
            marked.setOptions({ breaks: true, gfm: true, sanitize: false, headerIds: false, mangle: false });
            clipPreview.innerHTML = marked.parse(text);
          } else {
            clipPreview.innerHTML = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\\n/g,'<br>');
          }
        } catch(e) { clipPreview.textContent = text; }
      }
      clipEditor.addEventListener('input', clipRenderPreview);

      function clipValidKey(k) { return /^[a-z]{5}$/.test(k); }

      async function clipNew() {
        try {
          clipSetStatus('生成中...');
          var res = await fetch(CLIP_API + '/new');
          var data = await res.json();
          if (data.ok && data.key) {
            clipKeyInput.value = data.key;
            clipEditor.value = '';
            clipRenderPreview();
            clipSetStatus('已生成新密钥: ' + data.key + '，编辑内容后点击保存', 'success');
            history.replaceState(null, '', '/clipboard?k=' + data.key);
          } else {
            clipSetStatus('生成失败: ' + (data.msg || '未知错误'), 'error');
          }
        } catch(e) { clipSetStatus('网络错误: ' + e.message, 'error'); }
      }

      async function clipLoad() {
        var key = clipKeyInput.value.trim().toLowerCase();
        if (!clipValidKey(key)) { clipSetStatus('密钥必须是5位小写字母', 'error'); return; }
        try {
          clipSetStatus('读取中...');
          var res = await fetch(CLIP_API + '/api/' + key);
          if (res.status === 404) { clipSetStatus('该密钥剪贴板不存在', 'error'); return; }
          if (!res.ok) { clipSetStatus('读取失败 (' + res.status + ')', 'error'); return; }
          var text = await res.text();
          clipEditor.value = text;
          clipRenderPreview();
          clipSetStatus('读取成功', 'success');
          history.replaceState(null, '', '/clipboard?k=' + key);
        } catch(e) { clipSetStatus('网络错误: ' + e.message, 'error'); }
      }

      async function clipSave() {
        var key = clipKeyInput.value.trim().toLowerCase();
        if (!clipValidKey(key)) { clipSetStatus('密钥必须是5位小写字母', 'error'); return; }
        var content = clipEditor.value;
        try {
          clipSetStatus('保存中...');
          var res = await fetch(CLIP_API + '/api/' + key, { method: 'POST', body: content });
          var data = await res.json();
          if (data.ok) {
            clipSetStatus('保存成功', 'success');
            history.replaceState(null, '', '/clipboard?k=' + key);
          } else {
            clipSetStatus('保存失败: ' + (data.msg || '未知错误'), 'error');
          }
        } catch(e) { clipSetStatus('网络错误: ' + e.message, 'error'); }
      }

      async function clipDelete() {
        var key = clipKeyInput.value.trim().toLowerCase();
        if (!clipValidKey(key)) { clipSetStatus('密钥必须是5位小写字母', 'error'); return; }
        if (!confirm('确定删除密钥 ' + key + ' 的剪贴板？此操作不可恢复！')) return;
        try {
          clipSetStatus('删除中...');
          var res = await fetch(CLIP_API + '/api/' + key, { method: 'DELETE' });
          var data = await res.json();
          if (data.ok) {
            clipSetStatus('已删除', 'success');
            clipEditor.value = '';
            clipRenderPreview();
          } else {
            clipSetStatus('删除失败: ' + (data.msg || '未知错误'), 'error');
          }
        } catch(e) { clipSetStatus('网络错误: ' + e.message, 'error'); }
      }

      function clipShare() {
        var key = clipKeyInput.value.trim().toLowerCase();
        if (!clipValidKey(key)) { clipSetStatus('密钥必须是5位小写字母', 'error'); return; }
        var url = location.origin + '/clipboard?k=' + key;
        if (navigator.clipboard) {
          navigator.clipboard.writeText(url).then(function() {
            clipSetStatus('分享链接已复制: ' + url, 'success');
          }).catch(function() { prompt('复制以下链接分享:', url); });
        } else {
          prompt('复制以下链接分享:', url);
        }
      }

      (function() {
        var params = new URLSearchParams(location.search);
        var k = params.get('k');
        if (k && clipValidKey(k)) {
          clipKeyInput.value = k;
          clipLoad();
        }
      })();
    </script>
  `;
	return await getLayout(env, user, '云剪贴板', content);
}

// ============ 后台管理 ============
async function renderBackend(env, req) {
	const user = await getSessionUser(env, req);
	if (!user || !user.admin) return '无权限';
	const db = env.DB;

	let unreadCount = 0;
	if (user) {
		const countResult = await db.prepare('SELECT COUNT(*) as cnt FROM messages WHERE to_user_id = ? AND is_read = 0')
			.bind(user.id).first();
		unreadCount = countResult ? countResult.cnt : 0;
	}

	const users = await db.prepare('SELECT * FROM users ORDER BY id').all();
	const articles = await db.prepare('SELECT * FROM articles ORDER BY id DESC').all();
	const tickets = await db.prepare('SELECT * FROM tickets ORDER BY id DESC').all();
	const banners = await db.prepare('SELECT * FROM banners ORDER BY sort_order ASC, id ASC').all();

	const content = `
    <div class="page-header"><h1><i class="fas fa-cog"></i> 后台管理</h1></div>

    <div class="card" style="overflow-x:auto;">
      <h2 style="font-size:16px;font-weight:600;margin-bottom:12px;"><i class="fas fa-users"></i> 用户管理</h2>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="border-bottom:2px solid #f0f0f0;">
            <th style="text-align:left;padding:6px;">ID</th>
            <th style="text-align:left;padding:6px;">用户名</th>
            <th style="text-align:left;padding:6px;">权限</th>
            <th style="text-align:left;padding:6px;">颜色</th>
            <th style="text-align:left;padding:6px;">牌子</th>
            <th style="text-align:left;padding:6px;">禁言</th>
            <th style="text-align:left;padding:6px;">最近登录</th>
            <th style="text-align:left;padding:6px;">操作</th>
          </tr>
        </thead>
        <tbody>
          ${users.results.map(u => `
            <tr style="border-bottom:1px solid #f5f5f5;">
              <td style="padding:6px;">${u.id}</td>
              <td style="padding:6px;">${renderUsernameLink(u.username, u.color, u.tag, u.id)}</td>
              <td style="padding:6px;font-size:12px;">use:${u.use} speak:${u.speak} admin:${u.admin}</td>
              <td style="padding:6px;"><span style="display:inline-block;width:12px;height:12px;border-radius:2px;background:${getUserColor(u.color)};vertical-align:middle;margin-right:4px;"></span>${({purple:'紫名',red:'红名',orange:'橙名',green:'绿名',blue:'蓝名',gray:'灰名'})[u.color] || u.color}</td>
              <td style="padding:6px;">${u.tag || '无'}</td>
              <td style="padding:6px;"><span style="color:${u.violation_count > 0 ? '#e74c3c' : '#999'};font-weight:600;">${u.violation_count || 0}</span></td>
              <td style="padding:6px;font-size:12px;color:#666;line-height:1.5;">
                ${u.last_ip ? `<div><i class="fas fa-network-wired" style="color:#8E44AD;"></i> ${htmlEscape(u.last_ip)}</div>` : '<div style="color:#bbb;">无记录</div>'}
                ${u.last_login_at ? `<div style="color:#999;">${formatTimeToChina(u.last_login_at)}</div>` : ''}
              </td>
              <td style="padding:6px;">
                <form action="/api/admin/user/${u.id}" method="POST" style="display:flex;gap:4px;flex-wrap:wrap;align-items:center;">
                  <select name="color" style="padding:3px 6px;border:1px solid #ddd;border-radius:3px;font-size:12px;">
                    <option value="purple" ${u.color === 'purple' ? 'selected' : ''}>紫名</option>
                    <option value="red" ${u.color === 'red' ? 'selected' : ''}>红名</option>
                    <option value="orange" ${u.color === 'orange' ? 'selected' : ''}>橙名</option>
                    <option value="green" ${u.color === 'green' ? 'selected' : ''}>绿名</option>
                    <option value="blue" ${u.color === 'blue' ? 'selected' : ''}>蓝名</option>
                    <option value="gray" ${u.color === 'gray' ? 'selected' : ''}>灰名</option>
                  </select>
                  <input type="text" name="tag" placeholder="牌子" value="${u.tag || ''}" style="width:50px;padding:3px 6px;border:1px solid #ddd;border-radius:3px;font-size:12px;">
                  <select name="permission" style="padding:3px 6px;border:1px solid #ddd;border-radius:3px;font-size:12px;">
                    <option value="use">进入网站</option>
                    <option value="speak">发言</option>
                    <option value="admin">管理员</option>
                  </select>
                  <select name="action" style="padding:3px 6px;border:1px solid #ddd;border-radius:3px;font-size:12px;">
                    <option value="grant">授予</option>
                    <option value="revoke">取消</option>
                  </select>
                  <input type="text" name="reason" placeholder="原因" required style="width:70px;padding:3px 6px;border:1px solid #ddd;border-radius:3px;font-size:12px;">
                  <button type="submit" style="background:#8E44AD;color:#fff;padding:3px 10px;border:none;border-radius:3px;cursor:pointer;font-size:12px;">执行</button>
                </form>
                <form action="/api/admin/user/${u.id}/delete" method="POST" style="display:inline;">
                  <button type="submit" style="background:#e74c3c;color:#fff;padding:3px 10px;border:none;border-radius:3px;cursor:pointer;font-size:12px;margin-top:3px;">删除</button>
                </form>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="card">
      <h2 style="font-size:16px;font-weight:600;margin-bottom:12px;"><i class="fas fa-file-alt"></i> 帖子管理</h2>
      ${articles.results.map(a => `
        <div style="padding:6px 0;border-bottom:1px solid #f5f5f5;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">
          <span style="font-size:14px;">${htmlEscape(a.title)} <span style="color:#999;font-size:12px;">· ${formatTimeToChina(a.created_at)}</span></span>
          <div style="display:flex;gap:4px;">
            <form action="/api/admin/article/${a.id}/delete" method="POST" style="display:inline;">
              <button type="submit" style="background:#e74c3c;color:#fff;padding:2px 10px;border:none;border-radius:3px;cursor:pointer;font-size:12px;">删除</button>
            </form>
            <form action="/api/admin/article/${a.id}/pin" method="POST" style="display:inline;">
              <button type="submit" style="background:#8E44AD;color:#fff;padding:2px 10px;border:none;border-radius:3px;cursor:pointer;font-size:12px;">${a.is_pinned ? '取消置顶' : '置顶'}</button>
            </form>
            <form action="/api/admin/article/${a.id}/lock" method="POST" style="display:inline;">
              <button type="submit" style="background:${a.is_locked ? '#27ae60' : '#7f8c8d'};color:#fff;padding:2px 10px;border:none;border-radius:3px;cursor:pointer;font-size:12px;">${a.is_locked ? '解锁' : '锁定'}</button>
            </form>
          </div>
        </div>
      `).join('')}
    </div>

    <div class="card">
      <h2 style="font-size:16px;font-weight:600;margin-bottom:12px;"><i class="fas fa-ticket-alt"></i> 工单管理</h2>
      ${tickets.results.map(t => {
		const statusInfo = getTicketStatus(t.status);
		return `
          <div style="padding:6px 0;border-bottom:1px solid #f5f5f5;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">
            <span style="font-size:14px;">#${t.id} ${htmlEscape(t.title)} <span style="color:#999;font-size:12px;">
              <i class="fas ${statusInfo.icon}"></i> ${statusInfo.label} · ${formatTimeToChina(t.created_at)}
            </span></span>
            <div style="display:flex;gap:4px;">
              <form action="/api/admin/ticket/${t.id}/delete" method="POST" style="display:inline;">
                <button type="submit" style="background:#e74c3c;color:#fff;padding:2px 10px;border:none;border-radius:3px;cursor:pointer;font-size:12px;">删除</button>
              </form>
            </div>
          </div>
        `;
	}).join('')}
    </div>
    <div class="card">
      <h2 style="font-size:16px;font-weight:600;margin-bottom:12px;"><i class="fas fa-images"></i> 轮播图管理</h2>
      <form action="/api/admin/banner/add" method="POST" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;padding:12px;background:#f8f9fa;border-radius:6px;">
        <input type="url" name="image_url" placeholder="图片URL (16:9)" required style="flex:1;min-width:200px;padding:6px 10px;border:1px solid #ddd;border-radius:4px;font-size:13px;">
        <input type="url" name="link_url" placeholder="跳转链接 (可选)" style="flex:1;min-width:160px;padding:6px 10px;border:1px solid #ddd;border-radius:4px;font-size:13px;">
        <input type="number" name="sort_order" placeholder="排序" value="0" style="width:70px;padding:6px 10px;border:1px solid #ddd;border-radius:4px;font-size:13px;">
        <button type="submit" style="background:#8E44AD;color:#fff;padding:6px 16px;border:none;border-radius:4px;cursor:pointer;font-size:13px;"><i class="fas fa-plus"></i> 添加</button>
      </form>
      ${banners.results.length === 0 ? '<div style="color:#999;padding:12px 0;text-align:center;">暂无轮播图</div>' : ''}
      ${banners.results.map(b => `
        <div style="padding:10px 0;border-bottom:1px solid #f5f5f5;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
          <div style="display:flex;align-items:center;gap:12px;flex:1;min-width:200px;">
            <img src="${htmlEscape(b.image_url)}" style="width:80px;height:45px;object-fit:cover;border-radius:4px;background:#eee;" onerror="this.style.display='none';">
            <div style="font-size:13px;">
              <div style="color:#333;word-break:break-all;">${htmlEscape(b.image_url)}</div>
              <div style="color:#999;font-size:12px;margin-top:2px;">
                ${b.link_url ? `<i class="fas fa-link"></i> ${htmlEscape(b.link_url)}` : '<i class="fas fa-link-slash"></i> 无跳转'}
                &nbsp;·&nbsp; 排序: ${b.sort_order}
              </div>
            </div>
          </div>
          <form action="/api/admin/banner/${b.id}/delete" method="POST" style="display:inline;">
            <button type="submit" style="background:#e74c3c;color:#fff;padding:4px 12px;border:none;border-radius:4px;cursor:pointer;font-size:12px;"><i class="fas fa-trash-alt"></i> 删除</button>
          </form>
        </div>
      `).join('')}
    </div>
  `;
	return await getLayout(env, user, '后台管理', content);
}

// ============ API 处理 ============
async function handleApi(req, env, path) {
	const db = env.DB;
	const user = await getSessionUser(env, req);
	const method = req.method;

	// 登录 API
	if (path === '/api/login' && method === 'POST') {
		const body = await req.json();
		const { username, password } = body;
		if (!username || !password) return jsonRes({ error: '用户名和密码不能为空' }, 400);
		const hashedPassword = await sha256(password);
		const dbUser = await db.prepare('SELECT * FROM users WHERE username = ? AND password = ?')
			.bind(username, hashedPassword).first();
		if (!dbUser) return jsonRes({ error: '用户名或密码错误' }, 401);
		if (!dbUser.use) return jsonRes({ error: '您的账号已被禁用' }, 403);
		// 记录登录IP和地理位置（用 v2.xxapi.cn 精准定位，失败回退 Cloudflare）
		const loginIp = req.headers.get('CF-Connecting-IP') || '';
		let loginRegion = req.cf?.region || '';
		let loginCity = req.cf?.city || '';
		const loginTime = new Date().toISOString();
		try {
			const ctrl = new AbortController();
			const timer = setTimeout(() => ctrl.abort(), 3000);
			const ipRes = await fetch(`https://v2.xxapi.cn/api/ip?ip=${encodeURIComponent(loginIp)}`, { signal: ctrl.signal });
			clearTimeout(timer);
			if (ipRes.ok) {
				const ipData = await ipRes.json();
				if (ipData.code === 200 && ipData.data && ipData.data.address) {
					const addr = ipData.data.address.replace(/^中国/, '');
					const m = addr.match(/^(.+?(?:省|市|自治区|特别行政区))(.*)$/);
					if (m) {
						loginRegion = m[1];
						loginCity = m[2] || '';
					} else {
						loginRegion = addr;
					}
				}
			}
		} catch (e) {}
		await db.prepare('UPDATE users SET last_ip = ?, last_region = ?, last_city = ?, last_login_at = ? WHERE id = ?')
			.bind(loginIp, loginRegion, loginCity, loginTime, dbUser.id).run();
		return new Response(JSON.stringify({
			message: '登录成功',
			user: { id: dbUser.id, username: dbUser.username, admin: dbUser.admin, color: dbUser.color }
		}), {
			status: 200,
			headers: {
				'Content-Type': 'application/json',
				'Set-Cookie': `uid=${dbUser.id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`
			}
		});
	}

	// 注册 API
	if (path === '/api/register' && method === 'POST') {
		const body = await req.json();
		const { username, password } = body;
		if (!username || !password) return jsonRes({ error: '用户名和密码不能为空' }, 400);
		if (username.length < 3) return jsonRes({ error: '用户名至少3个字符' }, 400);
		if (username.length > 25) return jsonRes({ error: '用户名不能超过25个字符' }, 400);
		if (password.length < 6) return jsonRes({ error: '密码至少6个字符' }, 400);
		const nameViolation = await checkViolation(username);
		if (nameViolation.violated) {
			return jsonRes({ error: `用户名包含违禁词：${nameViolation.words.join('、')}` }, 400);
		}
		const existing = await db.prepare('SELECT * FROM users WHERE username = ?').bind(username).first();
		if (existing) return jsonRes({ error: '用户名已存在' }, 409);
		const hashedPassword = await sha256(password);
		await db.prepare('INSERT INTO users (username, password, color) VALUES (?, ?, ?)')
			.bind(username, hashedPassword, 'red').run();
		return jsonRes({ message: '注册成功！请登录' }, 201);
	}

	// 签到 API
	if (path === '/api/checkin' && method === 'POST') {
		if (!user) return jsonRes({ error: '未登录' }, 403);
		const today = new Date().toISOString().split('T')[0];
		if (user.checkin_date === today) {
			let fortune = null;
			if (user.last_fortune) {
				try { fortune = JSON.parse(user.last_fortune); } catch (e) {}
			}
			if (!fortune) fortune = generateFortune();
			return jsonRes({
				message: '今日已签到',
				fortune: fortune,
				checked: true,
				points: 0
			});
		}
		const fortune = generateFortune();
		const newPoints = (user.points || 0) + 10;
		await db.prepare('UPDATE users SET checkin_date = ?, last_fortune = ?, points = ? WHERE id = ?')
			.bind(today, JSON.stringify(fortune), newPoints, user.id).run();
		return jsonRes({
			message: '签到成功！获得 10 积分',
			fortune: fortune,
			checked: false,
			points: 10,
			total: newPoints
		});
	}

	// 修改个性签名 API
	if (path === '/api/user/bio' && method === 'POST') {
		if (!user) return jsonRes({ error: '未登录' }, 403);
		if (!user.speak) return jsonRes({ error: '您已被禁言，无法修改资料。如需申诉，请提交工单。' }, 403);
		const form = await req.formData();
		const bio = form.get('bio') || '';
		const bioViolation = await checkViolation(bio);
		if (bioViolation.violated) return violationErrorPage(bioViolation);
		await db.prepare('UPDATE users SET bio = ? WHERE id = ?').bind(bio.trim(), user.id).run();
		return new Response(null, { status: 302, headers: { Location: `/user/${user.id}` } });
	}

	// 关注 API
	if (path === '/api/follow' && method === 'POST') {
		if (!user) return jsonRes({ error: '未登录' }, 403);
		const body = await req.json();
		const followee_id = body.followee_id;
		if (!followee_id) return jsonRes({ error: '缺少参数' });
		if (parseInt(followee_id) === user.id) return jsonRes({ error: '不能关注自己' });
		const exists = await db.prepare('SELECT * FROM follows WHERE follower_id = ? AND followee_id = ?').bind(user.id, followee_id).first();
		if (exists) {
			await db.prepare('DELETE FROM follows WHERE follower_id = ? AND followee_id = ?').bind(user.id, followee_id).run();
			return jsonRes({ message: '已取消关注' });
		} else {
			await db.prepare('INSERT INTO follows (follower_id, followee_id) VALUES (?, ?)').bind(user.id, followee_id).run();
			return jsonRes({ message: '关注成功' });
		}
	}

	// 动态 API
	if (path === '/api/benben' && method === 'POST') {
		if (!user) return jsonRes({ error: '未登录' }, 403);
		if (!user.speak) return jsonRes({ error: '您已被禁言，无法发布动态。如需申诉，请提交工单。' }, 403);
		const form = await req.formData();
		const content = form.get('content');
		if (!content || content.trim() === '') return jsonRes({ error: '内容不能为空' }, 400);
		const benbenViolation = await checkViolation(content);
		if (benbenViolation.violated) return violationErrorPage(benbenViolation);
		await db.prepare('INSERT INTO benben (content, author_id) VALUES (?, ?)')
			.bind(content.trim(), user.id).run();
		return new Response(null, { status: 302, headers: { Location: '/benben' } });
	}

	if (path.match(/^\/api\/benben\/\d+$/) && method === 'POST') {
		if (!user) return jsonRes({ error: '未登录' }, 403);
		const id = parseInt(path.split('/')[3]);
		const benben = await db.prepare('SELECT * FROM benben WHERE id = ?').bind(id).first();
		if (!benben) return jsonRes({ error: '动态不存在' });
		if (user.id !== benben.author_id && !user.admin) return jsonRes({ error: '无权限' });
		await db.prepare('DELETE FROM benben WHERE id = ?').bind(id).run();
		return new Response(null, { status: 302, headers: { Location: '/benben' } });
	}

	// 帖子 API
	if (path === '/api/articles' && method === 'POST') {
		if (!user) return jsonRes({ error: '未登录' }, 403);
		if (!user.speak) return jsonRes({ error: '您已被禁言，无法发布帖子。如需申诉，请提交工单。' }, 403);
		const form = await req.formData();
		const title = form.get('title');
		const content = form.get('content');
		if (!title || !content) return jsonRes({ error: '缺少标题或内容' });
		const articleViolation = await checkViolation(`${title}\n${content}`);
		if (articleViolation.violated) return violationErrorPage(articleViolation);
		const hex = generateHex();
		await db.prepare('INSERT INTO articles (hex_id, title, content, author_id) VALUES (?, ?, ?, ?)')
			.bind(hex, title, content, user.id).run();
		return new Response(null, { status: 302, headers: { Location: `/articles/${hex}` } });
	}

	if (path.match(/^\/api\/articles\/\d+$/) && method === 'POST') {
		const form = await req.formData();
		const methodOverride = form.get('_method');
		if (methodOverride === 'PUT') {
			if (!user) return jsonRes({ error: '未登录' }, 403);
			const id = parseInt(path.split('/')[3]);
			const article = await db.prepare('SELECT * FROM articles WHERE id = ?').bind(id).first();
			if (!article) return jsonRes({ error: '帖子不存在' });
			if (user.id !== article.author_id && !user.admin) return jsonRes({ error: '无权限' });
			if (!user.speak) return jsonRes({ error: '您已被禁言，无法编辑帖子。如需申诉，请提交工单。' }, 403);
			const title = form.get('title');
			const content = form.get('content');
			if (!title || !content) return jsonRes({ error: '标题和内容不能为空' });
			const editArticleViolation = await checkViolation(`${title}\n${content}`);
			if (editArticleViolation.violated) return violationErrorPage(editArticleViolation);
			await db.prepare('UPDATE articles SET title = ?, content = ? WHERE id = ?')
				.bind(title, content, id).run();
			return new Response(null, { status: 302, headers: { Location: `/articles/${article.hex_id}` } });
		} else if (methodOverride === 'DELETE') {
			if (!user) return jsonRes({ error: '未登录' }, 403);
			const id = parseInt(path.split('/')[3]);
			const article = await db.prepare('SELECT * FROM articles WHERE id = ?').bind(id).first();
			if (!article) return jsonRes({ error: '帖子不存在' });
			if (user.id !== article.author_id && !user.admin) return jsonRes({ error: '无权限' });
			await db.prepare('DELETE FROM comments WHERE article_id = ?').bind(id).run();
			await db.prepare('DELETE FROM articles WHERE id = ?').bind(id).run();
			return new Response(null, { status: 302, headers: { Location: '/articles/list' } });
		}
		return jsonRes({ error: '无效请求' }, 400);
	}

	// 评论 API
	if (path === '/api/comments' && method === 'POST') {
		if (!user) return jsonRes({ error: '未登录' }, 403);
		if (!user.speak) return jsonRes({ error: '您已被禁言，无法评论。如需申诉，请提交工单。' }, 403);
		const form = await req.formData();
		const article_id = form.get('article_id');
		const content = form.get('content');
		const parent_id = parseInt(form.get('parent_id')) || 0;
		if (!article_id || !content) return jsonRes({ error: '缺少参数' });
		const targetArticle = await db.prepare('SELECT is_locked, author_id FROM articles WHERE id = ?').bind(article_id).first();
		if (!targetArticle) return jsonRes({ error: '帖子不存在' }, 404);
		if (targetArticle.is_locked && !user.admin) return jsonRes({ error: '该帖子已锁定，无法评论' }, 403);
		const commentViolation = await checkViolation(content);
		if (commentViolation.violated) return violationErrorPage(commentViolation);
		await db.prepare('INSERT INTO comments (article_id, author_id, content, parent_id) VALUES (?, ?, ?, ?)')
			.bind(article_id, user.id, content, parent_id).run();
		// 通知文章作者（如果有评论）
		if (targetArticle.author_id !== user.id) {
			await sendNotification(env, targetArticle.author_id, user.id, `在帖子中评论了: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`, 'comment', article_id);
		}
		const referer = req.headers.get('referer') || '/articles/list';
		return new Response(null, { status: 302, headers: { Location: referer } });
	}

	if (path.match(/^\/api\/comments\/\d+$/) && method === 'POST') {
		if (!user) return jsonRes({ error: '未登录' }, 403);
		const form = await req.formData();
		const methodOverride = form.get('_method');
		if (methodOverride === 'DELETE') {
			const id = parseInt(path.split('/')[3]);
			const comment = await db.prepare('SELECT * FROM comments WHERE id = ?').bind(id).first();
			if (!comment) return jsonRes({ error: '评论不存在' });
			if (user.id !== comment.author_id && !user.admin) return jsonRes({ error: '无权限' });
			await db.prepare('DELETE FROM comments WHERE id = ?').bind(id).run();
			const referer = req.headers.get('referer') || '/articles/list';
			return new Response(null, { status: 302, headers: { Location: referer } });
		}
		return jsonRes({ error: '无效请求' }, 400);
	}

	// 工单 API
	if (path === '/api/tickets' && method === 'POST') {
		if (!user) return jsonRes({ error: '未登录' }, 403);
		const form = await req.formData();
		const title = form.get('title');
		const content = form.get('content');
		if (!title || !content) return jsonRes({ error: '缺少参数' });
		const ticketViolation = await checkViolation(`${title}\n${content}`);
		if (ticketViolation.violated) return violationErrorPage(ticketViolation);
		await db.prepare('INSERT INTO tickets (title, content, author_id) VALUES (?, ?, ?)')
			.bind(title, content, user.id).run();
		return new Response(null, { status: 302, headers: { Location: '/ticket/list' } });
	}

	if (path.match(/^\/api\/tickets\/\d+$/) && method === 'POST') {
		const form = await req.formData();
		const methodOverride = form.get('_method');
		if (methodOverride === 'PUT') {
			if (!user) return jsonRes({ error: '未登录' }, 403);
			const id = parseInt(path.split('/')[3]);
			const ticket = await db.prepare('SELECT * FROM tickets WHERE id = ?').bind(id).first();
			if (!ticket) return jsonRes({ error: '工单不存在' });
			if (user.id !== ticket.author_id && !user.admin) return jsonRes({ error: '无权限' });
			const title = form.get('title');
			const content = form.get('content');
			if (!title || !content) return jsonRes({ error: '标题和内容不能为空' });
			const editTicketViolation = await checkViolation(`${title}\n${content}`);
			if (editTicketViolation.violated) return violationErrorPage(editTicketViolation);
			await db.prepare('UPDATE tickets SET title = ?, content = ? WHERE id = ?')
				.bind(title, content, id).run();
			return new Response(null, { status: 302, headers: { Location: `/ticket/${id}` } });
		} else {
			if (!user || !user.admin) return jsonRes({ error: '无权限' }, 403);
			const id = parseInt(path.split('/')[3]);
			const assignee_id = parseInt(form.get('assignee_id')) || 0;
			await db.prepare('UPDATE tickets SET assignee_id = ? WHERE id = ?').bind(assignee_id, id).run();
			// 通知指派的处理人
			if (assignee_id > 0 && assignee_id !== user.id) {
				await sendNotification(env, assignee_id, user.id, `您被指派处理工单: ${ticket.title}`, 'ticket_assign', id);
			}
			return new Response(null, { status: 302, headers: { Location: `/ticket/${id}` } });
		}
	}

	if (path.match(/^\/api\/tickets\/\d+\/status$/) && method === 'POST') {
		if (!user || !user.admin) return jsonRes({ error: '无权限' }, 403);
		const parts = path.split('/');
		const id = parseInt(parts[3]);
		const form = await req.formData();
		const status = form.get('status');
		const ticket = await db.prepare('SELECT * FROM tickets WHERE id = ?').bind(id).first();
		if (!ticket) return jsonRes({ error: '工单不存在' });
		await db.prepare('UPDATE tickets SET status = ? WHERE id = ?').bind(status, id).run();
		// 通知工单作者
		if (ticket.author_id !== user.id) {
			await sendNotification(env, ticket.author_id, user.id, `工单 "${ticket.title}" 状态已更新为: ${getTicketStatus(status).label}`, 'ticket_status', id);
		}
		return new Response(null, { status: 302, headers: { Location: `/ticket/${id}` } });
	}

	if (path.match(/^\/api\/tickets\/\d+\/replies$/) && method === 'POST') {
		if (!user) return jsonRes({ error: '未登录' }, 403);
		const parts = path.split('/');
		const id = parseInt(parts[3]);
		const form = await req.formData();
		const content = form.get('content');
		if (!content) return jsonRes({ error: '内容不能为空' });
		const replyViolation = await checkViolation(content);
		if (replyViolation.violated) return violationErrorPage(replyViolation);
		await db.prepare('INSERT INTO ticket_replies (ticket_id, author_id, content) VALUES (?, ?, ?)')
			.bind(id, user.id, content).run();
		// 通知工单作者和指派人
		const ticket = await db.prepare('SELECT * FROM tickets WHERE id = ?').bind(id).first();
		if (ticket) {
			if (ticket.author_id !== user.id) {
				await sendNotification(env, ticket.author_id, user.id, `工单 "${ticket.title}" 有新回复: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`, 'ticket_reply', id);
			}
			if (ticket.assignee_id > 0 && ticket.assignee_id !== user.id && ticket.assignee_id !== ticket.author_id) {
				await sendNotification(env, ticket.assignee_id, user.id, `工单 "${ticket.title}" 有新回复: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`, 'ticket_reply', id);
			}
		}
		return new Response(null, { status: 302, headers: { Location: `/ticket/${id}` } });
	}

	// 后台权限管理
	if (path.match(/^\/api\/admin\/user\/\d+$/) && method === 'POST') {
		if (!user || !user.admin) return jsonRes({ error: '无权限' }, 403);
		const id = parseInt(path.split('/')[4]);
		const form = await req.formData();
		const color = form.get('color') || 'red';
		const tag = form.get('tag') || '';
		const permission = form.get('permission');
		const action = form.get('action');
		const reason = form.get('reason');

		if (!permission || !action || !reason) {
			return jsonRes({ error: '缺少必要参数（权限、操作、原因）' }, 400);
		}

		const targetUser = await db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
		if (!targetUser) return jsonRes({ error: '用户不存在' }, 404);
		if (id === 1 && user.id !== 1) return jsonRes({ error: '不能修改超级管理员' }, 403);

		if (permission === 'use') {
			const newValue = action === 'grant' ? 1 : 0;
			await db.prepare('UPDATE users SET use = ? WHERE id = ?').bind(newValue, id).run();
		} else if (permission === 'speak') {
			const newValue = action === 'grant' ? 1 : 0;
			await db.prepare('UPDATE users SET speak = ? WHERE id = ?').bind(newValue, id).run();
			if (action === 'revoke') {
				await db.prepare('UPDATE users SET violation_count = COALESCE(violation_count, 0) + 1 WHERE id = ?').bind(id).run();
			}
		} else if (permission === 'admin') {
			if (user.id !== 1) return jsonRes({ error: '只有超级管理员可以设置管理员权限' }, 403);
			const newValue = action === 'grant' ? 1 : 0;
			await db.prepare('UPDATE users SET admin = ? WHERE id = ?').bind(newValue, id).run();
			if (newValue === 1) {
				await db.prepare('UPDATE users SET color = ?, tag = ? WHERE id = ?')
					.bind('purple', '管理员', id).run();
			} else {
				await db.prepare('UPDATE users SET color = ?, tag = ? WHERE id = ?')
					.bind('red', '', id).run();
			}
		}

		if (permission !== 'admin') {
			await db.prepare('UPDATE users SET color = ?, tag = ? WHERE id = ?')
				.bind(color, tag, id).run();
		}

		await db.prepare(
			`INSERT INTO permission_logs (target_id, admin_id, action, permission, reason)
       VALUES (?, ?, ?, ?, ?)`
		).bind(id, user.id, action, permission, reason).run();

		// 通知被修改权限的用户
		if (targetUser.id !== user.id) {
			const actionText = action === 'grant' ? '授予' : '撤销';
			await sendNotification(env, targetUser.id, user.id, `您的 "${getPermissionName(permission)}" 权限已被${actionText}，原因: ${reason}`, 'permission_change', 0);
		}

		return new Response(null, { status: 302, headers: { Location: '/backend' } });
	}

	if (path.match(/^\/api\/admin\/user\/\d+\/delete$/) && method === 'POST') {
		if (!user || !user.admin) return jsonRes({ error: '无权限' }, 403);
		const id = parseInt(path.split('/')[4]);
		if (id === 1) return jsonRes({ error: '不能删除超级管理员' });
		// 按依赖顺序清理所有关联数据，避免外键约束错误
		await db.prepare('DELETE FROM comments WHERE article_id IN (SELECT id FROM articles WHERE author_id = ?)').bind(id).run();
		await db.prepare('DELETE FROM comments WHERE author_id = ?').bind(id).run();
		await db.prepare('DELETE FROM articles WHERE author_id = ?').bind(id).run();
		await db.prepare('DELETE FROM ticket_replies WHERE ticket_id IN (SELECT id FROM tickets WHERE author_id = ?)').bind(id).run();
		await db.prepare('DELETE FROM ticket_replies WHERE author_id = ?').bind(id).run();
		await db.prepare('DELETE FROM tickets WHERE author_id = ?').bind(id).run();
		await db.prepare('DELETE FROM benben WHERE author_id = ?').bind(id).run();
		await db.prepare('DELETE FROM messages WHERE from_user_id = ? OR to_user_id = ?').bind(id, id).run();
		await db.prepare('DELETE FROM follows WHERE follower_id = ? OR followee_id = ?').bind(id, id).run();
		await db.prepare('DELETE FROM judgements WHERE target_id = ? OR author_id = ?').bind(id, id).run();
		await db.prepare('DELETE FROM permission_logs WHERE target_id = ? OR admin_id = ?').bind(id, id).run();
		await db.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
		return new Response(null, { status: 302, headers: { Location: '/backend' } });
	}

	if (path.match(/^\/api\/admin\/article\/\d+\/delete$/) && method === 'POST') {
		if (!user || !user.admin) return jsonRes({ error: '无权限' }, 403);
		const id = parseInt(path.split('/')[4]);
		const article = await db.prepare('SELECT * FROM articles WHERE id = ?').bind(id).first();
		if (article && article.author_id !== user.id) {
			await sendNotification(env, article.author_id, user.id, `您的帖子 "${article.title}" 已被管理员删除`, 'article_delete', id);
		}
		await db.prepare('DELETE FROM comments WHERE article_id = ?').bind(id).run();
		await db.prepare('DELETE FROM articles WHERE id = ?').bind(id).run();
		return new Response(null, { status: 302, headers: { Location: '/backend' } });
	}

	if (path.match(/^\/api\/admin\/article\/\d+\/pin$/) && method === 'POST') {
		if (!user || !user.admin) return jsonRes({ error: '无权限' }, 403);
		const id = parseInt(path.split('/')[4]);
		const article = await db.prepare('SELECT is_pinned FROM articles WHERE id = ?').bind(id).first();
		if (!article) return jsonRes({ error: '帖子不存在' });
		const newStatus = article.is_pinned ? 0 : 1;
		await db.prepare('UPDATE articles SET is_pinned = ? WHERE id = ?').bind(newStatus, id).run();
		return new Response(null, { status: 302, headers: { Location: '/backend' } });
	}

	// 后台锁定/解锁帖子
	if (path.match(/^\/api\/admin\/article\/\d+\/lock$/) && method === 'POST') {
		if (!user || !user.admin) return jsonRes({ error: '无权限' }, 403);
		const id = parseInt(path.split('/')[4]);
		const article = await db.prepare('SELECT is_locked FROM articles WHERE id = ?').bind(id).first();
		if (!article) return jsonRes({ error: '帖子不存在' });
		const newStatus = article.is_locked ? 0 : 1;
		await db.prepare('UPDATE articles SET is_locked = ? WHERE id = ?').bind(newStatus, id).run();
		return new Response(null, { status: 302, headers: { Location: '/backend' } });
	}

	// 后台删除工单
	if (path.match(/^\/api\/admin\/ticket\/\d+\/delete$/) && method === 'POST') {
		if (!user || !user.admin) return jsonRes({ error: '无权限' }, 403);
		const id = parseInt(path.split('/')[4]);
		await db.prepare('DELETE FROM ticket_replies WHERE ticket_id = ?').bind(id).run();
		await db.prepare('DELETE FROM tickets WHERE id = ?').bind(id).run();
		return new Response(null, { status: 302, headers: { Location: '/backend' } });
	}

	// 后台添加轮播图
	if (path === '/api/admin/banner/add' && method === 'POST') {
		if (!user || !user.admin) return jsonRes({ error: '无权限' }, 403);
		const form = await req.formData();
		const image_url = form.get('image_url');
		const link_url = form.get('link_url') || '';
		const sort_order = parseInt(form.get('sort_order')) || 0;
		if (!image_url) return jsonRes({ error: '图片URL不能为空' }, 400);
		await db.prepare('INSERT INTO banners (image_url, link_url, sort_order) VALUES (?, ?, ?)')
			.bind(image_url, link_url, sort_order).run();
		return new Response(null, { status: 302, headers: { Location: '/backend' } });
	}

	// 后台删除轮播图
	if (path.match(/^\/api\/admin\/banner\/\d+\/delete$/) && method === 'POST') {
		if (!user || !user.admin) return jsonRes({ error: '无权限' }, 403);
		const id = parseInt(path.split('/')[4]);
		await db.prepare('DELETE FROM banners WHERE id = ?').bind(id).run();
		return new Response(null, { status: 302, headers: { Location: '/backend' } });
	}

	// 私信 API
	if (path === '/api/messages/send' && method === 'POST') {
		if (!user) return jsonRes({ error: '未登录' }, 403);
		if (!user.speak) return jsonRes({ error: '您已被禁言，无法发送私信。如需申诉，请提交工单。' }, 403);
		const body = await req.json();
		const { to_user_id, content } = body;
		if (!to_user_id || !content) return jsonRes({ error: '缺少参数' }, 400);
		if (parseInt(to_user_id) === user.id) return jsonRes({ error: '不能给自己发私信' }, 400);
		const target = await db.prepare('SELECT * FROM users WHERE id = ?').bind(to_user_id).first();
		if (!target) return jsonRes({ error: '用户不存在' }, 404);
		const msgViolation = await checkViolation(content);
		if (msgViolation.violated) {
			return jsonRes({ error: `内容包含违禁词：${msgViolation.words.join('、')}` }, 400);
		}
		await sendNotification(env, to_user_id, user.id, content, 'private', 0);
		return jsonRes({ message: '私信发送成功' });
	}

	// 标记消息已读 API
	if (path === '/api/messages/read' && method === 'POST') {
		if (!user) return jsonRes({ error: '未登录' }, 403);
		const body = await req.json();
		const { message_id } = body;
		if (message_id) {
			await db.prepare('UPDATE messages SET is_read = 1 WHERE id = ? AND to_user_id = ?')
				.bind(message_id, user.id).run();
		} else {
			await db.prepare('UPDATE messages SET is_read = 1 WHERE to_user_id = ? AND is_read = 0')
				.bind(user.id).run();
		}
		return jsonRes({ message: '已标记为已读' });
	}

	// 获取未读消息数量 API
	if (path === '/api/messages/unread' && method === 'GET') {
		if (!user) return jsonRes({ error: '未登录' }, 403);
		const countResult = await db.prepare('SELECT COUNT(*) as cnt FROM messages WHERE to_user_id = ? AND is_read = 0')
			.bind(user.id).first();
		return jsonRes({ unread: countResult ? countResult.cnt : 0 });
	}

	// 获取消息列表 API
	if (path === '/api/messages/list' && method === 'GET') {
		if (!user) return jsonRes({ error: '未登录' }, 403);
		const messages = await db.prepare(
			`SELECT m.*, u.username as from_name, u.color as from_color, u.tag as from_tag
       FROM messages m
       LEFT JOIN users u ON m.from_user_id = u.id
       WHERE m.to_user_id = ?
       ORDER BY m.created_at DESC LIMIT 50`
		).bind(user.id).all();
		return jsonRes({ messages: messages.results });
	}

	// ===== 私信聊天 API =====
	if (path === '/api/user/find' && method === 'GET') {
		if (!user) return jsonRes({ error: '未登录' }, 403);
		const url = new URL(req.url);
		const username = url.searchParams.get('username');
		if (!username) return jsonRes({ error: '缺少用户名参数' }, 400);
		const found = await db.prepare('SELECT id, username FROM users WHERE username = ?').bind(username).first();
		if (!found) return jsonRes({ error: '用户不存在' }, 404);
		return jsonRes({ uid: found.id, username: found.username });
	}
	if (path === '/api/pm/send' && method === 'POST') {
		if (!user) return jsonRes({ error: '未登录' }, 403);
		if (!user.speak) return jsonRes({ error: '您已被禁言，无法发送私信。如需申诉，请提交工单。' }, 403);
		const body = await req.json();
		const toUid = parseInt(body.to_uid);
		const content = (body.content || '').trim();
		if (!toUid || !content) return jsonRes({ error: '缺少参数' }, 400);
		if (toUid === user.id) return jsonRes({ error: '不能给自己发私信' }, 400);
		const target = await db.prepare('SELECT * FROM users WHERE id = ?').bind(toUid).first();
		if (!target) return jsonRes({ error: '用户不存在' }, 404);
		const pmViolation = await checkViolation(content);
		if (pmViolation.violated) {
			return jsonRes({ error: `内容包含违禁词：${pmViolation.words.join('、')}` }, 400);
		}
		await sendPmChatMessage(env, user.id, toUid, content);
		return jsonRes({ message: '发送成功' });
	}
	if (path === '/api/pm/chat' && method === 'GET') {
		if (!user) return jsonRes({ error: '未登录' }, 403);
		const url = new URL(req.url);
		const toUid = parseInt(url.searchParams.get('to_uid'));
		const after = parseInt(url.searchParams.get('after')) || 0;
		if (!toUid) return jsonRes({ error: '缺少 to_uid 参数' }, 400);
		const messages = await db.prepare(`
      SELECT * FROM messages WHERE type = 'pm_chat' AND id > ? AND
      ((from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?))
      ORDER BY id ASC LIMIT 200
    `).bind(after, user.id, toUid, toUid, user.id).all();
		await db.prepare(`UPDATE messages SET is_read = 1 WHERE type = 'pm_chat' AND from_user_id = ? AND to_user_id = ? AND is_read = 0`)
			.bind(toUid, user.id).run();
		return jsonRes({ messages: messages.results });
	}
	return jsonRes({ error: 'API not found' }, 404);
}
