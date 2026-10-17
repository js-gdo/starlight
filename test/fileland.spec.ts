import {
	createExecutionContext,
	env as cloudflareEnv,
} from "cloudflare:test";
import { describe, expect, it } from "vitest";
import worker from "../src/index";
import { createSession } from "../src/utils/auth";
import type { Env as WorkerEnv } from "../src/env.d";

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;
const env = cloudflareEnv as unknown as WorkerEnv;

describe("File Land upload", () => {
	it("embeds the current user's private File Land and shows the password reminder", async () => {
		await worker.fetch(
			new IncomingRequest("https://example.com/"),
			env,
			createExecutionContext(),
		);
		const username = `fileland-${Date.now()}`;
		const result = await env.DB.prepare(
			"INSERT INTO users (username, password, points) VALUES (?, 'unused', 0)"
		).bind(username).run();
		const userId = Number(result.meta.last_row_id);
		const session = await createSession(env, userId);
		const response = await worker.fetch(
			new IncomingRequest("https://example.com/settings", {
				headers: { Cookie: `uid=${session}` },
			}),
			env,
			createExecutionContext(),
		);

		expect(response.status).toBe(200);
		const html = await response.text();
		expect(html).toContain(`src="https://b2.lin114514.top/land/starlight-${userId}"`);
		expect(html).toContain("为自己的 file land 设置密码");
		expect(html).toContain("防止他人盗取信息，并牢记密码");
	});
});
