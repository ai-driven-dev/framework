import { join } from "node:path";
import { describe, it } from "vitest";
import {
	assertDirectoryExists,
	assertFileExists,
	getE2ETestDir,
} from "../../../utils/test-utils.js";

describe("AIDD Framework E2E", () => {
	const testDir = getE2ETestDir();

	it("should copy core AIDD directories", () => {
		assertDirectoryExists(join(testDir, "aidd"));
		assertDirectoryExists(join(testDir, "aidd/.aidd"));
		assertDirectoryExists(join(testDir, "aidd/config"));
		assertDirectoryExists(join(testDir, "aidd/aidd_docs"));
		assertDirectoryExists(join(testDir, "aidd/ide"));
	});

	it("should copy IDE structure", () => {
		assertDirectoryExists(join(testDir, "aidd/ide/agents"));
		assertDirectoryExists(join(testDir, "aidd/ide/prompts"));
		assertDirectoryExists(join(testDir, "aidd/ide/rules"));
		assertDirectoryExists(join(testDir, "aidd/ide/skills"));
	});

	it("should copy root markdown files", () => {
		assertFileExists(testDir, "aidd/AGENTS.md");
		assertFileExists(testDir, "aidd/CONTRIBUTING.md");
		assertFileExists(testDir, "aidd/README.md");
	});

	it("should copy mcp configuration", () => {
		assertFileExists(testDir, "aidd/mcp.json");
	});

	it("should copy config structure", () => {
		assertDirectoryExists(join(testDir, "aidd/config/.claude"));
		assertDirectoryExists(join(testDir, "aidd/config/.vscode"));
	});
});
