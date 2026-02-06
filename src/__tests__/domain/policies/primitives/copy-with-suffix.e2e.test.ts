import { promises as fs } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { createDisplayService } from "../../../../app/ui/display.service.js";
import { CopyWithSuffixPolicy } from "../../../../domain/policies/primitives/copy-with-suffix.js";
import { FileSystemAdapter } from "../../../../infra/fs/file-system-adapter.js";
import {
	assertDirectoryExists,
	assertFileExists,
	assertRegularFile,
	getE2ETestDir,
} from "../../../utils/test-utils.js";

/**
 * E2E Tests for CopyWithSuffixPolicy
 * Tests file copying with suffix transformation for GitHub Copilot integration
 */
describe("CopyWithSuffixPolicy E2E", () => {
	const testDir = getE2ETestDir();

	/**
	 * Scenario 1: Basic copy with suffix transformation (flat directory)
	 * Tests core functionality with simple glob pattern
	 */
	it("should copy files with suffix transformation in flat directory", async () => {
		const policy = new CopyWithSuffixPolicy();
		const fsAdapter = new FileSystemAdapter();
		const display = createDisplayService("verbose");

		// Setup: Create test directory with sample files
		const baseDir = join(testDir, `copy-with-suffix-${Date.now()}-flat`);
		const sourceDir = join(baseDir, "source");
		const targetDir = join(baseDir, "target");

		await fs.mkdir(sourceDir, { recursive: true });
		await fs.writeFile(join(sourceDir, "dev.md"), "# Dev Agent", "utf-8");
		await fs.writeFile(join(sourceDir, "lead.md"), "# Lead Agent", "utf-8");
		await fs.writeFile(
			join(sourceDir, "checker.md"),
			"# Checker Agent",
			"utf-8",
		);

		// Execute: Copy with .agent suffix
		const result = await policy.execute({
			source: sourceDir,
			target: targetDir,
			options: { dryRun: false, verbose: false, force: false },
			fs: fsAdapter,
			display,
			verbosity: "normal",
			policyOptions: {
				suffix: ".agent",
				glob: "*.md",
			},
		});

		// Assert: Verify success and files copied with correct suffix
		expect(result.success).toBe(true);
		assertDirectoryExists(targetDir);

		assertFileExists(join(targetDir, "dev.agent.md"));
		assertFileExists(join(targetDir, "lead.agent.md"));
		assertFileExists(join(targetDir, "checker.agent.md"));

		// Verify files are regular files (not symlinks)
		assertRegularFile(join(targetDir, "dev.agent.md"));
		assertRegularFile(join(targetDir, "lead.agent.md"));
		assertRegularFile(join(targetDir, "checker.agent.md"));

		// Verify content is preserved
		const copiedContent = await fs.readFile(
			join(targetDir, "dev.agent.md"),
			"utf-8",
		);
		expect(copiedContent).toBe("# Dev Agent");
	});

	/**
	 * Scenario 2: Recursive directory traversal with nested structure
	 * Tests **\/*.md pattern and directory structure preservation
	 */
	it("should copy files recursively preserving directory structure", async () => {
		const policy = new CopyWithSuffixPolicy();
		const fsAdapter = new FileSystemAdapter();
		const display = createDisplayService("verbose");

		// Setup: Create nested directory structure
		const baseDir = join(testDir, `copy-with-suffix-${Date.now()}-recursive`);
		const sourceDir = join(baseDir, "source");
		const targetDir = join(baseDir, "target");

		// Create nested structure: source/01_onboard/plan.md, source/04_code/implement.md
		await fs.mkdir(join(sourceDir, "01_onboard"), { recursive: true });
		await fs.mkdir(join(sourceDir, "04_code"), { recursive: true });
		await fs.mkdir(join(sourceDir, "06_tests"), { recursive: true });

		await fs.writeFile(
			join(sourceDir, "01_onboard", "plan.md"),
			"# Plan Prompt",
			"utf-8",
		);
		await fs.writeFile(
			join(sourceDir, "04_code", "implement.md"),
			"# Implement Prompt",
			"utf-8",
		);
		await fs.writeFile(
			join(sourceDir, "06_tests", "write.md"),
			"# Write Tests Prompt",
			"utf-8",
		);

		// Execute: Copy recursively with .prompt suffix
		const result = await policy.execute({
			source: sourceDir,
			target: targetDir,
			options: { dryRun: false, verbose: false, force: false },
			fs: fsAdapter,
			display,
			verbosity: "normal",
			policyOptions: {
				suffix: ".prompt",
				glob: "**/*.md",
			},
		});

		// Assert: Verify success and nested structure preserved
		expect(result.success).toBe(true);
		assertDirectoryExists(targetDir);

		// Verify nested directories created
		assertDirectoryExists(join(targetDir, "01_onboard"));
		assertDirectoryExists(join(targetDir, "04_code"));
		assertDirectoryExists(join(targetDir, "06_tests"));

		// Verify files copied with correct suffix in nested directories
		assertFileExists(join(targetDir, "01_onboard", "plan.prompt.md"));
		assertFileExists(join(targetDir, "04_code", "implement.prompt.md"));
		assertFileExists(join(targetDir, "06_tests", "write.prompt.md"));

		// Verify content preserved
		const content = await fs.readFile(
			join(targetDir, "04_code", "implement.prompt.md"),
			"utf-8",
		);
		expect(content).toBe("# Implement Prompt");
	});

	/**
	 * Scenario 3: Empty source handling (no matching files)
	 * Tests graceful handling when no files match the glob pattern
	 */
	it("should handle empty source with warning (no matching files)", async () => {
		const policy = new CopyWithSuffixPolicy();
		const fsAdapter = new FileSystemAdapter();
		const display = createDisplayService("verbose");

		// Setup: Create empty directory
		const baseDir = join(testDir, `copy-with-suffix-${Date.now()}-empty`);
		const sourceDir = join(baseDir, "source");
		const targetDir = join(baseDir, "target");

		await fs.mkdir(sourceDir, { recursive: true });
		// No files created - empty directory

		// Execute: Try to copy with no matching files
		const result = await policy.execute({
			source: sourceDir,
			target: targetDir,
			options: { dryRun: false, verbose: false, force: false },
			fs: fsAdapter,
			display,
			verbosity: "normal",
			policyOptions: {
				suffix: ".test",
				glob: "*.md",
			},
		});

		// Assert: Should succeed with warning
		expect(result.success).toBe(true);
		expect(result.warnings.length).toBeGreaterThan(0);
		expect(result.warnings[0]).toContain("No files matching");
	});

	/**
	 * Scenario 4: Suffix insertion accuracy (before extension)
	 * Tests that suffix is correctly placed before the file extension
	 */
	it("should insert suffix before extension, not at end", async () => {
		const policy = new CopyWithSuffixPolicy();
		const fsAdapter = new FileSystemAdapter();
		const display = createDisplayService("verbose");

		// Setup: Create files with various naming patterns
		const baseDir = join(
			testDir,
			`copy-with-suffix-${Date.now()}-suffix-accuracy`,
		);
		const sourceDir = join(baseDir, "source");
		const targetDir = join(baseDir, "target");

		await fs.mkdir(sourceDir, { recursive: true });

		// Test various file naming patterns
		await fs.writeFile(join(sourceDir, "simple.md"), "# Simple", "utf-8");
		await fs.writeFile(
			join(sourceDir, "complex.name.md"),
			"# Complex Name",
			"utf-8",
		);
		await fs.writeFile(join(sourceDir, "with-dash.md"), "# With Dash", "utf-8");

		// Execute: Copy with .instructions suffix
		const result = await policy.execute({
			source: sourceDir,
			target: targetDir,
			options: { dryRun: false, verbose: false, force: false },
			fs: fsAdapter,
			display,
			verbosity: "normal",
			policyOptions: {
				suffix: ".instructions",
				glob: "*.md",
			},
		});

		// Assert: Verify suffix placed before extension
		expect(result.success).toBe(true);

		// Verify: simple.md → simple.instructions.md (NOT simple.md.instructions)
		assertFileExists(join(targetDir, "simple.instructions.md"));

		// Verify: complex.name.md → complex.name.instructions.md
		assertFileExists(join(targetDir, "complex.name.instructions.md"));

		// Verify: with-dash.md → with-dash.instructions.md
		assertFileExists(join(targetDir, "with-dash.instructions.md"));

		// Ensure incorrect naming doesn't exist
		expect(fsAdapter.exists(join(targetDir, "simple.md.instructions"))).toBe(
			false,
		);
		expect(
			fsAdapter.exists(join(targetDir, "complex.name.md.instructions")),
		).toBe(false);
	});
});
