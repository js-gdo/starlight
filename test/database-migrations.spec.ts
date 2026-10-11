import { env as cloudflareEnv } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { Env as WorkerEnv } from "../src/env.d";

const env = cloudflareEnv as unknown as WorkerEnv;

describe("deployment-applied database migrations", () => {
	it("creates the application schema, economy guards, and initial settings", async () => {
		const tables = await env.DB.prepare(
			"SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('users', 'space_game_players', 'ruins_players', 'space_station_players', 'game_points_exchanges')",
		).all<{ name: string }>();
		expect(new Set(tables.results.map(row => row.name))).toEqual(new Set([
			"users",
			"space_game_players",
			"ruins_players",
			"space_station_players",
			"game_points_exchanges",
		]));

		const admin = await env.DB.prepare(
			'SELECT id, username, points, invite_code FROM users WHERE id = 1',
		).first<{ id: number; username: string; points: number; invite_code: string }>();
		expect(admin).toMatchObject({ id: 1, username: "lin114514", points: 100 });
		expect(admin?.invite_code).toMatch(/^[0-9a-f]{4}$/);

		const settings = await env.DB.prepare(
			"SELECT setting_value FROM site_settings WHERE setting_key = 'site_status'",
		).first<{ setting_value: string }>();
		expect(settings?.setting_value).toBe("normal");
	});
});
