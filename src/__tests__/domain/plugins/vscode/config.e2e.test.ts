import { promises as fs } from "node:fs";
import { join } from "node:path";
import { describe, it } from "vitest";
import {
	assertDirectoryExists,
	assertFileExists,
	getE2ETestDir,
} from "../../../utils/test-utils.js";

/** E2E tests for VS Code plugin */
describe("VS Code Plugin E2E", () => {
	const testDir = getE2ETestDir();

	it("should create .vscode directory", () => {
		assertDirectoryExists(join(testDir, ".vscode"));
	});

	it("should create settings.json with content", async () => {
		const settingsPath = join(testDir, ".vscode", "settings.json");
		assertFileExists(settingsPath);
		const content = await fs.readFile(settingsPath, "utf-8");
		// Basic JSON validity check
		JSON.parse(content);
	});

	it("should create extensions.json with recommendations array", async () => {
		const extPath = join(testDir, ".vscode", "extensions.json");
		assertFileExists(extPath);
		const json = JSON.parse(await fs.readFile(extPath, "utf-8"));
		if (!Array.isArray(json.recommendations)) {
			throw new Error("extensions.json should contain recommendations array");
		}
	});
});
