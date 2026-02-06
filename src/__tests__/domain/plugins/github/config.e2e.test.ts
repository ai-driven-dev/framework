import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { githubPlugin } from "../../../../domain/plugins/github-config.js";
import {
	assertDirectoryExists,
	assertSymlinkExists,
	getE2ETestDir,
} from "../../../utils/test-utils.js";

describe("GitHub VCS Plugin E2E", () => {
	const testDir = getE2ETestDir();

	it("should create .github directory", () => {
		assertDirectoryExists(join(testDir, ".github"));
	});

	it("should create .github/ISSUE_TEMPLATE directory (GitHub 2025 convention)", () => {
		assertDirectoryExists(join(testDir, ".github/ISSUE_TEMPLATE"));
	});

	it("should create PR template symlink", () => {
		assertSymlinkExists(join(testDir, ".github/pull_request_template.md"));
	});

	it("should create bug report template symlink", () => {
		assertSymlinkExists(join(testDir, ".github/ISSUE_TEMPLATE/bug_report.md"));
	});

	it("should create feature request template symlink", () => {
		assertSymlinkExists(
			join(testDir, ".github/ISSUE_TEMPLATE/feature_request.md"),
		);
	});

	it("should have correct plugin configuration", () => {
		expect(githubPlugin.id).toBe("github");
		expect(githubPlugin.name).toBe("GitHub VCS Integration");
		expect(githubPlugin.description).toBe(
			"GitHub VCS template symlinks (.github/)",
		);
		expect(githubPlugin.dependencies).toEqual(["docs"]);
		expect(githubPlugin.required).toBeUndefined();
	});
});
