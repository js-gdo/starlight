import {
	env as cloudflareEnv,
	createExecutionContext,
	waitOnExecutionContext,
	SELF,
} from "cloudflare:test";
import { describe, it, expect, vi } from "vitest";
import worker from "../src/index";
import { createSession } from "../src/utils/auth";
import { renderUsernameLink } from "../src/utils/html";
import { getPointsRankBadgeLevel } from "../src/utils/constants";
import { buildProblemArticleTitle, buildProblemArticleContent, filterVisibleOjProblems, isHiddenOjProblemId } from "../src/utils/problem";
import { normalizeProfileFields, validateAvatarUrl, validateProfileUrl, validateBackgroundUrl, normalizeBackgroundMode } from "../src/utils/profile";
import { buildReportAuditText, normalizeReportReason } from "../src/handlers/reports";
import { formatChinaDateTime, parseChinaDateTime, parseSitePopupConfig } from "../src/utils/sitePopup";
import { createInviteCode } from "../src/utils/invite";
import { sha256 } from "../src/utils/crypto";
import { hasAdminPermission, normalizeAdminPermissions } from '../src/utils/adminPermissions';
import type { Env as WorkerEnv } from '../src/env.d';

// For now, you'll need to do something like this to get a correctly-typed
// `Request` to pass to `worker.fetch()`.
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;
const env = cloudflareEnv as unknown as WorkerEnv;

describe("points rank username badges", () => {
	it("assigns the first 10%, next 20%, and next 30% of 100 users", () => {
		expect(getPointsRankBadgeLevel(1, 100)).toBe("gold");
		expect(getPointsRankBadgeLevel(10, 100)).toBe("gold");
		expect(getPointsRankBadgeLevel(11, 100)).toBe("blue");
		expect(getPointsRankBadgeLevel(30, 100)).toBe("blue");
		expect(getPointsRankBadgeLevel(31, 100)).toBe("green");
		expect(getPointsRankBadgeLevel(60, 100)).toBe("green");
		expect(getPointsRankBadgeLevel(61, 100)).toBeNull();
	});

	it("does not render a fixed UID-based badge in username links", () => {
		const html = renderUsernameLink("ranked-user", "purple", "", 42);
		expect(html).toContain('data-user-id="42"');
		expect(html).not.toContain("<svg");
	});
});

describe("site popup settings", () => {
	it("parses and formats scheduled times in China Standard Time", () => {
		const timestamp = parseChinaDateTime("2026-10-05T18:21");
		expect(timestamp).toBe(Date.parse("2026-10-05T10:21:00Z"));
		expect(formatChinaDateTime(timestamp)).toBe("2026-10-05T18:21");
		expect(parseChinaDateTime("2026-02-30T12:00")).toBeNull();
	});

	it("normalizes popup settings and selected user IDs", () => {
		const popup = parseSitePopupConfig(JSON.stringify({
			enabled: true,
			revision: 123,
			targetMode: "selected",
			userIds: [2, "2", -1, "invalid"],
			title: "提示",
			message: "消息",
			startsAt: 1000,
			endsAt: null,
			durationSeconds: 60,
		}));
		expect(popup).toEqual({
			enabled: true,
			revision: 123,
			targetMode: "selected",
			userIds: [2],
			title: "提示",
			message: "消息",
			startsAt: 1000,
			endsAt: null,
			durationSeconds: 60,
		});
	});
});

describe("site popup administration and delivery", () => {
	it("saves a targeted popup and includes it only for its selected user", async () => {
		await SELF.fetch("https://example.com/");
		const username = `popup${Date.now().toString().slice(-8)}`;
		const inserted = await env.DB.prepare(
			'INSERT INTO users (username, password, points) VALUES (?, ?, 0)'
		).bind(username, 'unused').run();
		const targetId = Number(inserted.meta.last_row_id);
		const adminSession = await createSession(env, 1);
		const form = new FormData();
		form.set('enabled', '1');
		form.set('title', '维护提示');
		form.set('message', '站点将在今晚维护');
		form.set('target_mode', 'selected');
		form.append('popup_user_id', String(targetId));
		form.set('duration_seconds', '30');
		const save = await worker.fetch(new IncomingRequest('http://example.com/api/admin/site-popup', {
			method: 'POST',
			headers: { Cookie: `uid=${adminSession}` },
			body: form,
		}), env, createExecutionContext());

		expect(save.status).toBe(302);
		expect(save.headers.get('Location')).toBe('/backend/site');
		const stored = await env.DB.prepare(
			"SELECT setting_value FROM site_settings WHERE setting_key = 'site_popup'"
		).first<any>();
		expect(JSON.parse(stored.setting_value)).toMatchObject({
			enabled: true,
			targetMode: 'selected',
			userIds: [targetId],
			title: '维护提示',
			message: '站点将在今晚维护',
			startsAt: null,
			endsAt: null,
			durationSeconds: 30,
		});

		const targetSession = await createSession(env, targetId);
		const targetHome = await worker.fetch(new IncomingRequest('http://example.com/', {
			headers: { Cookie: `uid=${targetSession}` },
		}), env, createExecutionContext());
		const targetHtml = await targetHome.text();
		expect(targetHtml).toContain('window.__sitePopup =');
		expect(targetHtml).toContain('维护提示');
		expect(targetHtml).toContain('不再此设备显示');

		const otherHome = await worker.fetch(new IncomingRequest('http://example.com/'), env, createExecutionContext());
		expect(await otherHome.text()).toContain('window.__sitePopup = null');
	});
});

