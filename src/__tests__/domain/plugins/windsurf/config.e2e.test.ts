import { join } from "node:path";
import { describe, it } from "vitest";
import {
	assertDirectoryExists,
	assertFileExists,
	assertSymlinkExists,
	getE2ETestDir,
} from "../../../utils/test-utils.js";

describe("Windsurf Plugin E2E", () => {
	const testDir = getE2ETestDir();

	it("should create .windsurf directory", () => {
		assertDirectoryExists(testDir, ".windsurf");
	});

	it("should create rules symlink to docs/rules", () => {
		assertSymlinkExists(join(testDir, ".windsurf/rules"));

		// Verify target directory exists (created by docs plugin)
		assertDirectoryExists(testDir, "docs/rules");
	});

	it("should create global_rules.md symlink to AGENTS.md at project root", () => {
		const linkPath = join(testDir, ".windsurf/global_rules.md");
		assertSymlinkExists(linkPath, "AGENTS.md");
		assertFileExists(testDir, "AGENTS.md");
	});
});
