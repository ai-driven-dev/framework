import { readlinkSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
	assertDirectoryExists,
	assertFileExists,
	assertSymlinkExists,
	getE2ETestDir,
} from "../../../utils/test-utils.js";

describe("Claude Code Plugin E2E", () => {
	const testDir = getE2ETestDir();

	it("should create .claude/commands directory structure", () => {
		// Commands directory exists
		assertDirectoryExists(testDir, ".claude/commands");

		// IDE commands symlink
		assertSymlinkExists(join(testDir, ".claude/commands/ide"));

		// Flows symlink (created when docs are enabled)
		assertSymlinkExists(join(testDir, ".claude/commands/flows"));
	});

	it("should create .claude/agents symlink to docs/agents", () => {
		// Verify .claude/agents is a symlink
		assertSymlinkExists(join(testDir, ".claude/agents"));

		// Verify agents directory was created via docs plugin
		assertDirectoryExists(join(testDir, "docs/agents"));
	});

	it("should create settings.json", () => {
		// settings.json exists (merged from template)
		assertFileExists(join(testDir, ".claude/settings.json"));
	});

	it("should copy mcp.json configuration", () => {
		// mcp.json exists (copied from framework)
		assertFileExists(join(testDir, ".claude/mcp.json"));
	});

	it("should create CLAUDE.md symlink to AGENTS.md at project root", () => {
		// CLAUDE.md symlink exists and points to AGENTS.md at project root
		assertSymlinkExists(join(testDir, "CLAUDE.md"));

		// Verify it points to AGENTS.md at project root (relative symlink)
		const linkTarget = readlinkSync(join(testDir, "CLAUDE.md"));
		const resolvedTarget = resolve(testDir, linkTarget);
		expect(resolvedTarget).toBe(join(testDir, "AGENTS.md"));

		// Verify target exists
		assertFileExists(testDir, "AGENTS.md");
	});

	it("should create custom prompts symlink pointing to docs/prompts", () => {
		// Custom prompts symlink exists
		assertSymlinkExists(join(testDir, ".claude/commands/custom"));

		// Verify prompts directory was created
		assertDirectoryExists(testDir, "docs/prompts");

		// Verify sample prompt exists
		assertFileExists(testDir, "docs/prompts/example.md");
	});

	it("should use relative symlinks for Claude Code directories", () => {
		const symlinks = [
			".claude/agents",
			".claude/commands/ide",
			".claude/commands/flows",
			".claude/commands/custom",
		];

		for (const relativePath of symlinks) {
			const fullPath = join(testDir, relativePath);
			assertSymlinkExists(fullPath);
			const target = readlinkSync(fullPath);
			expect(isAbsolute(target)).toBe(false);
		}
	});
});
