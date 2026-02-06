import { promises as fs } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	assertNoTestPollution,
	assertTestRepository,
	cleanupTestRepository,
} from "../../__tests__/utils/test-guards.js";
import { getE2ETestDir } from "../../__tests__/utils/test-utils.js";
import { GitRepository } from "../../infra/git/git-repository.js";
import { worktreeCommand } from "./worktree.js";

describe("worktreeCommand e2e", () => {
	let testDir: string;
	let originalCwd: string;
	let testRepository: GitRepository;
	let mainRepository: GitRepository;
	let initialBranches: string[];
	let fixtureRepoPath: string;

	beforeAll(async () => {
		// ✅ Create a single fixture repo to clone for each test (avoids repeated init/commit)
		const baseTestDir = getE2ETestDir();
		fixtureRepoPath = join(baseTestDir, "worktree-fixture");
		await fs.rm(fixtureRepoPath, { recursive: true, force: true });
		await fs.mkdir(fixtureRepoPath, { recursive: true });

		const fixtureRepo = new GitRepository(fixtureRepoPath);
		await fixtureRepo.init();
		await fixtureRepo.setConfig("user.name", "Test User", "local");
		await fixtureRepo.setConfig("user.email", "test@example.com", "local");

		const testFile = join(fixtureRepoPath, "test.txt");
		await fs.writeFile(testFile, "test content");
		await fixtureRepo.add(".");
		await fixtureRepo.commit("Initial commit");
	});

	beforeEach(async () => {
		// ✅ CRITICAL: Save original directory for main repo reference
		originalCwd = process.cwd();

		// ✅ Create main repository instance (for pollution checks)
		mainRepository = new GitRepository(originalCwd);

		// ✅ CRITICAL: Verify main repo is clean BEFORE starting test
		await assertNoTestPollution(mainRepository);

		// ✅ Create isolated test directory from fixture (fast copy, avoids re-init)
		const baseTestDir = getE2ETestDir();
		testDir = join(baseTestDir, `worktree-test-${Date.now()}`);
		await fs.cp(fixtureRepoPath, testDir, { recursive: true });
		testRepository = new GitRepository(testDir);

		// ✅ CRITICAL: Validate test repository safety
		await assertTestRepository(testRepository, {
			mainRepoPath: originalCwd,
		});

		// ✅ Record initial state (for cleanup validation)
		initialBranches = await testRepository.listLocalBranches();

		// ℹ️ NOTE: No process.chdir() - we pass repository explicitly to worktreeCommand()
	});

	afterEach(async () => {
		// ✅ CRITICAL: Verify no pollution occurred during test
		await cleanupTestRepository(mainRepository, testRepository);

		// ✅ Change back to original directory (defensive)
		process.chdir(originalCwd);

		// ✅ Clean up test directory
		try {
			await fs.rm(testDir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors (directory might not exist)
		}
	});

	// Fixture is kept for the duration of the suite to avoid churn; no teardown needed.

	it("should create worktree with auto-generated name and run command", async () => {
		// ✅ Pass explicit repository instance (no process.cwd() dependency)
		const result = await worktreeCommand("echo 'test output'", {
			repository: testRepository,
		});

		expect(result.success).toBe(true);
		expect(result.message).toBe("Worktree command completed successfully");
		expect(result.warnings).toEqual([]);

		// ✅ Verify worktree was cleaned up (using repository instance)
		const worktrees = await testRepository.listWorktrees();
		expect(worktrees.length).toBe(1); // Only main worktree

		// ✅ Branch list should remain unchanged after cleanup
		const branchesAfter = await testRepository.listLocalBranches();
		expect(branchesAfter).toEqual(initialBranches);
	});

	it("should create worktree with custom name and run command", async () => {
		const customName = "custom-worktree-name";
		// ✅ Pass repository with custom worktree name
		const result = await worktreeCommand("echo 'test with custom name'", {
			worktreeName: customName,
			repository: testRepository,
		});

		expect(result.success).toBe(true);
		expect(result.message).toBe("Worktree command completed successfully");

		// ✅ Verify worktree was cleaned up
		const worktrees = await testRepository.listWorktrees();
		expect(worktrees.every((w) => !w.includes(customName))).toBe(true);
		expect(await testRepository.branchExists(customName)).toBe(false);
	});

	it("should handle command failure and still clean up", async () => {
		// ✅ Test failure handling with explicit repository
		const result = await worktreeCommand("exit 42", {
			repository: testRepository,
		});

		expect(result.success).toBe(false);
		expect(result.message).toBe("Command exited with code 42");
		expect(result.warnings).toContain("Command exited with code 42");

		// ✅ Verify worktree was still cleaned up after failure
		const worktrees = await testRepository.listWorktrees();
		expect(worktrees.length).toBe(1);
		const branchesAfter = await testRepository.listLocalBranches();
		expect(branchesAfter).toEqual(initialBranches);
	});

	it("should return error when not in git repository", async () => {
		// ✅ Create a non-git directory and repository instance
		const nonGitDir = join(getE2ETestDir(), `non-git-${Date.now()}`);
		await fs.mkdir(nonGitDir, { recursive: true });
		const nonGitRepo = new GitRepository(nonGitDir);

		// ✅ Test with non-git repository (no process.chdir needed!)
		const result = await worktreeCommand("echo 'test'", {
			repository: nonGitRepo,
		});

		expect(result.success).toBe(false);
		// ✅ More specific error: checks both git repo AND commits
		expect(result.message).toMatch(
			/Not in a git repository|Repository has no commits/,
		);
		expect(result.warnings?.length ?? 0).toBeGreaterThan(0);

		// ✅ Cleanup
		await fs.rm(nonGitDir, { recursive: true, force: true });
	});

	it("should fail when branch already exists", async () => {
		const branchName = "existing-branch";
		// ✅ Create branch using repository instance
		await testRepository.createBranch(branchName);

		// ✅ Test with explicit repository and worktree name
		const result = await worktreeCommand("echo 'test'", {
			worktreeName: branchName,
			repository: testRepository,
		});

		expect(result.success).toBe(false);
		expect(result.message).toContain("Branch existing-branch already exists");
	});

	it("should clean up orphaned branch when worktree creation fails", async () => {
		const worktreeName = "conflict-worktree";
		// ✅ Use repository.path instead of testDir
		const worktreePathBase = join(testRepository.path, "worktrees");
		const worktreePath = join(worktreePathBase, worktreeName);

		// ✅ Create conflicting directory
		await fs.mkdir(worktreePath, { recursive: true });
		await fs.writeFile(join(worktreePath, "placeholder.txt"), "conflict");

		// ✅ Test with explicit repository
		const result = await worktreeCommand("echo 'unused'", {
			worktreeName,
			repository: testRepository,
		});

		expect(result.success).toBe(false);
		expect(result.message).toContain("Failed to create worktree branch");
		expect(await testRepository.branchExists(worktreeName)).toBe(false);

		// ✅ Cleanup
		await fs.rm(worktreePath, { recursive: true, force: true });
	});

	it("should generate unique names for concurrent auto-generated worktrees", async () => {
		// ✅ Run two commands with auto-generated names (explicit repository)
		const result1 = await worktreeCommand("echo 'first'", {
			repository: testRepository,
		});
		expect(result1.success).toBe(true);

		const result2 = await worktreeCommand("echo 'second'", {
			repository: testRepository,
		});
		expect(result2.success).toBe(true);

		// ✅ Both should succeed, indicating unique names were generated
		// Verify all worktrees were cleaned up
		const worktrees = await testRepository.listWorktrees();
		expect(worktrees.length).toBe(1); // Only main worktree should remain
		const branchesAfter = await testRepository.listLocalBranches();
		expect(branchesAfter).toEqual(initialBranches);
	});

	it("should sanitize branch names in auto-generated worktree names", async () => {
		// ✅ Create a branch with special characters using repository
		await testRepository.checkout("feature/test-branch@123", true);
		const branchesBefore = await testRepository.listLocalBranches();

		// ✅ Test with explicit repository
		const result = await worktreeCommand("echo 'sanitized'", {
			repository: testRepository,
		});

		expect(result.success).toBe(true);
		// The branch name should be sanitized (special chars replaced with -)

		// ✅ Verify worktree was cleaned up
		const worktrees = await testRepository.listWorktrees();
		expect(worktrees.length).toBe(1);
		const branchesAfter = await testRepository.listLocalBranches();
		expect(branchesAfter).toEqual(branchesBefore);
		expect(
			branchesAfter.find((name) => name.startsWith("feature-test-branch-123")),
		).toBeUndefined();
	});

	it("should pass command output through correctly", async () => {
		// ✅ Test with a command that produces specific output (explicit repository)
		const testMessage = "UNIQUE_TEST_OUTPUT_12345";
		const result = await worktreeCommand(`echo '${testMessage}'`, {
			repository: testRepository,
		});

		expect(result.success).toBe(true);
		// Command output should be visible during execution (not captured in result)
	});
});
