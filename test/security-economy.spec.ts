import { createExecutionContext, env as cloudflareEnv } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import worker from "../src/index";
import { createSession, generateHex } from "../src/utils/auth";
import { sha256 } from "../src/utils/crypto";
import type { Env as WorkerEnv } from "../src/env.d";

const env = cloudflareEnv as unknown as WorkerEnv;
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

function workerRequest(path: string, init?: RequestInit) {
	return worker.fetch(new IncomingRequest(`https://example.com${path}`, init), env, createExecutionContext());
}

describe("authentication rate limits and session cookies", () => {
	it("limits repeated login attempts by a hashed client IP", async () => {
		const ip = `192.0.2.${Math.floor(Math.random() * 200) + 1}`;
		const responses = [];
		for (let index = 0; index < 11; index++) {
			responses.push(await workerRequest("/api/login", {
				method: "POST",
				headers: { "Content-Type": "application/json", "CF-Connecting-IP": ip },
				body: "{}",
			}));
		}

		expect(responses.slice(0, 10).every(response => response.status === 400)).toBe(true);
		expect(responses[10].status).toBe(429);
	});

	it("limits repeated registrations by a hashed client IP", async () => {
		const ip = `198.51.100.${Math.floor(Math.random() * 200) + 1}`;
		const responses = [];
		for (let index = 0; index < 6; index++) {
			responses.push(await workerRequest("/api/register", {
				method: "POST",
				headers: { "Content-Type": "application/json", "CF-Connecting-IP": ip },
				body: "{}",
			}));
		}

		expect(responses.slice(0, 5).every(response => response.status === 400)).toBe(true);
		expect(responses[5].status).toBe(429);
	});

	it("sets secure HttpOnly cookies on login and clears them with matching attributes", async () => {
		const username = `cookie${Date.now().toString().slice(-8)}`;
		const password = "safe-test-password";
		const inserted = await env.DB.prepare(
			"INSERT INTO users (username, password, points) VALUES (?, ?, 0)",
		).bind(username, await sha256(password)).run();
		const login = await workerRequest("/api/login", {
			method: "POST",
			headers: { "Content-Type": "application/json", "CF-Connecting-IP": `203.0.113.${inserted.meta.last_row_id % 200 + 1}` },
			body: JSON.stringify({ username, password }),
		});
		expect(login.status).toBe(200);
		const cookie = login.headers.get("Set-Cookie") || "";
		expect(cookie).toContain("Secure");
		expect(cookie).toContain("HttpOnly");
		expect(cookie).toContain("SameSite=Lax");

		const logout = await workerRequest("/logout");
		const cleared = logout.headers.get("Set-Cookie") || "";
		expect(cleared).toContain("Secure");
		expect(cleared).toContain("HttpOnly");
		expect(cleared).toContain("SameSite=Lax");
		expect(cleared).toContain("Max-Age=0");
	});

	it("generates cryptographically random 16-character hexadecimal IDs", () => {
		expect(generateHex()).toMatch(/^[0-9a-f]{16}$/);
		expect(new Set(Array.from({ length: 1000 }, generateHex)).size).toBe(1000);
	});
});

describe("points and coin transaction boundaries", () => {
	it("awards a daily check-in exactly once under concurrent requests", async () => {
		const username = `checkin${Date.now().toString().slice(-8)}`;
		const inserted = await env.DB.prepare(
			"INSERT INTO users (username, password, points) VALUES (?, 'unused', 0)",
		).bind(username).run();
		const userId = Number(inserted.meta.last_row_id);
		const session = await createSession(env, userId);
		const request = () => workerRequest("/api/checkin", {
			method: "POST",
			headers: { Cookie: `uid=${session}` },
		});

		const responses = await Promise.all([request(), request()]);
		expect(responses.every(response => response.status === 200)).toBe(true);
		const bodies = await Promise.all(responses.map(response => response.json() as Promise<{ checked: boolean }>));
		expect(bodies.filter(body => !body.checked)).toHaveLength(1);
		const balance = await env.DB.prepare("SELECT points FROM users WHERE id = ?")
			.bind(userId).first<{ points: number }>();
		expect(balance?.points).toBe(10);
	});

	it("prevents concurrent point-to-coin redemptions from spending below zero", async () => {
		const username = `economy${Date.now().toString().slice(-8)}`;
		const inserted = await env.DB.prepare(
			"INSERT INTO users (username, password, points, server_coin) VALUES (?, 'unused', 10, 0)",
		).bind(username).run();
		const userId = Number(inserted.meta.last_row_id);
		const session = await createSession(env, userId);
		const request = (amount: number) => workerRequest("/api/server/exchange", {
			method: "POST",
			headers: { Cookie: `uid=${session}`, "Content-Type": "application/json" },
			body: JSON.stringify({ direction: "point_to_coin", amount }),
		});

		const results = await Promise.all([request(10), request(10)]);
		expect(results.map(response => response.status).sort()).toEqual([200, 409]);
		const balance = await env.DB.prepare("SELECT points, server_coin FROM users WHERE id = ?")
			.bind(userId).first<{ points: number; server_coin: number }>();
		expect(balance).toEqual({ points: 0, server_coin: 100 });

		const negative = await request(-1);
		expect(negative.status).toBe(400);
		const unchanged = await env.DB.prepare("SELECT points, server_coin FROM users WHERE id = ?")
			.bind(userId).first<{ points: number; server_coin: number }>();
		expect(unchanged).toEqual({ points: 0, server_coin: 100 });
	});

	it("rate limits authenticated check-in and economy requests", async () => {
		const username = `limit${Date.now().toString().slice(-8)}`;
		const inserted = await env.DB.prepare(
			"INSERT INTO users (username, password, points, server_coin) VALUES (?, 'unused', 100, 0)",
		).bind(username).run();
		const session = await createSession(env, Number(inserted.meta.last_row_id));
		const responses = [];
		for (let index = 0; index < 6; index++) {
			responses.push(await workerRequest("/api/checkin", {
				method: "POST",
				headers: { Cookie: `uid=${session}` },
			}));
		}
		expect(responses.filter(response => response.status === 429)).toHaveLength(1);

		const exchanges = [];
		for (let index = 0; index < 11; index++) {
			exchanges.push(await workerRequest("/api/server/exchange", {
				method: "POST",
				headers: { Cookie: `uid=${session}`, "Content-Type": "application/json" },
				body: JSON.stringify({ direction: "point_to_coin", amount: 1 }),
			}));
		}
		expect(exchanges.some(response => response.status === 429)).toBe(true);
	});
});
