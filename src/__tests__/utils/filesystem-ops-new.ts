import { promises as fs, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Creates or returns the single test directory for the entire test run
 * Pattern: output-tests/aidd-v<version>
 */
export async function createE2ETestDir(): Promise<string> {
	// Read package.json version
	const packageJsonPath = join(process.cwd(), "package.json");
	const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf-8"));
	const version = packageJson.version;

	// Single directory for entire test run (version-scoped)
	const testRunDir = join(
		process.cwd(),
		"..",
		"output-tests",
		`aidd-v${version}`,
	);

	// Create if doesn't exist
	await fs.mkdir(testRunDir, { recursive: true });

	return testRunDir;
}

/**
 * Cleans up the test run directory
 */
export async function cleanupE2ETestDir(): Promise<void> {
	// Skip cleanup if preserve flag is set
	if (process.env.E2E_PRESERVE === "1") {
		console.log("📁 Test directory preserved (E2E_PRESERVE=1)");
		return;
	}

	// Read package.json version
	const packageJsonPath = join(process.cwd(), "package.json");
	const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf-8"));
	const version = packageJson.version;

	const testRunDir = join(
		process.cwd(),
		"..",
		"output-tests",
		`aidd-v${version}`,
	);

	if (existsSync(testRunDir)) {
		await fs.rm(testRunDir, { recursive: true, force: true });
		console.log(`🧹 Cleaned up test directory: ${testRunDir}`);
	}
}
