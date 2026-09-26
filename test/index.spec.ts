import {
	env,
	createExecutionContext,
	waitOnExecutionContext,
	SELF,
} from "cloudflare:test";
import { describe, it, expect } from "vitest";
import worker from "../src/index";
import { createSession } from "../src/utils/auth";
import { renderUsernameLink } from "../src/utils/html";
import { buildProblemArticleTitle, buildProblemArticleContent } from "../src/utils/problem";
import { normalizeProfileFields, validateAvatarUrl, validateProfileUrl } from "../src/utils/profile";
import { buildReportAuditText, normalizeReportReason } from "../src/handlers/reports";

// For now, you'll need to do something like this to get a correctly-typed
// `Request` to pass to `worker.fetch()`.
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe("database migrations", () => {
	it("migrates existing profile settings before saving an unchanged bio", async () => {
		await env.DB.prepare(`CREATE TABLE users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			username TEXT UNIQUE,
			password TEXT,
			use INTEGER DEFAULT 1,
			speak INTEGER DEFAULT 1,
			admin INTEGER DEFAULT 0,
			admin_roles TEXT DEFAULT '[]',
			color TEXT DEFAULT 'red',
			tag TEXT DEFAULT '',
			last_active_at TEXT DEFAULT '',
			avatar_url TEXT DEFAULT '',
			bio TEXT DEFAULT '',
			checkin_date TEXT,
			last_fortune TEXT,
			points INTEGER DEFAULT 0,
			server_coin REAL DEFAULT 0,
			server_hardware_score INTEGER DEFAULT 0,
			server_assets TEXT DEFAULT '[]',
			server_cpu TEXT DEFAULT 'E5-2686 v4',
			server_motherboard TEXT DEFAULT 'X99 主板',
			server_ram TEXT DEFAULT '16GB DDR4',
			server_storage TEXT DEFAULT '1TB HDD',
			server_last_collected_at TEXT DEFAULT '',
			server_last_event_date TEXT DEFAULT '',
			egg_endings TEXT DEFAULT '[]',
			egg_locked INTEGER DEFAULT 0,
			sidebar_mode TEXT DEFAULT 'classic',
			created_at TEXT DEFAULT (datetime('now'))
		)`).run();
		await env.DB.prepare('CREATE TABLE site_settings (setting_key TEXT PRIMARY KEY, setting_value TEXT NOT NULL DEFAULT "")').run();
		await env.DB.prepare("INSERT INTO site_settings (setting_key, setting_value) VALUES ('schema_version', '14')").run();
		await env.DB.prepare("INSERT INTO users (id, username, password, admin, admin_roles) VALUES (1, 'migration-test', 'unused', 1, '[\"unassigned\"]')").run();

		const session = await createSession(env, 1);
		const form = new FormData();
		form.set('bio', '');
		form.set('real_name', 'Migration Test');
		form.set('location', 'Beijing');
		form.set('profile_link', 'https://example.com');
		form.set('avatar_url', '');
		form.set('sidebar_mode', 'classic');
		form.set('ui_mode', 'modern');
		form.set('redirect_delay_seconds', '10');
		const ctx = createExecutionContext();
		const response = await worker.fetch(new IncomingRequest('http://example.com/api/user/bio', {
			method: 'POST',
			headers: { Cookie: `uid=${session}` },
			body: form,
		}), env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(302);
		expect(response.headers.get('Location')).toBe('/user/1');
		const user = await env.DB.prepare('SELECT real_name, location, profile_link, ui_mode, redirect_delay_seconds FROM users WHERE id = 1').first<any>();
		expect(user).toEqual({
			real_name: 'Migration Test',
			location: 'Beijing',
			profile_link: 'https://example.com',
			ui_mode: 'modern',
			redirect_delay_seconds: 10,
		});
	});
});

describe("worker routing", () => {
	it("renders the home page as HTML (unit style)", async () => {
		const request = new IncomingRequest("http://example.com/");
		// Create an empty context to pass to `worker.fetch()`.
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		// Wait for all `Promise`s passed to `ctx.waitUntil()` to settle before running test assertions
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toContain("text/html");
		expect(await response.text()).toContain("StarLight");
	});

	it("renders the home page as HTML (integration style)", async () => {
		const response = await SELF.fetch("https://example.com");
		expect(response.status).toBe(200);
		expect(await response.text()).toContain("StarLight");
	});

	it("does not dump the full user list into ordinary pages", async () => {
		const response = await SELF.fetch("https://example.com");
		const html = await response.text();
		expect(html).toContain('"byId":{}');
	});

	it("renders an HTML status page for unknown pages", async () => {
		const response = await SELF.fetch("https://example.com/definitely-not-a-page");
		expect(response.status).toBe(404);
		expect(response.headers.get("Content-Type")).toContain("text/html");
		expect(await response.text()).toContain("页面不存在");
	});

	it("offers a share action on article detail pages", async () => {
		await SELF.fetch("https://example.com/");
		await env.DB.prepare('INSERT INTO articles (hex_id, title, content, author_id) VALUES (?, ?, ?, ?)')
			.bind('article-share-test', 'Share test', 'Article body', 1).run();

		const response = await SELF.fetch("https://example.com/articles/article-share-test");
		expect(response.status).toBe(200);
		const html = await response.text();
		expect(html).toContain('id="shareArticleButton"');
		expect(html).toContain("navigator.clipboard.writeText(url)");
		expect(html).toContain("document.execCommand('copy')");
	});

	it("returns 404 JSON for unknown API paths", async () => {
		const response = await SELF.fetch("https://example.com/api/nope");
		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({ error: "API not found" });
	});

	it("renders an HTML status page for direct API navigation", async () => {
		const response = await SELF.fetch("https://example.com/api/nope", {
			headers: { Accept: "text/html" },
		});
		expect(response.status).toBe(404);
		expect(response.headers.get("Content-Type")).toContain("text/html");
		expect(await response.text()).toContain("请求失败");
	});

	it("exposes team creation and isolated team APIs", async () => {
		const page = await SELF.fetch("https://example.com/team/new");
		expect(page.status).toBe(200);
		expect(await page.text()).toContain("创建团队");
		const teams = await SELF.fetch("https://example.com/api/teams");
		expect(teams.status).toBe(200);
		expect(await teams.json()).toEqual([]);
	});

	it("renders the OJ problem list and exposes it in the sidebar", async () => {
		const response = await SELF.fetch("https://example.com/oj");
		expect(response.status).toBe(200);
		const html = await response.text();
		expect(html).toContain("OJ 评测");
		expect(html).toContain('href="/oj"');
		expect(html).toContain("/api/oj/problems");
		expect(html).toContain("MathJax");
	});

	it("renders an OJ problem page shell", async () => {
		const response = await SELF.fetch("https://example.com/oj/1001");
		expect(response.status).toBe(200);
		const html = await response.text();
		expect(html).toContain("题目 1001");
		expect(html).toContain("/api/oj/problem?pid=");
		expect(html).toContain("提交评测");
		expect(html).toContain("monaco-editor@0.52.2");
		expect(html).toContain("Monaco Editor");
		expect(html).toContain("window.location.href = '/oj/submission/'");
	});

	it("renders an OJ submission detail page shell", async () => {
		const response = await SELF.fetch("https://example.com/oj/submission/123");
		expect(response.status).toBe(200);
		const html = await response.text();
		expect(html).toContain("提交详情");
		expect(html).toContain("提交 #123");
		expect(html).toContain("/api/oj/submission?sid=");
		expect(html).toContain("测试点详情");
	});

	it("renders the top-50 points leaderboard in the sidebar", async () => {
		const response = await SELF.fetch("https://example.com/leaderboard");
		expect(response.status).toBe(200);
		const html = await response.text();
		expect(html).toContain("积分榜");
		expect(html).toContain("全服积分排名");
		expect(html).toContain("leaderboard-table");
		expect(html).toContain("前 10%");
		expect(html).toContain('href="/leaderboard"');
	});

	it("marks username links for global points-rank badges", async () => {
		const response = await SELF.fetch("https://example.com/admin-list");
		expect(response.status).toBe(200);
		const html = await response.text();
		expect(html).toContain('class="username-link"');
		expect(html).toContain("data-user-id=");
		expect(html).toContain("/api/leaderboard/badge?uid=");
	});

	it("renders the independent achievements page and sidebar entry", async () => {
		const response = await SELF.fetch("https://example.com/achievements");
		expect(response.status).toBe(200);
		const html = await response.text();
		expect(html).toContain("成就系统");
		expect(html).toContain("欢迎来到 StarLight");
		expect(html).toContain("帖子大佬 I");
		expect(html).toContain("初次创作");
		expect(html).toContain("社区明星");
		expect(html).toContain("积分达人");
		expect(html).toContain('href="/achievements"');
		expect(html).toContain("前置：");
		expect(html).toContain("achievement-tree");
		expect(html).toContain("achievement-children");
		expect(html).toContain("achievement-card is-root");
	});

	it("renders the redemption and pet game pages", async () => {
		const redeem = await SELF.fetch("https://example.com/redeem");
		const game = await SELF.fetch("https://example.com/game");
		expect(redeem.status).toBe(200);
		expect(game.status).toBe(200);
		expect(await redeem.text()).toContain("积分兑换码");
		expect(await game.text()).toContain("星光牧场");
	});

	it("renders the site search page and sidebar entry", async () => {
		const response = await SELF.fetch("https://example.com/search?q=star");
		expect(response.status).toBe(200);
		const html = await response.text();
		expect(html).toContain("全站搜索");
		expect(html).toContain('action="/search"');
		expect(html).toContain('href="/search"');
	});

	it("does not leak internal error details", async () => {
		const request = new IncomingRequest("http://example.com/");
		const brokenEnv = { ...env, DB: undefined } as unknown as typeof env;
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, brokenEnv, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(500);
		expect(response.headers.get("Content-Type")).toContain("text/html");
		expect(await response.text()).toContain("页面出错了");
	});
});

describe("user tag rendering", () => {
	it("keeps rainbow tags visible", () => {
		const html = renderUsernameLink("Alice", "rainbow", "admin", 42);
		expect(html).toContain("background:linear-gradient");
		expect(html).toContain("-webkit-text-fill-color:#fff");
		expect(html).toContain("admin");
	});
});

describe("problem article formatting", () => {
	it("adds the problem prefix and jump link", () => {
		expect(buildProblemArticleTitle("if you WA on #3", { id: "1001", title: "A+B Problem" })).toBe("[1001 A+B Problem] if you WA on #3");
		const content = buildProblemArticleContent("Original content", "1001");
		expect(content).toContain("Original content");
		expect(content).toContain("https://oj.lin114514.top/1001");
	});
});

describe("profile field normalization", () => {
	it("trims and validates personal profile fields", () => {
		const fields = normalizeProfileFields({
			bio: "  hello world  ",
			avatar_url: "https://example.com/avatar.png",
			location: "  Beijing  ",
			profile_link: "https://example.com/profile",
		});
		expect(fields.bio).toBe("hello world");
		expect(fields.location).toBe("Beijing");
		expect(fields.avatar_url).toBe("https://example.com/avatar.png");
		expect(validateAvatarUrl("https://example.com/avatar.png")).toBe(true);
		expect(validateAvatarUrl("ftp://example.com/avatar.png")).toBe(false);
		expect(validateProfileUrl("https://example.com/profile")).toBe(true);
		expect(validateProfileUrl("javascript:alert(1)")).toBe(false);
	});
});

describe("report processing metadata", () => {
	it("accepts free-form user feedback and records admin reasoning traceably", () => {
		const reason = normalizeReportReason("用户发广告，且带诈骗链接，影响社区体验");
		expect(reason).toContain("诈骗链接");
		const auditText = buildReportAuditText({
			reason,
			evidence: "https://example.com/ scam",
			target_type: "user",
			target_id: 42,
		}, "resolved", "已确认违规，删除该用户内容并通知其整改");
		expect(auditText).toContain("用户反馈");
		expect(auditText).toContain("管理员处理理由");
		expect(auditText).toContain("已确认违规");
	});
});

describe("server game management UI", () => {
	it("exposes concrete server operations like Docker and DDoS controls", async () => {
		const response = await SELF.fetch("https://example.com/server");
		expect(response.status).toBe(200);
		const html = await response.text();
		expect(html).toContain("Docker");
		expect(html).toContain("DDoS");
	});

	it("exposes an actual DDoS attack action for opposing servers", async () => {
		const response = await SELF.fetch("https://example.com/server");
		expect(response.status).toBe(200);
		const html = await response.text();
		expect(html).toContain("DDoS 攻击");
	});

	it("shows installed server items, Docker capacity, and categorized shop entries", async () => {
		const response = await SELF.fetch("https://example.com/server");
		expect(response.status).toBe(200);
		const html = await response.text();
		expect(html).toContain("已安装设备");
		expect(html).toContain("Docker 镜像");
		expect(html).toContain("GPU");
		expect(html).toContain("NVIDIA RTX 5090 计算卡");
		expect(html).toContain("网卡");
		expect(html).toContain("事件会在每日首次结算时生效");
		expect(html).toContain("/api/server/collect");
	});
});

describe("health API", () => {
	it("returns service, access, ticket, and content metrics", async () => {
		const response = await SELF.fetch("https://example.com/api/health");
		expect(response.status).toBe(200);
		const data = await response.json() as any;
		expect(data.status).toBe("ok");
		expect(data.service.timezone).toBe("Asia/Shanghai (UTC+8)");
		expect(data.access).toHaveProperty("current_online");
		expect(data.tickets).toHaveProperty("new_today");
		expect(data.content).toHaveProperty("reports_today");
		expect(data.period.date_china).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});

	it("rejects non-GET requests", async () => {
		const response = await SELF.fetch("https://example.com/api/health", { method: "POST" });
		expect(response.status).toBe(405);
	});
});

describe("Unknown easter egg API", () => {
	it("requires login for status and reward claims", async () => {
		const status = await SELF.fetch("https://example.com/api/egg/status");
		expect(status.status).toBe(403);
		const claim = await SELF.fetch("https://example.com/api/egg/claim", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ ending: "E1", choices: [0, 0, 0] }),
		});
		expect(claim.status).toBe(403);
	});

});

describe("administrator list", () => {
	it("renders the public administrator list route", async () => {
		const response = await SELF.fetch("https://example.com/admin-list");
		expect(response.status).toBe(200);
		const html = await response.text();
		expect(html).toContain("管理员列表");
		expect(html).toContain("未分配管理");
		expect(html).toContain("/admin-list");
	});

});

describe("public health page", () => {
	it("renders community service metrics", async () => {
		const response = await SELF.fetch("https://example.com/health");
		expect(response.status).toBe(200);
		const html = await response.text();
		expect(html).toContain("服务脉搏");
		expect(html).toContain("当前在线");
		expect(html).toContain("新工单");
		expect(html).toContain("/api/health");
	});
});

describe("hover sidebar rendering", () => {
	it("includes collapsed icon and text hooks", async () => {
		const response = await SELF.fetch("https://example.com/");
		expect(response.status).toBe(200);
		const html = await response.text();
		expect(html).toContain("class=\"nav-text\"");
		expect(html).toContain("sidebar-hover-mode:not(:hover)");
		expect(html).toContain(".user-section > form");
	});
});