describe("user invitations and referral rewards", () => {
	it("derives a four-character code from the first and last two SHA-256 characters", async () => {
		const digest = await sha256("invite-code-test");
		expect(await createInviteCode("invite-code-test")).toBe(`${digest.slice(0, 2)}${digest.slice(-2)}`);
	});

	it("blocks inviter IP reuse, awards registration points, and rewards each invitee check-in once", async () => {
		await SELF.fetch("https://example.com/");
		const inviterName = `inviter${Date.now().toString().slice(-8)}`;
		const inviterCode = await createInviteCode(inviterName);
		const registerPage = await worker.fetch(new IncomingRequest(`http://example.com/register?invite=${inviterCode}`), env, createExecutionContext());
		const registerHtml = await registerPage.text();
		expect(registerHtml).toContain('label>邀请码（可空）</label>');
		expect(registerHtml).toContain(`value="${inviterCode}"`);
		const inviterInsert = await env.DB.prepare(
			'INSERT INTO users (username, password, invite_code, registered_ip, points) VALUES (?, ?, ?, ?, 0)'
		).bind(inviterName, 'unused', inviterCode, '198.51.100.12').run();
		const inviterId = Number(inviterInsert.meta.last_row_id);
		const fetchMock = vi.fn(async () => new Response(JSON.stringify({ code: 200, data: { is_violated: false } }), {
			headers: { 'Content-Type': 'application/json' },
		}));
		vi.stubGlobal('fetch', fetchMock);
		try {
			const sameIp = await worker.fetch(new IncomingRequest('http://example.com/api/register', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '198.51.100.12' },
				body: JSON.stringify({ username: `sameip${Date.now().toString().slice(-6)}`, password: 'password123', inviteCode: inviterCode }),
			}), env, createExecutionContext());
			expect(sameIp.status).toBe(400);
			expect(await sameIp.json()).toMatchObject({ error: expect.stringContaining('请删除邀请码') });

			const noCode = await worker.fetch(new IncomingRequest('http://example.com/api/register', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '198.51.100.12' },
				body: JSON.stringify({ username: `nocode${Date.now().toString().slice(-6)}`, password: 'password123', inviteCode: '' }),
			}), env, createExecutionContext());
			expect(noCode.status).toBe(201);
			expect(await noCode.json()).toMatchObject({ invited: false, pointsAwarded: 0 });

			const invitedName = `invited${Date.now().toString().slice(-8)}`;
			const registration = await worker.fetch(new IncomingRequest('http://example.com/api/register', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.77' },
				body: JSON.stringify({ username: invitedName, password: 'password123', inviteCode: inviterCode }),
			}), env, createExecutionContext());
			expect(registration.status).toBe(201);
			expect(await registration.json()).toMatchObject({ invited: true, pointsAwarded: 30 });
			const invited = await env.DB.prepare('SELECT id, points, invite_code, registered_ip FROM users WHERE username = ?')
				.bind(invitedName).first<any>();
			expect(invited.points).toBe(30);
			expect(invited.invite_code).toBe(await createInviteCode(invitedName));
			expect(invited.registered_ip).toBe('203.0.113.77');
			expect((await env.DB.prepare('SELECT points FROM users WHERE id = ?').bind(inviterId).first<any>()).points).toBe(50);

			const inviteeSession = await createSession(env, invited.id);
			const invitePage = await worker.fetch(new IncomingRequest('http://example.com/invite', {
				headers: { Cookie: `uid=${inviteeSession}` },
			}), env, createExecutionContext());
			const inviteHtml = await invitePage.text();
			expect(invitePage.status).toBe(200);
			expect(inviteHtml).toContain(await createInviteCode(invitedName));
			expect(inviteHtml).toContain('复制邀请链接');

			const firstCheckin = await worker.fetch(new IncomingRequest('http://example.com/api/checkin', {
				method: 'POST',
				headers: { Cookie: `uid=${inviteeSession}` },
			}), env, createExecutionContext());
			expect(firstCheckin.status).toBe(200);
			expect((await firstCheckin.json<{ points: number }>()).points).toBe(10);
			expect((await env.DB.prepare('SELECT points FROM users WHERE id = ?').bind(inviterId).first<any>()).points).toBe(51);

			const duplicateCheckin = await worker.fetch(new IncomingRequest('http://example.com/api/checkin', {
				method: 'POST',
				headers: { Cookie: `uid=${inviteeSession}` },
			}), env, createExecutionContext());
			expect((await duplicateCheckin.json<{ checked: boolean }>()).checked).toBe(true);
			expect((await env.DB.prepare('SELECT points FROM users WHERE id = ?').bind(inviterId).first<any>()).points).toBe(51);
		} finally {
			vi.unstubAllGlobals();
		}
	});
});

