import { createExecutionContext, env as cloudflareEnv, waitOnExecutionContext } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import worker from "../src/index";
import { createSession } from "../src/utils/auth";
import type { Env as WorkerEnv } from "../src/env.d";

const env = cloudflareEnv as unknown as WorkerEnv;
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

		const session = await createSession(env, 1, 0);
		const form = new FormData();
		form.set('bio', '');
		form.set('real_name', 'Migration Test');
		form.set('location', 'Beijing');
		form.set('profile_link', 'https://example.com');
		form.set('avatar_url', '');
		form.set('sidebar_mode', 'classic');
		form.set('ui_mode', 'modern');
		form.set('layout_mode', 'starlight');
		form.set('background_url', 'https://images.example.com/community.jpg');
		form.set('background_mode', 'stretch');
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
		const user = await env.DB.prepare('SELECT real_name, location, profile_link, ui_mode, layout_mode, background_url, background_mode, redirect_delay_seconds FROM users WHERE id = 1').first<any>();
		expect(user).toEqual({
			real_name: 'Migration Test',
			location: 'Beijing',
			profile_link: 'https://example.com',
			ui_mode: 'modern',
			layout_mode: 'starlight',
			background_url: 'https://images.example.com/community.jpg',
			background_mode: 'stretch',
			redirect_delay_seconds: 10,
		});
		const home = await worker.fetch(new IncomingRequest('http://example.com/', {
			headers: { Cookie: `uid=${session}` },
		}), env, createExecutionContext());
		const homeHtml = await home.text();
		expect(homeHtml).toContain('class="ui-modern layout-starlight"');
		expect(homeHtml).toContain('starlight-topbar');
		expect(homeHtml).toMatch(/class="starlight-user username-link"[^>]*data-user-id="1"[^>]*data-point-badge-ready="1"/);
		expect(homeHtml).toContain('欢迎回来，<a href="/user/1" class="username-link" data-user-id="1"');
		expect(homeHtml).toContain('class="point-rank-badge"');
		expect(homeHtml).toContain('title="积分排名：1 / 1"');
		expect(homeHtml).toContain('community.jpg');
		expect(homeHtml).toContain('background-size: 100% 100% !important');
		const adminList = await worker.fetch(new IncomingRequest('http://example.com/admin-list', {
			headers: { Cookie: `uid=${session}` },
		}), env, createExecutionContext());
		const adminListHtml = await adminList.text();
		expect(adminListHtml).toMatch(/class="username-link"[^>]*data-user-id="1"[^>]*data-point-badge-ready="1"/);
		expect(adminListHtml).toContain('class="point-rank-badge"');
		const permissions = await env.DB.prepare('SELECT admin_permissions FROM users WHERE id = 1').first<any>();
		expect(JSON.parse(permissions.admin_permissions)).toEqual(['*']);

		const invalidForm = new FormData();
		invalidForm.set('background_url', 'javascript:alert(1)');
		const invalidBackground = await worker.fetch(new IncomingRequest('http://example.com/api/user/bio', {
			method: 'POST', headers: { Cookie: `uid=${session}` }, body: invalidForm,
		}), env, createExecutionContext());
		expect(invalidBackground.status).toBe(400);
	});
});
