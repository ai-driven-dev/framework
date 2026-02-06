import { join } from "node:path";
import { describe, it } from "vitest";
import {
	assertDirectoryExists,
	assertFileExists,
	assertSymlinkExists,
	getE2ETestDir,
} from "../../../utils/test-utils.js";

describe("Cursor Plugin E2E", () => {
	const testDir = getE2ETestDir();
	it("should create .cursor directory", () => {
		assertDirectoryExists(join(testDir, ".cursor"));
	});

	it("should create docs/rules directory before symlink on fresh projects", () => {
		// Verify docs/rules directory was created (pre-requirement for symlink)
		assertDirectoryExists(join(testDir, "docs/rules"));

		// Verify .gitkeep file exists to maintain directory in git
		assertFileExists(join(testDir, "docs/rules/.gitkeep"));
	});

	it("should create rules symlink to docs/rules", () => {
		assertSymlinkExists(join(testDir, ".cursor/rules"));
	});

	it("should create .cursor/commands directory", () => {
		assertDirectoryExists(join(testDir, ".cursor/commands"));
	});

	it("should create ide symlink to aidd/ide/prompts", () => {
		assertSymlinkExists(join(testDir, ".cursor/commands/ide"));
	});

	it("should create flows symlink to docs/flows", () => {
		assertSymlinkExists(join(testDir, ".cursor/commands/flows"));
	});

	it("should create prompts symlink to docs/prompts", () => {
		assertSymlinkExists(join(testDir, ".cursor/commands/prompts"));
	});
});
