import type { CommandResult } from "../../domain/worktree/command-result.js";
import { WorktreeSession } from "../../domain/worktree/worktree-session.js";
import {
	type GitRepository,
	createGitRepositoryFromCwd,
} from "../../infra/git/git-repository.js";
import { createDisplayService } from "../ui/display.service.js";

/**
 * Worktree command options
 */
export interface WorktreeCommandOptions {
	/** Custom worktree name (optional) */
	worktreeName?: string;
	/** Git repository to operate on (optional, defaults to cwd) */
	repository?: GitRepository;
}

/**
 * Create a temporary git worktree and execute a command in it
 *
 * @param nameOrCommand - Either the worktree name (if two args) or command (if one arg)
 * @param commandOrOptions - The command to execute (if name was provided) OR options object
 * @returns Command result
 *
 * @example
 * // CLI usage (uses current directory)
 * await worktreeCommand("npm test");
 * await worktreeCommand("my-worktree", "npm test");
 *
 * @example
 * // Test usage (explicit repository)
 * const repo = new GitRepository("/path/to/test/repo");
 * await worktreeCommand("npm test", { repository: repo });
 */
export async function worktreeCommand(
	nameOrCommand: string,
	commandOrOptions?: string | WorktreeCommandOptions,
): Promise<CommandResult> {
	// Parse arguments
	let worktreeName: string | undefined;
	let cmdToRun: string;
	let repository: GitRepository;
	const display = createDisplayService("normal");

	if (typeof commandOrOptions === "string") {
		// worktreeCommand("name", "command") - old signature
		worktreeName = nameOrCommand;
		cmdToRun = commandOrOptions;
		repository = await createGitRepositoryFromCwd();
	} else if (typeof commandOrOptions === "object") {
		// worktreeCommand("command", { options }) - new signature with explicit repo
		cmdToRun = nameOrCommand;
		worktreeName = commandOrOptions.worktreeName;
		repository =
			commandOrOptions.repository ?? (await createGitRepositoryFromCwd());
	} else {
		// worktreeCommand("command") - single argument
		cmdToRun = nameOrCommand;
		worktreeName = undefined;
		repository = await createGitRepositoryFromCwd();
	}

	const session = new WorktreeSession(repository, display);
	try {
		return await session.run(cmdToRun, worktreeName);
	} catch (error) {
		display.show(`Error: ${(error as Error).message}`, "error");
		return {
			success: false,
			message: (error as Error).message,
			warnings: [(error as Error).message],
		};
	}
}
