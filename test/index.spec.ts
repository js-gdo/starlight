import {
	env,
	createExecutionContext,
	waitOnExecutionContext,
	SELF,
} from "cloudflare:test";
import { describe, it, expect } from "vitest";
import worker from "../src/index";
import { renderUsernameLink } from "../src/utils/html";
import {
	buildProblemArticleTitle,
	buildProblemArticleContent,
	resolveArticleTypeFilter,
} from "../src/utils/problem";

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe("worker root page", () => {
	it("returns the app home page", async () => {
		const request = new IncomingRequest("http://example.com/");
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		const html = await response.text();
		expect(response.status).toBe(200);
		expect(html).toContain("StarLight");
	});

	it("handles the integration route", async () => {
		const response = await SELF.fetch("https://example.com/");
		expect(response.status).toBe(200);
	});
});

describe("problem article helpers", () => {
	it("prefixes the title and adds the problem link", () => {
		expect(buildProblemArticleTitle("1001", "A+B Problem", "if you WA on #3")).toBe("[1001 A+B Problem] if you WA on #3");
		expect(buildProblemArticleContent("hello", "1001")).toContain("https://oj.lin114514.top/1001");
	});

	it("resolves the article filter modes", () => {
		expect(resolveArticleTypeFilter(new URL("https://example.com/articles/list?type=all"))).toEqual({ type: "all", problemId: null });
		expect(resolveArticleTypeFilter(new URL("https://example.com/articles/list?type=problem&id=1002"))).toEqual({ type: "problem", problemId: "1002" });
		expect(resolveArticleTypeFilter(new URL("https://example.com/articles/list?type=normal"))).toEqual({ type: "normal", problemId: null });
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
