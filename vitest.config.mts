import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

async function readMigrations(directory: string) {
	const files = (await readdir(directory)).filter(file => /^\d+_.*\.sql$/.test(file)).sort();
	return Promise.all(files.map(async name => {
		const sql = await readFile(new URL(`./migrations/${name}`, import.meta.url), "utf8");
		const queries = sql.split(/;\s*(?=(?:CREATE|INSERT|UPDATE|ALTER)\b)/g)
			.map(query => query.trim())
			.filter(Boolean);
		return { name, queries };
	}));
}

export default defineConfig({
	plugins: [
		cloudflareTest(async () => ({
			wrangler: { configPath: "./wrangler.jsonc" },
			miniflare: {
				bindings: {
					TEST_MIGRATIONS: await readMigrations(fileURLToPath(new URL("./migrations", import.meta.url))),
				},
			},
		})),
	],
	test: {
		setupFiles: ["./test/apply-migrations.ts"],
	},
});
