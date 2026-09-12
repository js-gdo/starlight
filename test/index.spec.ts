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

// For now, you'll need to do something like this to get a correctly-typed
// `Request` to pass to `worker.fetch()`.
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe("Hello World worker", () => {
	it("responds with Hello World! (unit style)", async () => {
		const request = new IncomingRequest("http://example.com");
		// Create an empty context to pass to `worker.fetch()`.
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		// Wait for all `Promise`s passed to `ctx.waitUntil()` to settle before running test assertions
		await waitOnExecutionContext(ctx);
		expect(await response.text()).toMatchInlineSnapshot(`"Hello World!"`);
	});

	it("responds with Hello World! (integration style)", async () => {
		const response = await SELF.fetch("https://example.com");
		expect(await response.text()).toMatchInlineSnapshot(`"Hello World!"`);
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
