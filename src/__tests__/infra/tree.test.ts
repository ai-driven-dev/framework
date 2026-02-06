import { execSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("tree.sh output paths", () => {
	const repoRoot = join(process.cwd(), "..");
	const treeScript = join(repoRoot, "cli", "assets", "scripts", "tree.sh");
	const outputFile = join(repoRoot, "docs", "trees", "rules-tree-test.txt");

	it("generates relative paths for in-repo directories", () => {
		// Skip test gracefully if `tree` binary is not available
		try {
			execSync("tree --version", { stdio: "ignore" });
		} catch {
			// eslint-disable-next-line no-console
			console.warn("⚠️  'tree' binary not found, skipping tree.sh test");
			return;
		}

		const scanDir = join(repoRoot, "docs", "rules");

		execSync(
			`bash "${treeScript}" --scan-dir "${scanDir}" --output-file "${outputFile}"`,
			{ cwd: repoRoot },
		);

		const content = readFileSync(outputFile, "utf-8");

		// Should not contain absolute repository path
		expect(content.includes(repoRoot)).toBe(false);

		// Header should be present with date and relative path
		const lines = content.split("\n");
		const headerLine = lines[0];
		expect(headerLine).toMatch(/^## \d{4}-\d{2}-\d{2}: Tree of project `/);

		// Tree content should start after header and blank line (line 2)
		// Top-level directory should be relative (e.g., "docs/rules" or ".")
		const firstTreeLine = lines[2];
		expect(
			firstTreeLine === "." ||
				firstTreeLine === "docs/rules/" ||
				firstTreeLine === "docs/rules" ||
				firstTreeLine === "rules" ||
				firstTreeLine === "rules/",
		).toBe(true);

		// Cleanup
		rmSync(outputFile, { force: true });
	});
});
