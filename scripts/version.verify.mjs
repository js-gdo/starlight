import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { bumpVersion } from "./version.mjs";

const root = await mkdtemp(path.join(os.tmpdir(), "starlight-version-"));

try {
	await writeFile(path.join(root, "version.json"), JSON.stringify({ major: 1, minor: 0, pr: 154 }));
	await writeFile(path.join(root, "package.json"), JSON.stringify({ name: "test", version: "1.0.154" }));
	await writeFile(path.join(root, "package-lock.json"), JSON.stringify({
		name: "test",
		version: "1.0.154",
		packages: { "": { name: "test", version: "1.0.154" } },
	}));

	assert.equal(await bumpVersion(root), "1.0.155");
	assert.equal(await bumpVersion(root), "1.0.156");

	const version = JSON.parse(await readFile(path.join(root, "version.json"), "utf8"));
	const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
	const packageLock = JSON.parse(await readFile(path.join(root, "package-lock.json"), "utf8"));
	assert.deepEqual(version, { major: 1, minor: 0, pr: 156 });
	assert.equal(packageJson.version, "1.0.156");
	assert.equal(packageLock.version, "1.0.156");
	assert.equal(packageLock.packages[""].version, "1.0.156");
} finally {
	await rm(root, { recursive: true, force: true });
}
