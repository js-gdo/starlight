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
		expect(pageHtml).toContain("arrowup");
		expect(pageHtml).toContain("assign-gear");
		expect(pageHtml).toContain("playerSvg");
		expect(pageHtml).toContain("requestAnimationFrame(animationFrame)");
		expect(pageHtml).toContain("salvage/finish");
		expect(pageHtml).toContain("连续移动");
		expect(pageHtml).toContain("key==='t'");
		expect(pageHtml).toContain("key==='f'");
		expect(pageHtml).toContain("healthDifference");
		expect(pageHtml).toContain("<=1.5");
		expect(pageHtml).toContain("refreshInteractionUi");
		expect(pageHtml).toContain("advanceEnemies");
		expect(pageHtml).toContain("salvage-minimap");
		expect(pageHtml).toContain("salvage-backpack-grid");
		expect(pageHtml).toContain("buy-craft-materials");
		expect(pageHtml).toContain("run-equip");
		expect(pageHtml).toContain("playerDamagePopup");
		expect(pageHtml).toContain("rarity-tier-6");
		expect(pageHtml).toContain("var colors=['#edf1f5','#63dc82','#54a5ff','#b77aff','#f4c64e','#f0646d']");

		const initial = await request("/api/salvage/state");
		expect(initial.status).toBe(200);
		const initialState = await initial.json() as {
			player: { star_coins: number; star_crystals: number };
			items: Array<{ id: number; item_key: string }>;
			catalog: Array<{ key: string; kind: string; name: string; width: number; height: number; price: number }>;
		};
		expect(initialState.player).toMatchObject({ star_coins: 1400, star_crystals: 8 });
		expect(initialState.catalog.length).toBeGreaterThanOrEqual(40);
		expect(initialState.catalog.some((item) => item.key === "starlight_crown" && item.kind === "loot")).toBe(true);
		expect(initialState.catalog.some((item) => item.key === "armor_6" && item.name.includes("星铸"))).toBe(true);
		expect(initialState.catalog.some((item) => item.key === "weapon_rail_1" && item.name.includes("磁轨"))).toBe(true);
		expect(initialState.catalog.some((item) => item.key === "weapon_scatter_6" && item.name.includes("散射"))).toBe(true);
		expect(initialState.catalog.find((item) => item.key === "magnetic_core")).toMatchObject({ width: 3, height: 3 });
		expect(initialState.catalog.find((item) => item.key === "starlight_crown")).toMatchObject({ width: 1, height: 1 });
		expect(initialState.catalog.find((item) => item.key === "backpack_1")).toMatchObject({ width: 2, height: 2 });
		expect(initialState.catalog.find((item) => item.key === "alloy_plate")?.price).toBeGreaterThan(0);

		const materialsPurchased = await request("/api/salvage/craft/materials", { item: "star_crystal" });
		expect(materialsPurchased.status).toBe(200);
		const purchaseState = await materialsPurchased.json() as {
			player: { star_coins: number };
			items: Array<{ item_key: string; quantity: number }>;
		};
		expect(purchaseState.player.star_coins).toBeLessThan(1400);
		expect(purchaseState.items.some((entry) => entry.item_key === "quantum_cell" && entry.quantity >= 2)).toBe(true);
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
				map_regions: Array<{ id: string; name: string }>;
				objects: Array<{ id: string; x: number; y: number; kind: string; enemyType?: string }>;
			};
		};
		expect(activeState.run.zone).toBe("safe");
		expect(activeState.run.cargo).toContainEqual(expect.objectContaining({ key: "medkit", quantity: 1 }));
		expect(JSON.stringify(activeState.run.objects)).not.toContain('"loot"');
		expect(activeState.run).toMatchObject({ map_width: 52, map_height: 36, x: 7, y: 8 });
		expect(activeState.run.map_tiles.some((tile) => tile.wall)).toBe(true);
		expect(activeState.run.map_regions.map((region) => region.name)).toEqual(
			expect.arrayContaining(["生活区", "管理区", "研发区", "机组区", "核心区", "工程区"]),
		);
		expect(activeState.run.objects.filter((object) => object.kind === "wall").length).toBeGreaterThan(2);
		expect(activeState.run.objects.filter((object) =>
			["server", "safe", "medical", "supply", "archive", "armory", "lab", "locker", "reactor"].includes(object.kind)
		).length).toBeGreaterThanOrEqual(16);
		expect(new Set(activeState.run.objects.filter((object) => object.kind === "enemy").map((object) => object.enemyType)).size)
			.toBeGreaterThan(1);
		const exit = activeState.run.objects.find((object) => object.kind === "extract");
		if (!exit) throw new Error("The raid map did not generate an extraction point.");
		expect(exit.x === 2 || exit.x === 49 || exit.y === 3 || exit.y === 32).toBe(true);
		expect((await request("/api/salvage/move", { x: 3, y: 3 })).status).toBe(400);
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
			"circuit_board", "data_core", "data_fragment", "quantum_cell", "plasma_coil", "optic_lens", "magnetic_core", "signal_prism",
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
			run: { map_tiles: Array<{ x: number; y: number; wall?: boolean }>; objects: Array<{ id: string; x: number; y: number; kind: string }> };
		};
		const enemy = secondRunState.run.objects.find((object) => object.kind === "enemy");
		if (!enemy) throw new Error("The raid map did not generate an enemy.");
		const adjacent = secondRunState.run.map_tiles.find((tile) =>
			!tile.wall && Math.abs(tile.x - enemy.x) + Math.abs(tile.y - enemy.y) === 1
		);
		if (!adjacent) throw new Error("The enemy has no adjacent walkable tile.");
		await env.DB.prepare(
			"UPDATE salvage_runs SET x = ?, y = ?, health = 1 WHERE user_id = ? AND status = 'active'"
		).bind(adjacent.x, adjacent.y, userId).run();
		const death = await request("/api/salvage/attack", { object_id: enemy.id });
		expect(death.status).toBe(200);
		const deathState = await death.json() as { run: null };
		expect(deathState.run).toBeNull();
		const retainedGear = await env.DB.prepare(
			"SELECT item_key FROM salvage_inventory WHERE user_id = ? AND item_key IN ('weapon_1', 'armor_1')"
		).bind(userId).all<{ item_key: string }>();
		expect(retainedGear.results).toEqual([]);

		for (const key of ["backpack_1", "weapon_rail_1", "armor_1"]) {
			expect((await request("/api/salvage/purchase", { item: key })).status).toBe(200);
		}
		const readyForClientRun = await request("/api/salvage/state");
		const clientGearState = await readyForClientRun.json() as {
			items: Array<{ id: number; item_key: string }>;
		};
		const clientLoadout = {
			backpack_id: clientGearState.items.find((entry) => entry.item_key === "backpack_1")!.id,
			weapon_id: clientGearState.items.find((entry) => entry.item_key === "weapon_rail_1")!.id,
			armor_id: clientGearState.items.find((entry) => entry.item_key === "armor_1")!.id,
		};
		expect((await request("/api/salvage/charge", { item_id: clientLoadout.weapon_id, crystals: 1 })).status).toBe(200);
		expect((await request("/api/salvage/start", { ...clientLoadout, zone: "safe" })).status).toBe(200);
		const clientRunResponse = await request("/api/salvage/state");
		const clientState = await clientRunResponse.json() as {
			run: {
				id: number;
				x: number;
				y: number;
				health: number;
				turn: number;
				objects: Array<{ id: string; x: number; y: number; kind: string }>;
				client_objects: Array<Record<string, unknown>>;
				cargo: Array<Record<string, unknown>>;
				backpack: { key: string; durability: number; maxDurability: number; charges: number };
				weapon: { key: string; durability: number; maxDurability: number; charges: number };
				armor: { key: string; durability: number; maxDurability: number; charges: number };
			};
		};
		expect(clientState.run.client_objects.some((object) => "loot" in object)).toBe(true);
		expect(JSON.stringify(clientState.run.objects)).not.toContain('"loot"');
		const clientExit = clientState.run.objects.find((object) => object.kind === "extract");
		if (!clientExit) throw new Error("The client-side raid is missing its extraction point.");
		const finishResult = {
			run_id: clientState.run.id,
			status: "extracted",
			x: clientExit.x,
			y: clientExit.y,
			world_x: (clientExit.x + 0.5) * 72,
			world_y: (clientExit.y + 0.5) * 72,
			health: clientState.run.health,
			turn: 1,
			objects: clientState.run.client_objects,
			cargo: clientState.run.cargo.map((entry) => ({
				key: entry.key,
				quantity: entry.quantity,
				durability: entry.durability,
				maxDurability: entry.maxDurability,
				charges: entry.charges,
			})),
			kit: {
				backpack: {
					key: clientState.run.backpack.key,
					quantity: 1,
					durability: clientState.run.backpack.durability,
					maxDurability: clientState.run.backpack.maxDurability,
					charges: clientState.run.backpack.charges,
				},
				weapon: {
					key: clientState.run.weapon.key,
					quantity: 1,
					durability: clientState.run.weapon.durability,
					maxDurability: clientState.run.weapon.maxDurability,
					charges: clientState.run.weapon.charges,
				},
				armor: {
					key: clientState.run.armor.key,
					quantity: 1,
					durability: clientState.run.armor.durability,
					maxDurability: clientState.run.armor.maxDurability,
					charges: clientState.run.armor.charges,
				},
			},
		};
		const regressionLoot = [
			{ key: "weapon_1", quantity: 1, durability: 0, maxDurability: 0, charges: 0 },
			{ key: "weapon_rail_2", quantity: 1, durability: 0, maxDurability: 0, charges: 0 },
			{ key: "fiber_bundle", quantity: 1, durability: 0, maxDurability: 0, charges: 0 },
			{ key: "alloy_plate", quantity: 1, durability: 0, maxDurability: 0, charges: 0 },
		];
		const serverContainer = clientState.run.client_objects.find((object) => object.kind === "server");
		if (!serverContainer) throw new Error("The client-side raid is missing its server container.");
		const finishObjects = clientState.run.client_objects.map((object) =>
			object.id === serverContainer.id
				? { ...object, searched: true, loot: regressionLoot }
				: object
		);
		await env.DB.prepare("UPDATE salvage_runs SET map_json = ? WHERE id = ?")
			.bind(JSON.stringify(finishObjects), clientState.run.id).run();
		finishResult.objects = finishObjects;
		finishResult.cargo = regressionLoot;
		const clientFinish = await request("/api/salvage/finish", { result: finishResult });
		expect(clientFinish.status).toBe(200);
		expect(((await clientFinish.json()) as { run: null }).run).toBeNull();
		expect((await request("/api/salvage/finish", { result: finishResult })).status).toBe(409);
	});
});
