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
		const pageHtml = await page.text();
		expect(pageHtml).toContain("空间站搜刮行动");
		expect(pageHtml).toContain("map-wall");
		expect(pageHtml).toContain("function itemSvg");
		expect(pageHtml).toContain("salvage-tutorial-seen");
		expect(pageHtml).toContain("ArrowUp");
		expect(pageHtml).toContain("assign-gear");
		expect(pageHtml).toContain("playerSvg");

		const initial = await request("/api/salvage/state");
		expect(initial.status).toBe(200);
		const initialState = await initial.json() as {
			player: { star_coins: number; star_crystals: number };
			items: Array<{ id: number; item_key: string }>;
			catalog: Array<{ key: string; kind: string; name: string }>;
		};
		expect(initialState.player).toMatchObject({ star_coins: 1400, star_crystals: 8 });
		expect(initialState.catalog.length).toBeGreaterThanOrEqual(40);
		expect(initialState.catalog.some((item) => item.key === "starlight_crown" && item.kind === "loot")).toBe(true);
		expect(initialState.catalog.some((item) => item.key === "armor_6" && item.name.includes("星铸"))).toBe(true);
		expect(initialState.catalog.some((item) => item.key === "weapon_rail_1" && item.name.includes("磁轨"))).toBe(true);
		expect(initialState.catalog.some((item) => item.key === "weapon_scatter_6" && item.name.includes("散射"))).toBe(true);
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
				map_width: number;
				map_height: number;
				map_tiles: Array<{ x: number; y: number; wall?: boolean }>;
				objects: Array<{ id: string; x: number; y: number; kind: string; enemyType?: string }>;
			};
		};
		expect(activeState.run.zone).toBe("safe");
		expect(activeState.run.cargo).toContainEqual(expect.objectContaining({ key: "medkit", quantity: 1 }));
		expect(JSON.stringify(activeState.run.objects)).not.toContain('"loot"');
		expect(activeState.run).toMatchObject({ map_width: 8, map_height: 7 });
		expect(activeState.run.map_tiles).toContainEqual({ x: 3, y: 3, wall: true });
		expect(activeState.run.objects.filter((object) => object.kind === "wall")).toHaveLength(2);
		expect(new Set(activeState.run.objects.filter((object) => object.kind === "enemy").map((object) => object.enemyType)).size)
			.toBeGreaterThan(1);
		const exit = activeState.run.objects.find((object) => object.kind === "extract");
		if (!exit) throw new Error("The raid map did not generate an extraction point.");
		expect(exit.x === 0 || exit.x === 7 || exit.y === 0 || exit.y === 6).toBe(true);
		expect((await request("/api/salvage/move", { x: 3, y: 3 })).status).toBe(409);
		expect((await request("/api/salvage/move", { x: 0, y: 0 })).status).toBe(400);
		expect((await request("/api/salvage/purchase", { item: "weapon_2" })).status).toBe(409);

		const server = activeState.run.objects.find((object) => object.kind === "server");
		if (!server) throw new Error("The raid map did not generate a server container.");
		await env.DB.prepare(
			"UPDATE salvage_runs SET x = ?, y = ? WHERE user_id = ? AND status = 'active'"
		).bind(server.x, server.y, userId).run();
		const search = await request("/api/salvage/search", {});
		expect(search.status).toBe(200);
		const searchedState = await search.json() as {
			run: { turn: number; cargo: Array<{ key: string; quantity: number }> };
		};
		expect(searchedState.run.turn).toBe(2);
		expect(searchedState.run.cargo.some((entry) => [
			"circuit_board", "data_core", "data_fragment", "quantum_cell", "plasma_coil", "optic_lens",
		].includes(entry.key))).toBe(true);

		const exitNeighbor = activeState.run.map_tiles.find((tile) =>
			!tile.wall && Math.abs(tile.x - exit.x) + Math.abs(tile.y - exit.y) === 1
		);
		if (!exitNeighbor) throw new Error("The extraction point has no adjacent walkable tile.");
		await env.DB.prepare(
			"UPDATE salvage_runs SET x = ?, y = ? WHERE user_id = ? AND status = 'active'"
		).bind(exitNeighbor.x, exitNeighbor.y, userId).run();
		const movedToExit = await request("/api/salvage/move", { x: exit.x, y: exit.y });
		expect(movedToExit.status).toBe(200);
		expect(((await movedToExit.json()) as { run: { turn: number } }).run.turn).toBe(3);
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
			items: Array<{ id: number; item_key: string; durability: number; max_durability: number; sale_value: number }>;
			jobs: Array<{ id: number; category: string }>;
		};
		expect(repairedState.items.find((entry) => entry.item_key === "armor_1")).toMatchObject({
			durability: 49,
			max_durability: 49,
			sale_value: 272,
		});

		const saleTarget = repairedState.items.find((entry) => ["circuit_board", "data_core", "quantum_cell"].includes(entry.item_key));
		if (!saleTarget) throw new Error("The server container did not return a sellable item.");
		expect((await request("/api/salvage/sell", { item_id: saleTarget.id, quantity: saleTarget.quantity })).status).toBe(200);

		const weapon = repairedState.items.find((entry) => entry.item_key === "weapon_1");
		if (!weapon) throw new Error("The extracted weapon was not returned to the stash.");
		expect((await request("/api/salvage/sell", { item_id: weapon.id, quantity: 1 })).status).toBe(409);
		const unloaded = await request("/api/salvage/unload", { item_id: weapon.id });
		expect(unloaded.status).toBe(200);
		const unloadedState = await unloaded.json() as {
			player: { star_crystals: number };
			items: Array<{ id: number; charges: number }>;
		};
		expect(unloadedState.player.star_crystals).toBe(10);
		expect(unloadedState.items.find((entry) => entry.id === weapon.id)?.charges).toBe(0);

		const purchaseArmor = await request("/api/salvage/purchase", { item: "armor_1" });
		expect(purchaseArmor.status).toBe(200);
		const armorPurchaseState = await purchaseArmor.json() as {
			items: Array<{ id: number; item_key: string; sale_value: number }>;
		};
		const wornArmor = armorPurchaseState.items.filter((entry) => entry.item_key === "armor_1").slice(-1)[0];
		if (!wornArmor) throw new Error("The purchased armor was not added to the stash.");
		await env.DB.prepare("UPDATE salvage_inventory SET durability = 27 WHERE id = ?").bind(wornArmor.id).run();
		const wornStateResponse = await request("/api/salvage/state");
		const wornState = await wornStateResponse.json() as {
			items: Array<{ id: number; item_key: string; sale_value: number }>;
		};
		expect(wornState.items.find((entry) => entry.id === wornArmor.id)?.sale_value).toBe(150);
		expect((await request("/api/salvage/sell", { item_id: wornArmor.id, quantity: 1 })).status).toBe(200);

		const purchaseRail = await request("/api/salvage/purchase", { item: "weapon_rail_1" });
		expect(purchaseRail.status).toBe(200);
		const railState = await purchaseRail.json() as {
			items: Array<{ id: number; item_key: string; charges: number }>;
		};
		const railWeapon = railState.items.find((entry) => entry.item_key === "weapon_rail_1");
		if (!railWeapon) throw new Error("The rail weapon was not added to the stash.");
		expect(railWeapon.charges).toBe(0);
		expect((await request("/api/salvage/sell", { item_id: railWeapon.id, quantity: 1 })).status).toBe(200);

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
		expect(secondState.player.star_crystals).toBe(10);
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
