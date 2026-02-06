import { exec } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";

const execAsync = promisify(exec);

/**
 * GitRepository encapsulates all git operations for a specific repository.
 * This ensures operations never leak to other repositories by mistake.
 *
 * Design guarantees:
 * - All git operations explicitly scoped to repoPath
 * - No dependency on process.cwd()
 * - Validation prevents operating on wrong repository
 * - Test isolation: impossible to pollute main repo
 */
export class GitRepository {
	readonly #repoPath: string;

	/**
	 * Create a GitRepository instance for a specific path.
	 * @param repoPath - Absolute path to the git repository
	 * @throws Error if path is not a valid git repository
	 */
	constructor(repoPath: string) {
		this.#repoPath = resolve(repoPath);

		// Validation happens lazily in operations to support both:
		// - CLI: repo already exists
		// - Tests: repo created after instance construction
	}

	/**
	 * Get the repository path
	 */
	get path(): string {
		return this.#repoPath;
	}

	/**
	 * Execute a git command in this repository
	 * @param command - Git command to execute
	 * @returns Command output
	 */
	async #exec(command: string): Promise<{ stdout: string; stderr: string }> {
		return execAsync(command, { cwd: this.#repoPath });
	}

	/**
	 * Check if this path is a valid git repository
	 * @returns True if valid git repo, false otherwise
	 */
	async isGitRepository(): Promise<boolean> {
		try {
			const { stdout } = await this.#exec("git rev-parse --git-dir");
			// Ensure the git dir actually belongs to this path, not a parent repo
			const gitDir = resolve(this.#repoPath, stdout.trim());
			return gitDir === resolve(this.#repoPath, ".git");
		} catch {
			return false;
		}
	}

	/**
	 * Check if repository has at least one commit
	 * @returns True if repo has commits
	 */
	async hasCommits(): Promise<boolean> {
		try {
			await this.#exec("git rev-parse HEAD");
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Get the absolute path to the .git directory
	 * @returns Path to .git directory
	 */
	async getGitDir(): Promise<string> {
		const { stdout } = await this.#exec("git rev-parse --git-dir");
		return resolve(this.#repoPath, stdout.trim());
	}

	/**
	 * Get the repository root directory (top-level)
	 * @returns Absolute path to repository root
	 */
	async getTopLevel(): Promise<string> {
		const { stdout } = await this.#exec("git rev-parse --show-toplevel");
		return stdout.trim();
	}

	/**
	 * Get current branch name
	 * @returns Current branch name
	 */
	async getCurrentBranch(): Promise<string> {
		const { stdout } = await this.#exec("git rev-parse --abbrev-ref HEAD");
		return stdout.trim();
	}

	/**
	 * Check if a local branch exists
	 * @param branchName - Branch name to check
	 * @returns True if branch exists
	 */
	async branchExists(branchName: string): Promise<boolean> {
		try {
			await this.#exec(
				`git show-ref --verify --quiet "refs/heads/${branchName}"`,
			);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * List all local branches
	 * @returns Array of branch names
	 */
	async listLocalBranches(): Promise<string[]> {
		const { stdout } = await this.#exec(
			"git for-each-ref --format='%(refname:short)' refs/heads/",
		);
		return stdout
			.split("\n")
			.map((line) => line.trim())
			.filter(Boolean);
	}

	/**
	 * Force delete a local branch
	 * @param branchName - Branch name to delete
	 */
	async deleteBranch(branchName: string): Promise<void> {
		try {
			await this.#exec(`git branch -D "${branchName}"`);
		} catch (error) {
			throw new Error(
				`Failed to delete branch ${branchName}: ${(error as Error).message}`,
			);
		}
	}

	/**
	 * Get git config value
	 * @param key - Config key (e.g., "user.name")
	 * @param scope - Config scope: "local", "global", or "system"
	 * @returns Config value or empty string if not set
	 */
	async getConfig(
		key: string,
		scope: "local" | "global" | "system" = "local",
	): Promise<string> {
		try {
			const { stdout } = await this.#exec(`git config --${scope} ${key}`);
			return stdout.trim();
		} catch {
			return "";
		}
	}

	/**
	 * Set git config value
	 * @param key - Config key (e.g., "user.name")
	 * @param value - Config value
	 * @param scope - Config scope: "local", "global", or "system"
	 */
	async setConfig(
		key: string,
		value: string,
		scope: "local" | "global" | "system" = "local",
	): Promise<void> {
		await this.#exec(`git config --${scope} "${key}" "${value}"`);
	}

	/**
	 * Unset git config value
	 * @param key - Config key to unset
	 * @param scope - Config scope: "local", "global", or "system"
	 */
	async unsetConfig(
		key: string,
		scope: "local" | "global" | "system" = "local",
	): Promise<void> {
		try {
			await this.#exec(`git config --${scope} --unset ${key}`);
		} catch {
			// Config key doesn't exist, ignore
		}
	}

	/**
	 * Create a worktree
	 * @param worktreePath - Absolute path where worktree will be created
	 * @param branchName - Branch name for the worktree
	 */
	async createWorktree(
		worktreePath: string,
		branchName: string,
	): Promise<void> {
		await this.#exec(
			`git worktree add -b "${branchName}" "${worktreePath}" HEAD`,
		);
	}

	/**
	 * Remove a worktree
	 * @param worktreePath - Absolute path to the worktree
	 * @param force - Force removal even if worktree is dirty
	 */
	async removeWorktree(worktreePath: string, force = true): Promise<void> {
		const forceFlag = force ? "--force" : "";
		await this.#exec(`git worktree remove "${worktreePath}" ${forceFlag}`);
	}

	/**
	 * Initialize a new git repository at this path
	 * @returns This repository instance (for chaining)
	 */
	async init(): Promise<GitRepository> {
		await this.#exec("git init");
		return this;
	}

	/**
	 * Add files to staging
	 * @param pathspec - Files to add (e.g., "." for all)
	 */
	async add(pathspec: string): Promise<void> {
		await this.#exec(`git add ${pathspec}`);
	}

	/**
	 * Create a commit
	 * @param message - Commit message
	 */
	async commit(message: string): Promise<void> {
		// Escape single quotes in message
		const escapedMessage = message.replace(/'/g, "'\\''");
		await this.#exec(`git commit -m '${escapedMessage}'`);
	}

	/**
	 * Create a new branch
	 * @param branchName - Name for the new branch
	 */
	async createBranch(branchName: string): Promise<void> {
		await this.#exec(`git branch "${branchName}"`);
	}

	/**
	 * Checkout a branch
	 * @param branchName - Branch to checkout
	 * @param createNew - Create branch if it doesn't exist
	 */
	async checkout(branchName: string, createNew = false): Promise<void> {
		const flag = createNew ? "-b" : "";
		await this.#exec(`git checkout ${flag} "${branchName}"`);
	}

	/**
	 * List all worktrees in this repository
	 * @returns Array of worktree paths
	 */
	async listWorktrees(): Promise<string[]> {
		const { stdout } = await this.#exec("git worktree list");
		return stdout
			.split("\n")
			.filter(Boolean)
			.map((line) => {
				// Format: "/path/to/worktree  abc1234 [branch-name]"
				const match = line.match(/^(\S+)/);
				return match ? match[1] : "";
			})
			.filter(Boolean);
	}
}

/**
 * Create a GitRepository instance for the current working directory
 * @returns GitRepository instance
 */
export async function createGitRepositoryFromCwd(): Promise<GitRepository> {
	const cwd = process.cwd();
	return new GitRepository(cwd);
}
