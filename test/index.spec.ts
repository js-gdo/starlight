import {
	env,
	createExecutionContext,
	waitOnExecutionContext,
	SELF,
} from "cloudflare:test";
import { describe, it, expect } from "vitest";
import worker from "../src/index";
import { renderUsernameLink } from "../src/utils/html";
import { buildProblemArticleTitle, buildProblemArticleContent } from "../src/utils/problem";
import { normalizeProfileFields, validateAvatarUrl, validateProfileUrl } from "../src/utils/profile";
import { buildReportAuditText, normalizeReportReason } from "../src/handlers/reports";

// For now, you'll need to do something like this to get a correctly-typed
// `Request` to pass to `worker.fetch()`.
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

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

	it("returns 404 for unknown pages", async () => {
		const response = await SELF.fetch("https://example.com/definitely-not-a-page");
		expect(response.status).toBe(404);
		expect(await response.text()).toBe("Not Found");
	});

	it("returns 404 JSON for unknown API paths", async () => {
		const response = await SELF.fetch("https://example.com/api/nope");
		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({ error: "API not found" });
	});

	it("does not leak internal error details", async () => {
		const request = new IncomingRequest("http://example.com/");
		const brokenEnv = { ...env, DB: undefined } as unknown as typeof env;
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, brokenEnv, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(500);
		expect(await response.text()).toBe("Internal Server Error");
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
