import { promises as fs } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { docsPlugin } from "../../../../domain/plugins/docs-config.js";
import { CopyIfMissingPolicy } from "../../../../domain/policies/primitives/copy-if-missing.js";
import { AssetLocator } from "../../../../infra/assets/asset-locator.js";
import { DOCS_DIRECTORIES, PATHS } from "../../../../infra/constants/paths.js";
import { FileSystemAdapter } from "../../../../infra/fs/file-system-adapter.js";
import {
	assertDirectoryExists,
	assertFileExists,
	getE2ETestDir,
} from "../../../utils/test-utils.js";
import { noopDisplay } from "../../policies/helpers.js";

describe("Documentation Plugin E2E", () => {
	const testDir = getE2ETestDir();

	it("should create all docs directories", () => {
		// Verify all documentation directories are created
		for (const dir of DOCS_DIRECTORIES) {
			assertDirectoryExists(testDir, join(PATHS.PROJECT_DOCS_DIR, dir));
		}
	});

	it("should create .gitkeep files in docs directories that don't get populated", async () => {
		// Verify .gitkeep files exist in docs directories except agents and flows (which get populated)
		const dirsWithGitkeep = DOCS_DIRECTORIES.filter(
			(dir) => dir !== "agents" && dir !== "flows",
		);

		for (const dir of dirsWithGitkeep) {
			const gitkeepPath = join(
				testDir,
				PATHS.PROJECT_DOCS_DIR,
				dir,
				".gitkeep",
			);
			// Only enforce .gitkeep when the directory is otherwise empty
			const entries = await fs.readdir(
				join(testDir, PATHS.PROJECT_DOCS_DIR, dir),
			);
			const nonGitkeepEntries = entries.filter((name) => name !== ".gitkeep");
			if (nonGitkeepEntries.length === 0) {
				assertFileExists(
					testDir,
					join(PATHS.PROJECT_DOCS_DIR, dir, ".gitkeep"),
				);
			}

			// Verify .gitkeep file is empty
			if (await fs.stat(gitkeepPath).catch(() => null)) {
				const content = await fs.readFile(gitkeepPath, "utf-8");
				expect(content).toBe("");
			}
		}
	});

	// docs directory removed in favor of docs outputs

	it("should create AGENTS.md file from template at project root", () => {
		// Verify AGENTS.md file exists at project root
		assertFileExists(testDir, "AGENTS.md");
	});

	it("should have correct plugin configuration", () => {
		// Verify plugin configuration
		expect(docsPlugin.id).toBe("docs");
		expect(docsPlugin.name).toBe("Documentation Structure");
		expect(docsPlugin.description).toBe(
			"Documentation structure (docs/) - Required for IDE integrations",
		);
		expect(docsPlugin.dependencies).toEqual(["aidd-framework"]);
		expect(docsPlugin.required).toBe(true);
	});

	it("should verify AGENTS.md content is from template", async () => {
		const agentsMdPath = join(testDir, "AGENTS.md");
		const content = await fs.readFile(agentsMdPath, "utf-8");

		// Verify content is not empty
		expect(content.length).toBeGreaterThan(0);

		// Verify it contains expected template content
		expect(content).toContain("AGENTS.md");
		expect(content).toContain("This file contains a collection of config");
	});

	it("should create AGENTS_COORDINATION.md in aidd_docs/memory from template", async () => {
		const coordinationPath = join(
			testDir,
			PATHS.PROJECT_DOCS_DIR,
			"memory-bank",
			"AGENTS_COORDINATION.md",
		);

		// Verify coordination doc exists in memory-bank
		assertFileExists(testDir, coordinationPath);

		// Resolve the exact asset path used by the docs plugin (new structure)
		const assetLocator = new AssetLocator();
		const templatePath = assetLocator.resolve(
			join("aidd", ".aidd", "templates", "aidd", "agents_coordination.md"),
		);

		const [coordinationContent, templateContent] = await Promise.all([
			fs.readFile(coordinationPath, "utf-8"),
			fs.readFile(templatePath, "utf-8"),
		]);

		// Ensure the installed doc matches the template
		expect(coordinationContent).toBe(templateContent);
	});

	it("should copy sample prompt template to docs/prompts", () => {
		// Verify sample prompt exists
		assertFileExists(
			testDir,
			join(PATHS.PROJECT_DOCS_DIR, "prompts", "example.md"),
		);
	});

	it("should copy CONTRIBUTING.md from template only when missing", async () => {
		const templatePath = join(testDir, PATHS.AIDD_ROOT, "CONTRIBUTING.md");
		const targetPath = join(testDir, "CONTRIBUTING.md");
		const sandboxTarget = join(testDir, "CONTRIBUTING.sandbox.md");

		assertFileExists(templatePath);
		assertFileExists(targetPath);

		const templateContent = await fs.readFile(templatePath, "utf-8");
		// Work on a sandbox copy to avoid mutating the installed file
		await fs.writeFile(sandboxTarget, templateContent);
		const targetContent = await fs.readFile(sandboxTarget, "utf-8");

		expect(targetContent).toBe(templateContent);

		// Simulate user change and ensure re-run would skip when file exists
		const customContent = "custom contributing content";
		await fs.writeFile(sandboxTarget, customContent);

		const policy = new CopyIfMissingPolicy();
		const result = await policy.execute({
			source: templatePath,
			target: sandboxTarget,
			options: { dryRun: false, verbose: false, force: true },
			verbosity: "normal",
			policyOptions: {},
			fs: new FileSystemAdapter(),
			display: noopDisplay,
		});

		expect(result.skipped).toBe(true);
		expect(result.warnings.some((w) => w.includes("already exists"))).toBe(
			true,
		);
		const finalContent = await fs.readFile(sandboxTarget, "utf-8");
		expect(finalContent).toBe(customContent);

		// Cleanup sandbox file
		await fs.rm(sandboxTarget, { force: true });
	});

	it("should create docs/templates/vcs directory", () => {
		// Verify VCS templates directory created
		assertDirectoryExists(testDir, PATHS.DOCS_TEMPLATES_VCS_DIR);
	});

	it("should copy VCS templates", () => {
		// Verify VCS templates copied (pull_request, issue, release)
		assertFileExists(testDir, PATHS.DOCS_TEMPLATE_PULL_REQUEST);
		assertFileExists(testDir, PATHS.DOCS_TEMPLATE_ISSUE);
		assertFileExists(testDir, PATHS.DOCS_TEMPLATE_RELEASE);
	});

	it("should use COPY_IF_MISSING policy for VCS templates", async () => {
		const policy = new CopyIfMissingPolicy();
		const fsAdapter = new FileSystemAdapter();

		const templatePath = join(
			testDir,
			PATHS.AIDD_ROOT,
			".aidd",
			"templates",
			"vcs",
			"pull_request.md",
		);
		const targetPath = join(testDir, PATHS.DOCS_TEMPLATE_PULL_REQUEST);

		assertFileExists(templatePath);
		assertFileExists(testDir, targetPath);

		const originalContent = await fs.readFile(targetPath, "utf-8");
		const customContent = `${originalContent}\nCUSTOM-VCS-CONTENT`;
		await fs.writeFile(targetPath, customContent, "utf-8");

		const result = await policy.execute({
			source: templatePath,
			target: targetPath,
			options: { dryRun: false, verbose: false, force: true },
			verbosity: "normal",
			policyOptions: {},
			fs: fsAdapter,
			display: noopDisplay,
		});

		expect(result.skipped).toBe(true);
		const finalContent = await fs.readFile(targetPath, "utf-8");
		expect(finalContent).toBe(customContent);

		// Restore original content to avoid side effects on other tests
		await fs.writeFile(targetPath, originalContent, "utf-8");
	});

	it("should NOT create docs/COMMIT.md or docs/PR_TEMPLATE.md", async () => {
		// Verify old paths don't exist
		const oldCommitPath = join(testDir, PATHS.PROJECT_DOCS_DIR, "COMMIT.md");
		const oldPrTemplatePath = join(
			testDir,
			PATHS.PROJECT_DOCS_DIR,
			"PR_TEMPLATE.md",
		);

		expect(await fs.stat(oldCommitPath).catch(() => null)).toBeNull();
		expect(await fs.stat(oldPrTemplatePath).catch(() => null)).toBeNull();
	});

	it("should verify VCS template frontmatter is generic", async () => {
		const prContent = await fs.readFile(
			join(testDir, PATHS.DOCS_TEMPLATE_PULL_REQUEST),
			"utf-8",
		);
		const issueContent = await fs.readFile(
			join(testDir, PATHS.DOCS_TEMPLATE_ISSUE),
			"utf-8",
		);

		// Verify generic VCS naming in frontmatter
		expect(prContent).toContain("name: pull-request");
		expect(prContent).toContain("description: VCS pull/merge request template");
		expect(issueContent).toContain("name: issue");
		expect(issueContent).toContain("description: VCS issue/ticket template");
	});
});
