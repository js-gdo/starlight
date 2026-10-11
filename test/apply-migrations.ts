import { env, applyD1Migrations } from "cloudflare:test";
import type { Env as WorkerEnv } from "../src/env.d";

type MigrationEnv = WorkerEnv & { TEST_MIGRATIONS: D1Migration[] };

await applyD1Migrations(
	(env as unknown as MigrationEnv).DB,
	(env as unknown as MigrationEnv).TEST_MIGRATIONS,
);
