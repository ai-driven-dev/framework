import { resolve } from "node:path";
import type { GitRepository } from "../../infra/git/git-repository.js";

/**
 * Test safety guards to prevent main repository pollution
 */

/**
 * Check if a git config value looks like test data
 * @param value - Config value to check
 * @returns True if value appears to be test data
 */
export function looksLikeTestConfig(value: string): boolean {
	const testPatterns = [
		/test/i,
		/example\.com/i,
		/dummy/i,
		/fake/i,
		/mock/i,
		/worktree.*test/i,
	];

	return testPatterns.some((pattern) => pattern.test(value));
}

/**
 * Assert that a repository is safe for test operations
 * This prevents accidentally running tests against the main project repository
 *
 * @param repository - Repository to validate
 * @param mainRepoIndicators - Paths or markers that identify the main repo
 * @throws Error if repository appears to be the main project repo
 */
export async function assertTestRepository(
	repository: GitRepository,
	mainRepoIndicators: {
		/** Path to the main repository (e.g., process.cwd() at test start) */
		mainRepoPath?: string;
		/** Files that should exist in main repo but not test repo */
		mainRepoMarkers?: string[];
	} = {},
): Promise<void> {
	const repoPath = repository.path;

	// Check 1: If E2E_TEST_DIR is set, repo must be under it
	if (process.env.E2E_TEST_DIR) {
		const testDirRoot = resolve(process.env.E2E_TEST_DIR);
		if (!repoPath.startsWith(testDirRoot)) {
			throw new Error(
				`❌ CRITICAL: Repository not under E2E_TEST_DIR!\nRepository: ${repoPath}\nE2E_TEST_DIR: ${testDirRoot}\nThis could be the main project repository!`,
			);
		}
	}

	// Check 2: Repository path should contain test indicators
	const pathHasTestIndicator =
		repoPath.includes("/output-tests/") ||
		repoPath.includes("/test-") ||
		repoPath.includes("/worktree-test-") ||
		repoPath.includes("/e2e-") ||
		repoPath.includes("/.tmp/");

	if (!pathHasTestIndicator) {
		throw new Error(
			`❌ CRITICAL: Repository path doesn't look like a test directory!\nRepository: ${repoPath}\nExpected path to contain: output-tests/, test-, worktree-test-, e2e-, or .tmp/\nThis could be the main project repository!`,
		);
	}

	// Check 3: If mainRepoPath provided, ensure they're different
	if (mainRepoIndicators.mainRepoPath) {
		const absMainRepoPath = resolve(mainRepoIndicators.mainRepoPath);
		if (repoPath === absMainRepoPath) {
			throw new Error(
				`❌ CRITICAL: Test repository is the same as main repository!\nRepository: ${repoPath}\nMain repo: ${absMainRepoPath}`,
			);
		}

		// Also check if repo is under main repo but not in a test dir
		if (repoPath.startsWith(absMainRepoPath) && !pathHasTestIndicator) {
			throw new Error(
				`❌ CRITICAL: Repository is under main repo but not in a test directory!\nRepository: ${repoPath}\nMain repo: ${absMainRepoPath}\nThis could lead to git config pollution.`,
			);
		}
	}

	// Check 4: Repository must be a valid git repo
	if (!(await repository.isGitRepository())) {
		throw new Error(
			`❌ Repository is not a valid git repository: ${repoPath}\nRun 'git init' first.`,
		);
	}

	// Check 5: Check git config for test-like values (warning, not error)
	try {
		const userName = await repository.getConfig("user.name", "local");
		const userEmail = await repository.getConfig("user.email", "local");

		if (userName && !looksLikeTestConfig(userName)) {
			console.warn(
				`⚠️  Warning: Test repository has non-test user.name: "${userName}"`,
			);
		}

		if (userEmail && !looksLikeTestConfig(userEmail)) {
			console.warn(
				`⚠️  Warning: Test repository has non-test user.email: "${userEmail}"`,
			);
		}
	} catch {
		// Config not set, that's fine
	}
}

/**
 * Assert that the main repository has not been polluted with test config
 *
 * @param repository - Main repository to check
 * @throws Error if repository has test-like git config values
 */
export async function assertNoTestPollution(
	repository: GitRepository,
): Promise<void> {
	const repoPath = repository.path;

	// Only check if we can access git config
	if (!(await repository.isGitRepository())) {
		return; // Not a git repo, nothing to check
	}

	try {
		const userName = await repository.getConfig("user.name", "local");
		const userEmail = await repository.getConfig("user.email", "local");

		const issues: string[] = [];

		if (userName && looksLikeTestConfig(userName)) {
			issues.push(`user.name = "${userName}"`);
		}

		if (userEmail && looksLikeTestConfig(userEmail)) {
			issues.push(`user.email = "${userEmail}"`);
		}

		if (issues.length > 0) {
			throw new Error(
				`❌ CRITICAL: Main repository has been polluted with test config!\nRepository: ${repoPath}\nPolluted config:\n${issues.map((issue) => `  - ${issue}`).join("\n")}\n\nClean up with:\n  git config --unset user.name\n  git config --unset user.email`,
			);
		}
	} catch (error) {
		// If error is from our check above, re-throw it
		if ((error as Error).message.includes("CRITICAL")) {
			throw error;
		}
		// Otherwise, config read failed - that's fine
	}
}

/**
 * Create a cleanup hook for tests to ensure no pollution
 * Call this in test afterEach hooks
 *
 * @param mainRepository - Main project repository
 * @param testRepository - Test repository
 */
export async function cleanupTestRepository(
	mainRepository: GitRepository,
	testRepository: GitRepository,
): Promise<void> {
	// First check test repo didn't pollute main repo
	await assertNoTestPollution(mainRepository);

	// Clean up test repo's config if it somehow has non-test values
	try {
		const userName = await testRepository.getConfig("user.name", "local");
		const userEmail = await testRepository.getConfig("user.email", "local");

		// If test repo has non-test values, remove them
		if (userName && !looksLikeTestConfig(userName)) {
			await testRepository.unsetConfig("user.name", "local");
			console.warn(
				`🧹 Cleaned non-test user.name from test repo: "${userName}"`,
			);
		}

		if (userEmail && !looksLikeTestConfig(userEmail)) {
			await testRepository.unsetConfig("user.email", "local");
			console.warn(
				`🧹 Cleaned non-test user.email from test repo: "${userEmail}"`,
			);
		}
	} catch {
		// Config operations failed, ignore
	}
}