describe("worker routing", () => {
	it("returns a clickable user SVG with avatar, tag, rank hook, and achievement badge", async () => {
		await SELF.fetch("https://example.com/");
		const userInsert = await env.DB.prepare(
			'INSERT INTO users (username, password, color, tag, avatar_url, points) VALUES (?, ?, ?, ?, ?, ?)'
		).bind('svg-user<&', 'unused', 'rainbow', 'Star<&', 'https://example.com/avatar.png', 1000000).run();
		const uid = Number(userInsert.meta.last_row_id);
		const response = await worker.fetch(new IncomingRequest(`http://example.com/api/usersvg?uid=${uid}`, {
			headers: { Accept: "text/html" },
		}), env, createExecutionContext());
		const svg = await response.text();

		expect(response.status).toBe(200);
		expect(response.headers.get('Content-Type')).toContain('image/svg+xml');
		expect(svg).toContain(`<a href="/user/${uid}" target="_top"`);
		expect(svg).toContain('href="https://example.com/avatar.png"');
		expect(svg).toContain('svg-user&lt;&amp;');
		expect(svg).toContain('Star&lt;&amp;');
		expect(svg).toContain('id="username-gradient"');
		expect(svg).toContain('<title>gold rank</title>');
		expect(svg).toContain('>★</text>');
		expect(svg).not.toContain('<script');
	});

	it("returns JSON errors for invalid or missing usersvg UIDs", async () => {
		for (const url of [
			'http://example.com/api/usersvg',
			'http://example.com/api/usersvg?uid=0',
			'http://example.com/api/usersvg?uid=abc',
			'http://example.com/api/usersvg?uid=12%0A',
		]) {
			const response = await worker.fetch(new IncomingRequest(url), env, createExecutionContext());
			expect(response.status).toBe(400);
			expect(response.headers.get('Content-Type')).toContain('application/json');
			expect(await response.json()).toEqual({ error: 'Invalid user ID' });
		}
	});

	it("returns raw JSON for API requests that accept HTML", async () => {
		const response = await worker.fetch(new IncomingRequest("http://example.com/api/leaderboard/badge", {
			headers: { Accept: "text/html" },
		}), env, createExecutionContext());
		const contentType = response.headers.get("Content-Type");

		expect(response.status).toBe(400);
		expect(contentType).toContain("application/json");
		expect(contentType).not.toContain("text/html");
		expect(await response.json()).toEqual({ error: "Invalid user ID" });
	});

	it("returns JSON for unknown API routes that accept HTML", async () => {
		const response = await worker.fetch(new IncomingRequest("http://example.com/api/not-a-route", {
			headers: { Accept: "text/html" },
		}), env, createExecutionContext());
		const contentType = response.headers.get("Content-Type");

		expect(response.status).toBe(404);
		expect(contentType).toContain("application/json");
		expect(contentType).not.toContain("text/html");
		expect(await response.json()).toEqual({ error: "API not found" });
	});

	it("hides OJ problem IDs starting with 6 or 5 followed by an even digit", () => {
		for (const id of ["6", "6001", "50", "52", "54", "56", "58", "5201"]) {
			expect(isHiddenOjProblemId(id)).toBe(true);
		}
		for (const id of ["5", "51", "53", "55", "57", "59", "1001"]) {
			expect(isHiddenOjProblemId(id)).toBe(false);
		}
	});

	it("filters hidden IDs out of the public problem list", () => {
		const visible = filterVisibleOjProblems([
			{ id: "1001" }, { id: "5201" }, { id: "5101" }, { id: "6001" }, { id: "1002" },
		]);
		expect(visible.map((problem) => problem.id)).toEqual(["1001", "5101", "1002"]);
	});

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

	it("marks OJ statements for Markdown rendering", async () => {
		const response = await worker.fetch(
			new IncomingRequest("http://example.com/oj/markdown-test"),
			env,
			createExecutionContext(),
		);
		const html = await response.text();

		expect(response.status).toBe(200);
		expect(html).toContain('id="ojProblemStatement" class="markdown-body markdown-content"');
	});

	it("renders the home page as HTML (integration style)", async () => {
		const response = await SELF.fetch("https://example.com");
		expect(response.status).toBe(200);
		expect(await response.text()).toContain("StarLight");
	});

	it("groups secondary sidebar links under 其他 while retaining primary navigation", async () => {
		const response = await SELF.fetch("https://example.com");
		const html = await response.text();
		const groupStart = html.indexOf('<details class="sidebar-more"');
		const groupEnd = html.indexOf('</details>', groupStart);
		expect(groupStart).toBeGreaterThanOrEqual(0);
		expect(groupEnd).toBeGreaterThan(groupStart);
		const otherLinks = html.slice(groupStart, groupEnd);
		expect(otherLinks).toContain('其他');
		expect(otherLinks).toContain('href="/server"');
		expect(otherLinks).toContain('href="/health"');
		expect(otherLinks).not.toContain('href="/articles/list"');
		expect(html).toContain('href="/articles/list"');
		expect(html).toContain('href="/messages"');
	});

	it("renders the redesigned D1 archive interface for signed-in users", async () => {
		const session = await createSession(env, 1);
		const response = await worker.fetch(new IncomingRequest("http://example.com/", {
			headers: { Cookie: `uid=${session}` },
		}), env, createExecutionContext());
		const html = await response.text();
		expect(response.status).toBe(200);
		expect(html).toContain('role="dialog" aria-modal="true" aria-label="D1 私密档案"');
		expect(html).toContain('class="unknown-egg-layout"');
		expect(html).toContain('SYSTEM DIAGNOSTICS');
		expect(html).toContain('RECOVERED CLUES');
		expect(html).toContain('EVENT LOG');
		expect(html).toContain("prefers-reduced-motion: reduce");
	});

	it("does not block the initial page with optional CDN assets", async () => {
		const response = await worker.fetch(new IncomingRequest("http://example.com/"), env, createExecutionContext());
		const html = await response.text();
		expect(html).toContain('rel="preload" as="style"');
		expect(html).toContain('id="hitokoto-sentence"');
		expect(html).toContain('function loadScript(src)');
		expect(html).not.toMatch(/<script[^>]+src="https:\/\/cdn\.jsdelivr\.net\/npm\/mathjax/);
		expect(html).not.toMatch(/<script[^>]+src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/(?:marked|dompurify)/);
	});

	it("keeps route-specific styles available to SPA navigation", async () => {
		const response = await worker.fetch(new IncomingRequest('http://example.com/achievements', {
			headers: { 'X-Starlight-SPA': '1' },
		}), env, createExecutionContext());
		const html = await response.text();
		expect(response.status).toBe(200);
		expect(html).toContain('<style id="spa-page-styles" data-spa-route-style="true">');
		expect(html).toContain('.achievement-tree');
		expect(html).toContain("querySelectorAll('style[data-spa-route-style]')");
		expect(html).toContain('document.head.querySelectorAll(\'style[data-spa-route-style]\')');
	});

	it("shows the operations dashboard for admins", async () => {
		const session = await createSession(env, 1);
		const response = await worker.fetch(new IncomingRequest('http://example.com/backend', {
			headers: { Cookie: `uid=${session}` },
		}), env, createExecutionContext());
		expect(response.status).toBe(200);
		const html = await response.text();
		expect(html).toContain('运营仪表盘');
		expect(html).toContain('站点概况');
		expect(html).toContain('href="/backend/user"');
		expect(html).not.toContain('data-admin-panel');

		const userPage = await worker.fetch(new IncomingRequest('http://example.com/backend/user', {
			headers: { Cookie: `uid=${session}` },
		}), env, createExecutionContext());
		expect(userPage.status).toBe(200);
		expect(await userPage.text()).toContain('账号目录');
	});

	it("limits console sections and admin mutations to assigned permission nodes", async () => {
		const username = `limited-admin-${Date.now()}`;
		const insert = await env.DB.prepare('INSERT INTO users (username, password, admin, admin_permissions) VALUES (?, ?, 1, ?)')
			.bind(username, 'unused', JSON.stringify(['admin.users.view'])).run();
		const adminId = Number(insert.meta.last_row_id);
		const session = await createSession(env, adminId);
		const headers = { Cookie: `uid=${session}` };

		const userPage = await worker.fetch(new IncomingRequest('http://example.com/backend/user', { headers }), env, createExecutionContext());
		expect(userPage.status).toBe(200);
		expect(await userPage.text()).toContain('账号目录');

		const sitePage = await worker.fetch(new IncomingRequest('http://example.com/backend/site', { headers }), env, createExecutionContext());
		expect(sitePage.status).toBe(403);

		const form = new FormData();
		form.set('status', 'maintenance');
		const updateSite = await worker.fetch(new IncomingRequest('http://example.com/api/admin/site-status', {
			method: 'POST', headers, body: form,
		}), env, createExecutionContext());
		expect(updateSite.status).toBe(403);
	});

	it("shows login history and revokes older sessions while keeping the current one", async () => {
		const session = await createSession(env, 1);
		await env.DB.prepare('INSERT INTO login_history (user_id, ip_address, user_agent, created_at) VALUES (1, ?, ?, ?)')
			.bind('203.0.113.12', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0', '2026-09-30T10:00:00.000Z').run();

		const settings = await worker.fetch(new IncomingRequest('http://example.com/settings', {
			headers: { Cookie: `uid=${session}` },
		}), env, createExecutionContext());
		const html = await settings.text();
		expect(settings.status).toBe(200);
		expect(html).toContain('退出其他设备');
		expect(html).toContain('203.0.113.12');
		expect(html).toContain('Chrome · Windows');

		const revoke = await worker.fetch(new IncomingRequest('http://example.com/api/user/sessions/revoke-others', {
			method: 'POST',
			headers: { Cookie: `uid=${session}` },
		}), env, createExecutionContext());
		expect(revoke.status).toBe(200);
		const renewedSession = revoke.headers.get('Set-Cookie')?.match(/^uid=([^;]+)/)?.[1];
		expect(renewedSession).toBeTruthy();
		expect(await revoke.json()).toEqual({ ok: true, message: '其他设备已退出登录' });
		const currentSession = await worker.fetch(new IncomingRequest('http://example.com/api/login', {
			headers: { Cookie: `uid=${renewedSession}` },
		}), env, createExecutionContext());
		expect(currentSession.status).toBe(200);

		const oldSession = await worker.fetch(new IncomingRequest('http://example.com/api/login', {
			headers: { Cookie: `uid=${session}` },
		}), env, createExecutionContext());
		expect(oldSession.status).toBe(403);
	});

	it("applies a national-day palette during the holiday window", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-10-01T12:00:00+08:00"));
		try {
			const response = await SELF.fetch("https://example.com");
			const html = await response.text();
			expect(response.status).toBe(200);
			expect(html).toContain("national-day-theme");
			expect(html).toContain("theme-default");
			expect(html).toContain("theme-modern");
		} finally {
			vi.useRealTimers();
		}
	});

		describe('admin permission nodes', () => {
			it('matches exact nodes and terminal wildcards without crossing sibling branches', () => {
				const scopedAdmin = { id: 2, admin: 1, admin_permissions: JSON.stringify(['admin.users.*']) };
				expect(hasAdminPermission(scopedAdmin, 'admin.users.profile.edit')).toBe(true);
				expect(hasAdminPermission(scopedAdmin, 'admin.users')).toBe(false);
				expect(hasAdminPermission(scopedAdmin, 'admin.content.articles.delete')).toBe(false);
				expect(hasAdminPermission({ ...scopedAdmin, admin_permissions: JSON.stringify(['admin.users.view']) }, 'admin.users.profile.edit')).toBe(false);
				expect(normalizeAdminPermissions(['admin.users.*', 'bad node', '*'])).toEqual(['admin.users.*', '*']);
			});
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

	it("downloads administrator exports instead of routing them through SPA", async () => {
		await SELF.fetch("https://example.com/");
		const session = await createSession(env, 1);
		const page = await worker.fetch(new IncomingRequest('http://example.com/backend/site', {
			headers: { Cookie: `uid=${session}` },
		}), env, createExecutionContext());
		const html = await page.text();
		const exportLinks = html.match(/<a\b[^>]*href="\/api\/admin\/export\/[^\"]+"[^>]*>/g) || [];
		expect(exportLinks).toHaveLength(4);
		expect(exportLinks.every((link) => /\sdownload(?:\s|=|>)/.test(link))).toBe(true);

		const response = await worker.fetch(new IncomingRequest('http://example.com/api/admin/export/audit?format=csv', {
			headers: { Cookie: `uid=${session}` },
		}), env, createExecutionContext());
		expect(response.status).toBe(200);
		expect(response.headers.get('Content-Type')).toContain('text/csv');
		expect(response.headers.get('Content-Disposition')).toContain('attachment; filename="starlight-audit.csv"');
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

	it("filters unread notifications and links ticket alerts to their ticket", async () => {
		await SELF.fetch("https://example.com/");
		const session = await createSession(env, 1);
		const ticketResult = await env.DB.prepare(
			"INSERT INTO tickets (title, content, author_id, status) VALUES (?, ?, ?, 'pending')"
		).bind('Notification link test', 'Ticket content', 1).run();
		const ticketId = Number(ticketResult.meta.last_row_id);
		await env.DB.prepare("INSERT INTO users (username, password) VALUES ('notification-sender', 'unused')").run();
		const sender = await env.DB.prepare("SELECT id FROM users WHERE username = 'notification-sender'").first<any>();
		const articleResult = await env.DB.prepare(
			'INSERT INTO articles (hex_id, title, content, author_id) VALUES (?, ?, ?, ?)'
		).bind('notification-article', 'Notification article', 'Article content', 1).run();
		const articleId = Number(articleResult.meta.last_row_id);
		const unreadResult = await env.DB.prepare(
			"INSERT INTO messages (from_user_id, to_user_id, content, type, related_id) VALUES (1, 1, 'Ticket update', 'ticket_status', ?)"
		).bind(ticketId).run();
		const unreadId = Number(unreadResult.meta.last_row_id);
		await env.DB.prepare(
			"INSERT INTO messages (from_user_id, to_user_id, content, type, related_id) VALUES (?, 1, 'New comment', 'comment', ?)"
		).bind(sender.id, articleId).run();
		await env.DB.prepare(
			"INSERT INTO messages (from_user_id, to_user_id, content, type) VALUES (?, 1, 'Private message', 'private')"
		).bind(sender.id).run();
		await env.DB.prepare(
			"INSERT INTO messages (from_user_id, to_user_id, content, type) VALUES (?, 1, 'Permission changed', 'permission_change')"
		).bind(1).run();
		await env.DB.prepare(
			"INSERT INTO messages (from_user_id, to_user_id, content, type, related_id) VALUES (?, 1, 'New report', 'report', 42)"
		).bind(sender.id).run();
		await env.DB.prepare(
			"INSERT INTO messages (from_user_id, to_user_id, content, type, is_read) VALUES (1, 1, 'Old alert', 'permission_change', 1)"
		).run();

		const response = await worker.fetch(new IncomingRequest('http://example.com/messages?unread=1', {
			headers: { Cookie: `uid=${session}` },
		}), env, createExecutionContext());
		const html = await response.text();
		expect(response.status).toBe(200);
		expect(html).toContain('Ticket update');
		expect(html).toContain(`/ticket/${ticketId}`);
		expect(html).toContain('/articles/notification-article#comments');
		expect(html).toContain(`/pm/${sender.id}`);
		expect(html).toContain('href="/settings"');
		expect(html).toContain('href="/backend/security"');
		expect(html).not.toContain('Old alert');
		expect(html).toContain(`openNotification(event, this, ${unreadId})`);
		expect(html).toContain('href="/messages?unread=1"');
		expect(html).toContain('href="/messages"');
		const unread = await env.DB.prepare('SELECT is_read FROM messages WHERE id = ?').bind(unreadId).first<any>();
		expect(unread.is_read).toBe(0);

		const markRead = await worker.fetch(new IncomingRequest('http://example.com/api/messages/read', {
			method: 'POST',
			headers: { Cookie: `uid=${session}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ message_id: unreadId }),
		}), env, createExecutionContext());
		expect(markRead.status).toBe(200);
		const marked = await env.DB.prepare('SELECT is_read FROM messages WHERE id = ?').bind(unreadId).first<any>();
		expect(marked.is_read).toBe(1);
	});

	it("notifies mentioned users and exposes unread mentions to browser notifications", async () => {
		await SELF.fetch("https://example.com/");
		const suffix = crypto.randomUUID().slice(0, 8);
		const authorInsert = await env.DB.prepare(
			'INSERT INTO users (username, password) VALUES (?, ?)'
		).bind(`mention_author_${suffix}`, 'unused').run();
		const targetInsert = await env.DB.prepare(
			'INSERT INTO users (username, password) VALUES (?, ?)'
		).bind(`mention_target_${suffix}`, 'unused').run();
		const authorId = Number(authorInsert.meta.last_row_id);
		const targetId = Number(targetInsert.meta.last_row_id);
		const authorSession = await createSession(env, authorId);
		const targetSession = await createSession(env, targetId);
		const content = `Hello @mention_target_${suffix} `;
		const form = new FormData();
		form.set('title', 'Mention notification test');
		form.set('content', content);
		const createArticle = await worker.fetch(new IncomingRequest('http://example.com/api/articles', {
			method: 'POST',
			headers: { Cookie: `uid=${authorSession}` },
			body: form,
		}), env, createExecutionContext());
		expect(createArticle.status).toBe(302);

		const article = await env.DB.prepare(
			'SELECT id, content FROM articles WHERE author_id = ? AND title = ?'
		).bind(authorId, 'Mention notification test').first<any>();
		expect(article.content).toContain(`/user/${targetId}`);
		const mention = await env.DB.prepare(
			"SELECT id, content FROM messages WHERE to_user_id = ? AND from_user_id = ? AND type = 'mention' ORDER BY id DESC LIMIT 1"
		).bind(targetId, authorId).first<any>();
		expect(mention).not.toBeNull();
		expect(mention.content).toContain(content.trim());

		const initialCursor = await worker.fetch(new IncomingRequest('http://example.com/api/messages/mentions', {
			headers: { Cookie: `uid=${targetSession}` },
		}), env, createExecutionContext());
		expect(await initialCursor.json()).toEqual({ messages: [], latestId: mention.id });

		const newMentions = await worker.fetch(new IncomingRequest('http://example.com/api/messages/mentions?after=0', {
			headers: { Cookie: `uid=${targetSession}` },
		}), env, createExecutionContext());
		const mentionData = await newMentions.json<any>();
		expect(mentionData.messages).toContainEqual(expect.objectContaining({
			id: mention.id,
			title: `mention_author_${suffix}`,
			href: `/messages#notification-${mention.id}`,
		}));

		const targetHome = await worker.fetch(new IncomingRequest('http://example.com/', {
			headers: { Cookie: `uid=${targetSession}` },
		}), env, createExecutionContext());
		const homeHtml = await targetHome.text();
		expect(homeHtml).toContain('id="browser-notifications-toggle"');
		expect(homeHtml).toContain('/api/messages/mentions');
	});

	it("returns 404 JSON for unknown API paths", async () => {
		const response = await SELF.fetch("https://example.com/api/nope");
		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({ error: "API not found" });
	});

	it("keeps unknown API routes as JSON during direct navigation", async () => {
		const response = await SELF.fetch("https://example.com/api/nope", {
			headers: { Accept: "text/html" },
		});
		expect(response.status).toBe(404);
		expect(response.headers.get("Content-Type")).toContain("application/json");
		expect(await response.json()).toEqual({ error: "API not found" });
	});

	it("exposes team creation and isolated team APIs", async () => {
		const page = await SELF.fetch("https://example.com/team/new");
		expect(page.status).toBe(200);
		expect(await page.text()).toContain("创建团队");
		const teams = await SELF.fetch("https://example.com/api/teams");
		expect(teams.status).toBe(200);
		expect(await teams.json()).toEqual([]);
	});

	it("restricts team posts to approved members and supports posting, comments, and likes", async () => {
		await SELF.fetch("https://example.com/");
		const suffix = Date.now().toString().slice(-8);
		const memberResult = await env.DB.prepare(
			'INSERT INTO users (username, password, points) VALUES (?, ?, 0)'
		).bind(`team-member-${suffix}`, 'unused').run();
		const outsiderResult = await env.DB.prepare(
			'INSERT INTO users (username, password, points) VALUES (?, ?, 0)'
		).bind(`team-outsider-${suffix}`, 'unused').run();
		const memberId = Number(memberResult.meta.last_row_id);
		const outsiderId = Number(outsiderResult.meta.last_row_id);
		const teamResult = await env.DB.prepare(
			'INSERT INTO teams (name, slug, owner_id) VALUES (?, ?, ?)'
		).bind(`Private posts ${suffix}`, `private-posts-${suffix}`, memberId).run();
		const teamId = Number(teamResult.meta.last_row_id);
		await env.DB.prepare(
			"INSERT INTO team_members (team_id, user_id, role, status) VALUES (?, ?, 'owner', 'approved')"
		).bind(teamId, memberId).run();
		const memberSession = await createSession(env, memberId);
		const outsiderSession = await createSession(env, outsiderId);
		const requestWorker = (path: string, init?: RequestInit) =>
			worker.fetch(new IncomingRequest(`https://example.com${path}`, init), env, createExecutionContext());
		const outsiderHeaders = { Cookie: `uid=${outsiderSession}` };

		const outsiderPage = await requestWorker(`/team/${teamId}/posts`, { headers: outsiderHeaders });
		expect(outsiderPage.status).toBe(403);
		const outsiderFeed = await requestWorker(`/api/teams/${teamId}/posts`, { headers: outsiderHeaders });
		expect(outsiderFeed.status).toBe(403);

		const postForm = new FormData();
		postForm.set('title', '仅成员可见的帖子');
		postForm.set('content', '这是私密团队内容。');
		const createResponse = await requestWorker(`/api/teams/${teamId}/posts`, {
			method: 'POST',
			headers: { Cookie: `uid=${memberSession}` },
			body: postForm,
		});
		expect(createResponse.status).toBe(302);
		const location = createResponse.headers.get('Location');
		expect(location).toMatch(new RegExp(`^/team/${teamId}/posts/\\d+$`));
		const postId = Number(location?.split('/').at(-1));

		const memberDetail = await requestWorker(location!, { headers: { Cookie: `uid=${memberSession}` } });
		expect(memberDetail.status).toBe(200);
		expect(await memberDetail.text()).toContain('这是私密团队内容。');
		const outsiderDetail = await requestWorker(location!, { headers: outsiderHeaders });
		expect(outsiderDetail.status).toBe(403);
		const publicTeamPage = await requestWorker(`/team/${teamId}`);
		expect(publicTeamPage.status).toBe(200);
		expect(await publicTeamPage.text()).not.toContain('这是私密团队内容。');

		const commentForm = new FormData();
		commentForm.set('content', '团队成员评论');
		const commentResponse = await requestWorker(`/api/teams/${teamId}/posts/${postId}/comments`, {
			method: 'POST',
			headers: { Cookie: `uid=${memberSession}` },
			body: commentForm,
		});
		expect(commentResponse.status).toBe(302);
		const likeResponse = await requestWorker(`/api/teams/${teamId}/posts/${postId}/like`, {
			method: 'POST',
			headers: { Cookie: `uid=${memberSession}` },
		});
		expect(likeResponse.status).toBe(200);
		expect(await likeResponse.json()).toEqual({ liked: true, count: 1 });
		const outsiderLike = await requestWorker(`/api/teams/${teamId}/posts/${postId}/like`, {
			method: 'POST',
			headers: outsiderHeaders,
		});
		expect(outsiderLike.status).toBe(403);
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

	it("renders the redemption and space exploration game pages", async () => {
		const redeem = await SELF.fetch("https://example.com/redeem");
		const game = await SELF.fetch("https://example.com/game");
		expect(redeem.status).toBe(200);
		expect(game.status).toBe(200);
		expect(await redeem.text()).toContain("积分兑换码");
		const gameHtml = await game.text();
		expect(gameHtml).toContain("星际边境");
		expect(gameHtml).not.toContain("星光牧场");
		expect(gameHtml).toContain("星际远征");
		const session = await createSession(env, 1);
		const station = await SELF.fetch(new IncomingRequest("https://example.com/game", {
			headers: { Cookie: `uid=${session}` },
		}));
		const stationHtml = await station.text();
		expect(stationHtml).toContain("空间站设施");
		expect(stationHtml).toContain("科技树");
		expect(stationHtml).toContain("深空远征");
		expect(stationHtml).toContain("/api/game/state");
		expect(stationHtml).toContain("data-expedition-countdown");
		expect(stationHtml).toContain("item.id===Number(countdown.getAttribute('data-expedition-countdown'))");
		expect(stationHtml).not.toContain("heading.textContent.indexOf(item.sector_name)");
	});

	it("supports persistent space station upgrades, research, expeditions, and daily supplies", async () => {
		await SELF.fetch("https://example.com/");
		const username = `space${Date.now().toString().slice(-8)}`;
		const inserted = await env.DB.prepare(
			'INSERT INTO users (username, password, points) VALUES (?, ?, 0)'
		).bind(username, 'unused').run();
		const userId = Number(inserted.meta.last_row_id);
		const session = await createSession(env, userId);
		const headers = { Cookie: `uid=${session}`, 'Content-Type': 'application/json' };
		const requestGame = (path: string, init?: RequestInit) =>
			worker.fetch(new IncomingRequest(`https://example.com${path}`, init), env, createExecutionContext());

		const initialResponse = await requestGame('/api/game/state', { headers });
		expect(initialResponse.status).toBe(200);
		const initial = await initialResponse.json() as { buildings: Array<{ key: string; level: number }>; player: { energy: number }; sectors: Array<{ key: string; unlocked: boolean }> };
		expect(initial.buildings).toHaveLength(5);
		expect(initial.buildings.every(building => building.level === 1)).toBe(true);
		expect(initial.player.energy).toBe(100);
		expect(initial.sectors.find(sector => sector.key === 'orbit')?.unlocked).toBe(true);

		await env.DB.prepare(
			"UPDATE space_game_players SET last_resource_at = datetime('now', '-3 hours'), energy_updated_at = datetime('now', '-30 minutes'), energy = 90 WHERE user_id = ?"
		).bind(userId).run();
		const offlineResponse = await requestGame('/api/game/state', { headers });
		const offline = await offlineResponse.json() as { player: { credits: number; alloy: number; crystal: number; research_points: number; energy: number } };
		expect(offline.player.credits).toBe(initial.player.credits + 105);
		expect(offline.player.alloy).toBe(initial.player.alloy + 72);
		expect(offline.player.crystal).toBe(initial.player.crystal + 15);
		expect(offline.player.research_points).toBe(initial.player.research_points + 6);
		expect(offline.player.energy).toBe(93);

		await env.DB.prepare('UPDATE space_game_players SET credits = 0 WHERE user_id = ?').bind(userId).run();
		const insufficientUpgrade = await requestGame('/api/game/building/upgrade', {
			method: 'POST', headers, body: JSON.stringify({ building: 'credit_works' }),
		});
		expect(insufficientUpgrade.status).toBe(409);
		const unchangedBuilding = await env.DB.prepare(
			"SELECT level FROM space_game_buildings WHERE user_id = ? AND building_key = 'credit_works'"
		).bind(userId).first<{ level: number }>();
		expect(unchangedBuilding?.level).toBe(1);
		await env.DB.prepare('UPDATE space_game_players SET credits = 5000 WHERE user_id = ?').bind(userId).run();

		const upgradeResponse = await requestGame('/api/game/building/upgrade', {
			method: 'POST', headers, body: JSON.stringify({ building: 'credit_works' }),
		});
		expect(upgradeResponse.status).toBe(200);
		const upgraded = await upgradeResponse.json() as { state: { buildings: Array<{ key: string; level: number }> } };
		expect(upgraded.state.buildings.find(building => building.key === 'credit_works')?.level).toBe(2);

		const insufficientResearch = await requestGame('/api/game/research/upgrade', {
			method: 'POST', headers, body: JSON.stringify({ technology: 'industrial' }),
		});
		expect(insufficientResearch.status).toBe(409);
		const unchangedTechnology = await env.DB.prepare(
			"SELECT level FROM space_game_research WHERE user_id = ? AND technology_key = 'industrial'"
		).bind(userId).first<{ level: number }>();
		expect(unchangedTechnology?.level).toBe(0);
		await env.DB.prepare('UPDATE space_game_players SET research_points = 1000, crystal = 1000 WHERE user_id = ?').bind(userId).run();
		const researchResponse = await requestGame('/api/game/research/upgrade', {
			method: 'POST', headers, body: JSON.stringify({ technology: 'industrial' }),
		});
		expect(researchResponse.status).toBe(200);
		const researched = await researchResponse.json() as { state: { technologies: Array<{ key: string; level: number }> } };
		expect(researched.state.technologies.find(technology => technology.key === 'industrial')?.level).toBe(1);

		const launchResponse = await requestGame('/api/game/expedition/launch', {
			method: 'POST', headers, body: JSON.stringify({ sector: 'orbit' }),
		});
		expect(launchResponse.status).toBe(200);
		const expedition = await env.DB.prepare(
			'SELECT id, reward_credits, reward_alloy, reward_crystal, reward_research FROM space_game_expeditions WHERE user_id = ?'
		).bind(userId).first<{ id: number; reward_credits: number; reward_alloy: number; reward_crystal: number; reward_research: number }>();
		expect(expedition).not.toBeNull();
		await env.DB.prepare("UPDATE space_game_expeditions SET ends_at = '2000-01-01T00:00:00.000Z' WHERE id = ?").bind(expedition!.id).run();

		const claimResponse = await requestGame('/api/game/expedition/claim', {
			method: 'POST', headers, body: JSON.stringify({ expedition_id: expedition!.id }),
		});
		expect(claimResponse.status).toBe(200);
		const claimedState = await claimResponse.json() as { state: { expeditions: Array<{ id: number }> } };
		expect(claimedState.state.expeditions).toHaveLength(0);
		const claimAgain = await requestGame('/api/game/expedition/claim', {
			method: 'POST', headers, body: JSON.stringify({ expedition_id: expedition!.id }),
		});
		expect(claimAgain.status).toBe(409);
		const afterClaim = await env.DB.prepare('SELECT status FROM space_game_expeditions WHERE id = ?').bind(expedition!.id).first<{ status: string }>();
		expect(afterClaim?.status).toBe('claimed');

		const secondLaunch = await requestGame('/api/game/expedition/launch', {
			method: 'POST', headers, body: JSON.stringify({ sector: 'orbit' }),
		});
		expect(secondLaunch.status).toBe(200);
		const secondLaunchState = await secondLaunch.json() as { state: { expeditions: Array<{ id: number; status: string }> } };
		expect(secondLaunchState.state.expeditions).toHaveLength(1);
		expect(secondLaunchState.state.expeditions[0].id).not.toBe(expedition!.id);
		expect(secondLaunchState.state.expeditions[0].status).toBe('active');

		const dailyResponse = await requestGame('/api/game/daily/claim', { method: 'POST', headers });
		expect(dailyResponse.status).toBe(200);
		const secondDaily = await requestGame('/api/game/daily/claim', { method: 'POST', headers });
		expect(secondDaily.status).toBe(409);
		const leaderboard = await requestGame('/api/game/leaderboard', { headers });
		expect(leaderboard.status).toBe(200);
		expect(await leaderboard.text()).toContain(username);
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
		expect(validateBackgroundUrl('https://images.example.com/background.webp')).toBe(true);
		expect(validateBackgroundUrl('javascript:alert(1)')).toBe(false);
		expect(validateBackgroundUrl('https://user:pass@example.com/background.png')).toBe(false);
		expect(normalizeBackgroundMode('tile')).toBe('tile');
		expect(normalizeBackgroundMode('stretch')).toBe('stretch');
		expect(normalizeBackgroundMode('unexpected')).toBe('cover');
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

describe("community essentials", () => {
	it("supports article bookmarks, following feeds, and paginated article lists", async () => {
		await SELF.fetch("https://example.com/");
		const suffix = crypto.randomUUID().slice(0, 8);
		const viewerInsert = await env.DB.prepare(
			'INSERT INTO users (username, password) VALUES (?, ?)'
		).bind(`essentials_viewer_${suffix}`, 'unused').run();
		const authorInsert = await env.DB.prepare(
			'INSERT INTO users (username, password) VALUES (?, ?)'
		).bind(`essentials_author_${suffix}`, 'unused').run();
		const viewerId = Number(viewerInsert.meta.last_row_id);
		const authorId = Number(authorInsert.meta.last_row_id);
		const session = await createSession(env, viewerId);
		const articleIds: number[] = [];
		for (let index = 0; index < 21; index += 1) {
			const result = await env.DB.prepare(
				'INSERT INTO articles (hex_id, title, content, author_id, created_at) VALUES (?, ?, ?, ?, ?)'
			).bind(
				`${suffix}${String(index).padStart(8, '0')}`,
				`Essentials pagination ${suffix} ${index}`,
				'content',
				authorId,
				new Date(Date.UTC(2030, 0, 1, 0, 0, index)).toISOString(),
			).run();
			articleIds.push(Number(result.meta.last_row_id));
		}

		const bookmark = await worker.fetch(new IncomingRequest(`http://example.com/api/articles/${articleIds[0]}/bookmark`, {
			method: 'POST',
			headers: { Cookie: `uid=${session}` },
		}), env, createExecutionContext());
		expect(bookmark.status).toBe(200);
		expect(await bookmark.json()).toEqual({ bookmarked: true });

		const savedList = await worker.fetch(new IncomingRequest('http://example.com/articles/list?type=saved', {
			headers: { Cookie: `uid=${session}` },
		}), env, createExecutionContext());
		expect(await savedList.text()).toContain(`Essentials pagination ${suffix} 0`);

		await env.DB.prepare('INSERT INTO follows (follower_id, followee_id) VALUES (?, ?)')
			.bind(viewerId, authorId).run();
		const followingList = await worker.fetch(new IncomingRequest('http://example.com/articles/list?type=following', {
			headers: { Cookie: `uid=${session}` },
		}), env, createExecutionContext());
		expect(await followingList.text()).toContain(`Essentials pagination ${suffix}`);

		const firstPage = await worker.fetch(new IncomingRequest('http://example.com/articles/list?type=following&page=1', {
			headers: { Cookie: `uid=${session}` },
		}), env, createExecutionContext());
		const firstHtml = await firstPage.text();
		expect(firstHtml).toContain('第 1 / 2 页');
		expect(firstHtml).not.toContain(`Essentials pagination ${suffix} 0`);
		const secondPage = await worker.fetch(new IncomingRequest('http://example.com/articles/list?type=following&page=2', {
			headers: { Cookie: `uid=${session}` },
		}), env, createExecutionContext());
		expect(await secondPage.text()).toContain(`Essentials pagination ${suffix} 0`);

		const unbookmark = await worker.fetch(new IncomingRequest(`http://example.com/api/articles/${articleIds[0]}/bookmark`, {
			method: 'POST',
			headers: { Cookie: `uid=${session}` },
		}), env, createExecutionContext());
		expect(await unbookmark.json()).toEqual({ bookmarked: false });
	});

	it("exports only the authenticated user's account data as a private download", async () => {
		await SELF.fetch("https://example.com/");
		const suffix = crypto.randomUUID().slice(0, 8);
		const inserted = await env.DB.prepare(
			'INSERT INTO users (username, password, bio) VALUES (?, ?, ?)'
		).bind(`export_user_${suffix}`, 'must-not-export-this-password', 'export bio').run();
		const userId = Number(inserted.meta.last_row_id);
		const session = await createSession(env, userId);
		const denied = await worker.fetch(new IncomingRequest('http://example.com/api/user/export'), env, createExecutionContext());
		expect(denied.status).toBe(403);

		const response = await worker.fetch(new IncomingRequest('http://example.com/api/user/export', {
			headers: { Cookie: `uid=${session}` },
		}), env, createExecutionContext());
		expect(response.status).toBe(200);
		expect(response.headers.get('Content-Disposition')).toContain(`starlight-user-data-${userId}.json`);
		expect(response.headers.get('Cache-Control')).toBe('private, no-store');
		const body = await response.text();
		expect(body).toContain(`export_user_${suffix}`);
		expect(body).toContain('export bio');
		expect(body).not.toContain('must-not-export-this-password');
		expect(body).not.toContain('session_version');
	});
});
