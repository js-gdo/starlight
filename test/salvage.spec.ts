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

describe("space-station salvage game", () => {
	it("initializes an isolated profile and prevents duplicate active raids", async () => {
		await SELF.fetch("https://example.com/");
		const username = `salvage-${Date.now()}`;
		const inserted = await env.DB.prepare(
			"INSERT INTO users (username, password, points) VALUES (?, 'unused', 0)"
		).bind(username).run();
		const userId = Number(inserted.meta.last_row_id);
		const session = await createSession(env, userId);
		const request = (path: string, payload?: Record<string, unknown>) => worker.fetch(
			new IncomingRequest(`https://example.com${path}`, {
				method: payload ? "POST" : "GET",
				headers: {
					Cookie: `uid=${session}`,
					...(payload ? { "Content-Type": "application/json" } : {}),
				},
				...(payload ? { body: JSON.stringify(payload) } : {}),
			}),
			env,
			createExecutionContext(),
		);

		const page = await request("/salvage");
		expect(page.status).toBe(200);
		expect(await page.text()).toContain("空间站搜刮行动");

		const initial = await request("/api/salvage/state");
		expect(initial.status).toBe(200);
		const initialState = await initial.json() as {
			player: { star_coins: number; star_crystals: number };
			items: Array<{ id: number; item_key: string }>;
		};
		expect(initialState.player).toMatchObject({ star_coins: 1400, star_crystals: 8 });
		const findId = (key: string) => {
			const row = initialState.items.find((entry) => entry.item_key === key);
			if (!row) throw new Error(`Missing starter item ${key}`);
			return row.id;
		};
		const loadout = {
			backpack_id: findId("backpack_1"),
			weapon_id: findId("weapon_1"),
			armor_id: findId("armor_1"),
		};

		const blockedZone = await request("/api/salvage/start", { ...loadout, zone: "chaos" });
		expect(blockedZone.status).toBe(409);

		const starts = await Promise.all([
			request("/api/salvage/start", { ...loadout, zone: "safe", medkits: 1 }),
			request("/api/salvage/start", { ...loadout, zone: "safe", medkits: 1 }),
		]);
		expect(starts.map((response) => response.status).sort()).toEqual([200, 409]);
		const active = await request("/api/salvage/state");
		const activeState = await active.json() as {
			run: {
				zone: string;
				x: number;
				y: number;
				cargo: Array<{ key: string; quantity: number }>;
				objects: Array<{ id: string; x: number; y: number; kind: string }>;
			};
		};
		expect(activeState.run.zone).toBe("safe");
		expect(activeState.run.cargo).toContainEqual(expect.objectContaining({ key: "medkit", quantity: 1 }));
		expect(JSON.stringify(activeState.run.objects)).not.toContain('"loot"');
		expect((await request("/api/salvage/purchase", { item: "weapon_2" })).status).toBe(409);

		const server = activeState.run.objects.find((object) => object.kind === "server");
		if (!server) throw new Error("The raid map did not generate a server container.");
		await env.DB.prepare(
			"UPDATE salvage_runs SET x = ?, y = ? WHERE user_id = ? AND status = 'active'"
		).bind(server.x, server.y, userId).run();
		const search = await request("/api/salvage/search", {});
		expect(search.status).toBe(200);
		const searchedState = await search.json() as {
			run: { cargo: Array<{ key: string; quantity: number }> };
		};
		expect(searchedState.run.cargo.some((entry) => ["circuit_board", "data_core", "quantum_cell"].includes(entry.key))).toBe(true);

		await env.DB.prepare(
			"UPDATE salvage_runs SET x = 5, y = 4 WHERE user_id = ? AND status = 'active'"
		).bind(userId).run();
		expect((await request("/api/salvage/move", { x: 5, y: 5 })).status).toBe(200);
		const extracted = await request("/api/salvage/extract", {});
		expect(extracted.status).toBe(200);
		const hideout = await extracted.json() as {
			player: { star_coins: number; star_crystals: number };
			items: Array<{ id: number; item_key: string; quantity: number; durability: number; max_durability: number; charges: number }>;
			run: null;
		};
		expect(hideout.run).toBeNull();
		expect(hideout.items.some((entry) => ["circuit_board", "data_core", "quantum_cell"].includes(entry.item_key))).toBe(true);

		const repairTarget = hideout.items.find((entry) => entry.item_key === "armor_1");
		if (!repairTarget) throw new Error("Extracted armor was not returned to the stash.");
		await env.DB.prepare("UPDATE salvage_inventory SET durability = 30 WHERE id = ?").bind(repairTarget.id).run();
		expect((await request("/api/salvage/repair", { item_id: repairTarget.id })).status).toBe(200);
		const repaired = await request("/api/salvage/state");
		const repairedState = await repaired.json() as {
			items: Array<{ id: number; item_key: string; durability: number; max_durability: number }>;
			jobs: Array<{ id: number; category: string }>;
		};
		expect(repairedState.items.find((entry) => entry.item_key === "armor_1")).toMatchObject({
			durability: 49,
			max_durability: 49,
		});

		const saleTarget = repairedState.items.find((entry) => ["circuit_board", "data_core", "quantum_cell"].includes(entry.item_key));
		if (!saleTarget) throw new Error("The server container did not return a sellable item.");
		expect((await request("/api/salvage/sell", { item_id: saleTarget.id, quantity: saleTarget.quantity })).status).toBe(200);

		const crafted = await request("/api/salvage/craft", { item: "backpack_1" });
		expect(crafted.status).toBe(200);
		const craftingState = await crafted.json() as { jobs: Array<{ id: number; category: string }> };
		const backpackJob = craftingState.jobs.find((job) => job.category === "backpack");
		if (!backpackJob) throw new Error("The backpack manufacturer did not create a job.");
		expect((await request("/api/salvage/craft", { item: "backpack_2" })).status).toBe(409);
		await env.DB.prepare("UPDATE salvage_crafting SET finishes_at = '2000-01-01T00:00:00.000Z' WHERE id = ?")
			.bind(backpackJob.id).run();
		expect((await request("/api/salvage/craft/claim", { job_id: backpackJob.id })).status).toBe(200);

		const readyForSecondRun = await request("/api/salvage/state");
		const secondState = await readyForSecondRun.json() as {
			player: { star_crystals: number };
			items: Array<{ id: number; item_key: string; charges: number }>;
		};
		const secondLoadout = {
			backpack_id: secondState.items.find((entry) => entry.item_key === "backpack_1")!.id,
			weapon_id: secondState.items.find((entry) => entry.item_key === "weapon_1")!.id,
			armor_id: secondState.items.find((entry) => entry.item_key === "armor_1")!.id,
		};
		expect((await request("/api/salvage/charge", { item_id: secondLoadout.weapon_id, crystals: 1 })).status).toBe(200);
		expect(secondState.player.star_crystals).toBe(8);
		expect((await request("/api/salvage/start", { ...secondLoadout, zone: "safe", medkits: 1 })).status).toBe(200);
		const secondRunResponse = await request("/api/salvage/state");
		const secondRunState = await secondRunResponse.json() as {
			run: { objects: Array<{ id: string; x: number; y: number; kind: string }> };
		};
		const enemy = secondRunState.run.objects.find((object) => object.kind === "enemy");
		if (!enemy) throw new Error("The raid map did not generate an enemy.");
		const adjacentX = enemy.x > 0 ? enemy.x - 1 : enemy.x + 1;
		await env.DB.prepare(
			"UPDATE salvage_runs SET x = ?, y = ?, health = 1 WHERE user_id = ? AND status = 'active'"
		).bind(adjacentX, enemy.y, userId).run();
		const death = await request("/api/salvage/attack", { object_id: enemy.id });
		expect(death.status).toBe(200);
		const deathState = await death.json() as { run: null };
		expect(deathState.run).toBeNull();
		const retainedGear = await env.DB.prepare(
			"SELECT item_key FROM salvage_inventory WHERE user_id = ? AND item_key IN ('weapon_1', 'armor_1')"
		).bind(userId).all<{ item_key: string }>();
		expect(retainedGear.results).toEqual([]);
	});
});
