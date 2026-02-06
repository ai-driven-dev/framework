import { dirname, relative, resolve } from "node:path";
import { attempt } from "../attempt.js";
import type {
	InstallationPolicy,
	PolicyContext,
	PolicyResult,
} from "../installation-policy.js";
import type { RollbackData } from "../rollback-data.js";

/**
 * Symlink Relative Policy
 * Creates relative directory symlinks for project-local rules (Cursor, Windsurf, etc.).
 */
export class RelativeSymlinkPolicy implements InstallationPolicy {
	readonly id = "symlink-relative";
	readonly name = "Relative Symlink Policy";
	readonly description =
		"Creates relative symbolic links for project-local directories";

	private async handleExistingTarget(
		targetAbsolute: string,
		targetDisplay: string,
		expectedRelativePath: string,
		context: PolicyContext,
	): Promise<boolean> {
		const { fs, display } = context;

		if (!fs.exists(targetAbsolute)) {
			return true;
		}

		const stats = await fs.lstat(targetAbsolute);
		const isSymlink = stats.isSymbolicLink();

		if (isSymlink) {
			const currentTarget = await fs.readlink(targetAbsolute);
			if (currentTarget === expectedRelativePath) {
				display.show(
					`Symlink already correct: ${targetDisplay} → ${currentTarget}`,
					"info",
					context.verbosity,
				);
				return false;
			}
			await fs.remove(targetAbsolute);
			display.show(
				`Replaced incorrect symlink: ${targetAbsolute} (was → ${currentTarget})`,
				"progress",
				context.verbosity,
			);
			return true;
		}

		const backupPath = await fs.createBackup(targetAbsolute);
		if (!backupPath) {
			throw new Error(`Failed to create backup for: ${targetAbsolute}`);
		}
		display.show(
			`Backed up existing file to: ${backupPath}`,
			"info",
			context.verbosity,
		);
		await fs.remove(targetAbsolute);
		display.show(
			`Removed existing file/directory: ${targetAbsolute}`,
			"progress",
			context.verbosity,
		);
		return true;
	}

	async execute(context: PolicyContext): Promise<PolicyResult> {
		return attempt(context, async () => {
			const {
				source,
				target,
				options,
				fs,
				display,
				policyOptions = {},
			} = context;

			const baseDir =
				(policyOptions as { installDir?: string }).installDir || process.cwd();
			const sourceAbsolute = resolve(baseDir, source);
			const targetAbsolute = resolve(target);

			if (!fs.exists(sourceAbsolute)) {
				const error = `Source path does not exist: ${sourceAbsolute}`;
				display.show(error, "error", context.verbosity);
				return { success: false, warnings: [], errors: [error] };
			}

			if (options.dryRun) {
				display.show(
					`Would create relative symlink: ${source} → ${target}`,
					"info",
					context.verbosity,
				);
				return {
					success: true,
					warnings: [],
					errors: [],
					method: "symlink-relative",
				};
			}

			const targetDir = dirname(targetAbsolute);
			const relativePath = relative(targetDir, sourceAbsolute);

			if (fs.exists(targetAbsolute)) {
				const shouldProceed = await this.handleExistingTarget(
					targetAbsolute,
					target,
					relativePath,
					context,
				);
				if (!shouldProceed) {
					return {
						success: true,
						warnings: [],
						errors: [],
						method: "symlink-relative",
						skipped: true,
					};
				}
			}

			const { mkdir, symlink } = await import("node:fs/promises");
			await mkdir(targetDir, { recursive: true });

			await symlink(relativePath, targetAbsolute, "dir");
			display.show(
				`Created relative symlink: ${relativePath} → ${target}`,
				"progress",
				context.verbosity,
			);
			return {
				success: true,
				warnings: [],
				errors: [],
				method: "symlink-relative",
				rollbackData: { target },
			};
		});
	}

	canRollback(): boolean {
		return true;
	}

	async rollback(
		context: PolicyContext,
		executionData: RollbackData,
	): Promise<void> {
		const { fs, display } = context;
		const { target } = executionData;

		try {
			if (fs.exists(target) && (await fs.isSymlink(target))) {
				await fs.remove(target);
				display.show(
					`Removed relative symlink: ${target}`,
					"progress",
					context.verbosity,
				);
			}
		} catch (error) {
			display.show(
				`Failed to rollback relative symlink: ${error instanceof Error ? error.message : "Unknown error"}`,
				"warning",
				context.verbosity,
			);
		}
	}
}
