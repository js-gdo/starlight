import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export async function bumpVersion(root = process.cwd()) {
	const versionPath = path.join(root, "version.json");
	const packagePath = path.join(root, "package.json");
	const lockPath = path.join(root, "package-lock.json");
	const version = JSON.parse(await readFile(versionPath, "utf8"));

	for (const key of ["major", "minor", "pr"]) {
		if (!Number.isSafeInteger(version[key]) || version[key] < 0) {
			throw new Error(`version.json field "${key}" must be a non-negative safe integer.`);
		}
	}
	if (version.pr === Number.MAX_SAFE_INTEGER) {
		throw new Error("The PR version counter cannot be incremented safely.");
	}

	version.pr += 1;
	const versionString = `${version.major}.${version.minor}.${version.pr}`;
	const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
	const packageLock = JSON.parse(await readFile(lockPath, "utf8"));

	if (!packageLock.packages?.[""]) {
		throw new Error("package-lock.json is missing its root package entry.");
	}

	packageJson.version = versionString;
	packageLock.version = versionString;
	packageLock.packages[""].version = versionString;

	await writeFile(versionPath, `${JSON.stringify(version, null, 2)}\n`);
	await writeFile(packagePath, `${JSON.stringify(packageJson, null, 4)}\n`);
	await writeFile(lockPath, `${JSON.stringify(packageLock, null, 4)}\n`);

	return versionString;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	if (process.argv[2] !== "bump") {
		throw new Error("Usage: node scripts/version.mjs bump [repository-root]");
	}

	const version = await bumpVersion(process.argv[3] || process.cwd());
	console.log(version);
}
