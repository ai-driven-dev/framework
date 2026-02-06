import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		testTimeout: 30000, // 30 seconds for installation tests
		hookTimeout: 30000,
		// E2E tests need forks (process.chdir not supported in threads)
		pool: process.env.VITEST_UNIT ? "threads" : "forks",
		maxConcurrency: 10,
		// Global setup for E2E tests (default behavior since most tests are E2E)
		globalSetup: process.env.VITEST_UNIT
			? undefined
			: "./src/__tests__/global-setup.ts",
		// Include co-located test files
		include: ["src/**/*.{test,spec}.ts", "src/plugins/**/*.{test,spec}.ts"],
		// Exclude unit tests when not in unit mode (E2E is default)
		exclude: process.env.VITEST_UNIT
			? ["**/node_modules/**", "**/dist/**", "**/*.e2e.test.ts"]
			: ["**/node_modules/**", "**/dist/**"],
	},
	resolve: {
		alias: {
			"@": join(__dirname, "src"),
			"@tests": join(__dirname, "src/__tests__"),
		},
	},
});
