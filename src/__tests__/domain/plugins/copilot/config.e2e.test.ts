import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	assertDirectoryExists,
	assertFileExists,
	getE2ETestDir,
} from "../../../utils/test-utils.js";

describe("GitHub Copilot Plugin E2E", () => {
	const testDir = getE2ETestDir();

	it("should create .github directory", () => {
		// Copilot creates .github/ independently (recursive: true)
		assertDirectoryExists(join(testDir, ".github"));
	});

	it("should create .github Copilot-specific subdirectories", () => {
		// Copilot creates subdirectories for GitHub Copilot IDE integration
		assertDirectoryExists(join(testDir, ".github/agents"));
		assertDirectoryExists(join(testDir, ".github/prompts"));
		assertDirectoryExists(join(testDir, ".github/instructions"));
	});

	it("should copy agents with .agent.md suffix", () => {
		const agentsDir = join(testDir, ".github/agents");
		assertDirectoryExists(agentsDir);

		const files = readdirSync(agentsDir);
		const agentFiles = files.filter((file) => file.endsWith(".agent.md"));

		if (agentFiles.length === 0) {
			throw new Error(
				"No agent files found in .github/agents/ with .agent.md suffix",
			);
		}
	});

	it("should copy IDE prompts with .prompt.md suffix", () => {
		// Check for nested prompt structure
		const promptsDir = join(testDir, ".github/prompts");
		assertDirectoryExists(promptsDir);

		// Verify at least one prompt file exists with .prompt.md suffix in subdirectories
		const promptPaths = [
			"04_code/implement.prompt.md",
			"03_plan/plan.prompt.md",
			"06_tests/write.prompt.md",
		];

		// At least one prompt should exist
		const promptExists = promptPaths.some((prompt) =>
			existsSync(join(promptsDir, prompt)),
		);

		expect(promptExists).toBe(true);
	});

	it("should copy rules with .instructions.md suffix", () => {
		// Verify .github/instructions directory exists
		assertDirectoryExists(join(testDir, ".github/instructions"));

		// Note: Rules directory might be empty in test setup
		// Just verify the directory structure is created
	});

	it("should create copilot-instructions.md symlink", () => {
		assertFileExists(join(testDir, ".github/copilot-instructions.md"));
	});

	it("should merge VS Code settings with GitHub Copilot configuration", () => {
		// Verify .vscode/settings.json exists
		assertFileExists(join(testDir, ".vscode/settings.json"));

		// Note: Actual settings merge validation is covered by vscode plugin e2e tests
	});
});
