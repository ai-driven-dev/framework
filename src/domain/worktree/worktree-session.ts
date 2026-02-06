import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { PATHS } from "../../infra/constants/paths.js";
import type { GitRepository } from "../../infra/git/git-repository.js";
import { resolveShellCommand } from "../../infra/shell/resolve-shell-command.js";
import type { DisplayAdapter } from "../policies/installation-policy.js";
import type { CommandResult } from "./command-result.js";

function generateWorktreeName(branch: string): string {
	const datePart = new Date().toISOString().split("T")[0].replace(/-/g, "");
	const uuidPart = randomBytes(4).toString("hex");
	const sanitizedBranch = branch.replace(/[^a-zA-Z0-9-]/g, "-");
	return `${sanitizedBranch}-${datePart}-${uuidPart}`;
}

export class WorktreeSession {
	constructor(
		private readonly repository: GitRepository,
		private readonly display: DisplayAdapter,
	) {}

	async run(command: string, worktreeName?: string): Promise<CommandResult> {
		if (!(await this.repository.isGitRepository())) {
			this.display.show("Not in a git repository", "error");
			return {
				success: false,
				message: "Not in a git repository",
				warnings: ["Not in a git repository"],
			};
		}

		if (!(await this.repository.hasCommits())) {
			this.display.show("Repository has no commits", "error");
			return {
				success: false,
				message: "Repository has no commits",
				warnings: ["Repository has no commits"],
			};
		}

		// Get current branch and derive names/paths
		const currentBranch = await this.repository.getCurrentBranch();
		const finalWorktreeName =
			worktreeName || generateWorktreeName(currentBranch);
		const branchName = finalWorktreeName;

		if (await this.repository.branchExists(branchName)) {
			return {
				success: false,
				message: `Branch ${branchName} already exists. Choose a different worktree name.`,
				warnings: [`Branch ${branchName} already exists.`],
			};
		}

		const worktreePathBase = resolve(this.repository.path, PATHS.WORKTREES_DIR);
		const worktreePath = resolve(worktreePathBase, finalWorktreeName);

		this.display.show(`\nCreating worktree: ${finalWorktreeName}`, "progress");
		let branchCreated = false;

		try {
			try {
				await mkdir(worktreePathBase, { recursive: true });
			} catch (error) {
				this.display.show(
					`Failed to create worktrees directory '${worktreePathBase}': ${
						(error as Error).message
					}`,
					"warning",
				);
			}

			await this.repository.createWorktree(worktreePath, branchName);
			branchCreated = true;

			await this.repository.unsetConfig("core.bare", "local");
			await this.repository.setConfig(
				"core.worktree",
				this.repository.path,
				"local",
			);

			// Preserve user identity in worktree to prevent test config pollution
			try {
				const globalName = await this.repository.getConfig(
					"user.name",
					"global",
				);
				const globalEmail = await this.repository.getConfig(
					"user.email",
					"global",
				);

				if (globalName && globalEmail) {
					const { GitRepository } = await import(
						"../../infra/git/git-repository.js"
					);
					const worktreeRepo = new GitRepository(worktreePath);
					await worktreeRepo.setConfig("user.name", globalName, "local");
					await worktreeRepo.setConfig("user.email", globalEmail, "local");
				}
			} catch (error) {
				this.display.show(
					`Failed to propagate global git user config to worktree: ${
						(error as Error).message
					}`,
					"warning",
				);
			}

			this.display.show(
				`Worktree ${finalWorktreeName} created on new branch ${branchName}`,
				"success",
			);
		} catch (error) {
			if (await this.repository.branchExists(branchName)) {
				try {
					await this.repository.deleteBranch(branchName);
					this.display.show(`Deleted orphaned branch ${branchName}`, "warning");
				} catch (cleanupError) {
					this.display.show(
						`Failed to delete orphaned branch ${branchName}: ${
							(cleanupError as Error).message
						}`,
						"error",
					);
				}
			}
			throw new Error(
				`Failed to create worktree branch ${branchName}: ${
					(error as Error).message
				}`,
			);
		}

		const shellCommand = resolveShellCommand(command);
		const child = spawn(shellCommand.executable, shellCommand.args, {
			cwd: worktreePath,
			stdio: "inherit",
		});

		let cleanupCalled = false;
		const cleanup = async () => {
			if (cleanupCalled) return;
			cleanupCalled = true;

			this.display.show(
				`\nCleaning up worktree: ${finalWorktreeName}`,
				"progress",
			);
			try {
				await this.repository.removeWorktree(worktreePath, true);
				this.display.show(`Worktree ${finalWorktreeName} deleted`, "success");
			} catch (error) {
				this.display.show(
					`Failed to remove worktree: ${(error as Error).message}`,
					"error",
				);
			}

			if (branchCreated && (await this.repository.branchExists(branchName))) {
				try {
					await this.repository.deleteBranch(branchName);
					this.display.show(`Branch ${branchName} deleted`, "success");
				} catch (error) {
					this.display.show(
						`Failed to delete branch ${branchName}: ${
							(error as Error).message
						}`,
						"error",
					);
				}
			}
		};

		const signalHandlers = new Map<NodeJS.Signals, () => void>();
		const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];

		for (const signal of signals) {
			const handler = async () => {
				this.display.show(`\nReceived ${signal}, cleaning up...`, "warning");
				child.kill(signal);
				for (const [sig, h] of signalHandlers) {
					process.removeListener(sig, h);
				}
				signalHandlers.clear();
				await cleanup();
				process.exit(0);
			};
			signalHandlers.set(signal, handler);
			process.on(signal, handler);
		}

		return new Promise((resolvePromise) => {
			child.on("close", async (code) => {
				for (const [sig, h] of signalHandlers) {
					process.removeListener(sig, h);
				}
				signalHandlers.clear();

				await cleanup();

				if (code === 0) {
					resolvePromise({
						success: true,
						message: "Worktree command completed successfully",
						warnings: [],
					});
				} else {
					resolvePromise({
						success: false,
						message: `Command exited with code ${code}`,
						warnings: [`Command exited with code ${code}`],
					});
				}
			});

			child.on("error", async (error) => {
				this.display.show(
					`Failed to execute command: ${error.message}`,
					"error",
				);
				for (const [sig, h] of signalHandlers) {
					process.removeListener(sig, h);
				}
				signalHandlers.clear();

				await cleanup();
				resolvePromise({
					success: false,
					message: `Failed to execute command: ${error.message}`,
					warnings: [`Failed to execute command: ${error.message}`],
				});
			});
		});
	}
}
