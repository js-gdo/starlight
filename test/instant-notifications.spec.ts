import {
	createExecutionContext,
	env as cloudflareEnv,
	SELF,
} from "cloudflare:test";
import { describe, expect, it } from "vitest";
import worker from "../src/index";
import { createSession } from "../src/utils/auth";
import type { Env as WorkerEnv } from "../src/env.d";

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;
const env = cloudflareEnv as unknown as WorkerEnv;

describe("instant notifications and classic dashboard navigation", () => {
	it("restricts notification publishing to UID 1 and delivers messages to the addressed user", async () => {
		await SELF.fetch("https://example.com/");
		let owner = await env.DB.prepare("SELECT id FROM users WHERE id = 1").first<{ id: number }>();
		if (!owner) {
			await env.DB.prepare(
				"INSERT INTO users (id, username, password, admin) VALUES (1, 'instant-notification-owner', 'unused', 1)"
			).run();
			owner = { id: 1 };
		}
		const suffix = Date.now().toString();
		const targetInsert = await env.DB.prepare(
			"INSERT INTO users (username, password, points) VALUES (?, 'unused', 0)"
		).bind(`instant-target-${suffix}`).run();
		const otherInsert = await env.DB.prepare(
			"INSERT INTO users (username, password, points) VALUES (?, 'unused', 0)"
		).bind(`instant-other-${suffix}`).run();
		const ownerSession = await createSession(env, owner.id);
		const targetId = Number(targetInsert.meta.last_row_id);
		const targetSession = await createSession(env, targetId);
		const otherSession = await createSession(env, Number(otherInsert.meta.last_row_id));
		const request = (path: string, session?: string, method = "GET") => worker.fetch(
			new IncomingRequest(`https://example.com${path}`, {
				method,
				headers: session ? { Cookie: `uid=${session}` } : {},
			}),
			env,
			createExecutionContext(),
		);

		const query = new URLSearchParams({
			u: String(targetId),
			t: "<系统维护>",
			c: "空间站将在 5 分钟后维护。",
		});
		expect((await request(`/api/noti?${query}`)).status).toBe(403);
		expect((await request(`/api/noti?${query}`, otherSession)).status).toBe(403);
		expect((await request(`/api/noti?u=0&t=x&c=y`, ownerSession)).status).toBe(400);
		expect((await request(`/api/noti?u=${targetId}&t=&c=y`, ownerSession)).status).toBe(400);

		const sent = await request(`/api/noti?${query}`, ownerSession);
		expect(sent.status).toBe(200);
		const delivered = await request("/api/noti/poll?after=0", targetSession);
		expect(delivered.status).toBe(200);
		expect(delivered.headers.get("Cache-Control")).toContain("no-store");
		const data = await delivered.json() as {
			notifications: Array<{ id: number; title: string; content: string }>;
		};
		expect(data.notifications).toHaveLength(1);
		expect(data.notifications[0]).toMatchObject({
			title: "<系统维护>",
			content: "空间站将在 5 分钟后维护。",
		});
		expect((await request("/api/noti/poll?after=0", otherSession)).status).toBe(200);
		const repeat = await request(`/api/noti/poll?after=${data.notifications[0].id}`, targetSession);
		expect((await repeat.json() as { notifications: unknown[] }).notifications).toEqual([]);
		expect((await request("/api/noti/poll?after=-1", targetSession)).status).toBe(400);

		const page = await request("/messages", targetSession);
		expect(page.status).toBe(200);
		const html = await page.text();
		expect(html).toContain("classic-sidebar-group");
		expect(html).toContain("Developer tools");
		expect(html).toContain("instantNotificationOverlay");
		expect(html).toContain("window.setInterval(poll, 2000)");
		expect(html).toContain("}, 3000);");
	});

	it("uses dashboard navigation for the classic sidebar layout, including the modern UI theme", async () => {
		await SELF.fetch("https://example.com/");
		const username = `layout-mode-${Date.now()}`;
		const inserted = await env.DB.prepare(
			"INSERT INTO users (username, password, points, ui_mode, layout_mode) VALUES (?, 'unused', 0, 'modern', 'classic')"
		).bind(username).run();
		const userId = Number(inserted.meta.last_row_id);
		const session = await createSession(env, userId);
		const request = () => worker.fetch(
			new IncomingRequest(`https://example.com/messages`, {
				headers: { Cookie: `uid=${session}` },
			}),
			env,
			createExecutionContext(),
		);
		const modern = await request();
		expect(await modern.text()).toContain("classic-sidebar-group");
		await env.DB.prepare("UPDATE users SET ui_mode = 'classic', layout_mode = 'starlight' WHERE id = ?")
			.bind(userId).run();
		const starlight = await request();
		expect(await starlight.text()).not.toContain("classic-sidebar-group");
	});
});
