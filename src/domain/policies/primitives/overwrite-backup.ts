import { attempt } from "../attempt.js";
import type {
	InstallationPolicy,
	PolicyContext,
	PolicyResult,
} from "../installation-policy.js";
import type { RollbackData } from "../rollback-data.js";

/**
 * Overwrite With Backup Policy
 * Overwrites files while keeping a configurable backup copy.
 */
export class OverwriteWithBackupPolicy implements InstallationPolicy {
	readonly id = "overwrite-backup";
	readonly name = "Overwrite With Backup Policy";
	readonly description =
		"Overwrites files while keeping a configurable backup copy";

	async execute(context: PolicyContext): Promise<PolicyResult> {
		return attempt(context, async () => {
			const {
				source,
				target,
				options,
				fs,
				display,
				policyOptions = {
					backupSuffix: ".backup",
					createBackup: true,
				},
			} = context;

			if (!fs.exists(source)) {
				const error = `Source file does not exist: ${source}`;
				display.show(error, "error", context.verbosity);
				return { success: false, warnings: [], errors: [error] };
			}

			if (options.dryRun) {
				const action = fs.exists(target) ? "overwrite" : "create";
				display.show(
					`Would ${action} file with backup: ${target}`,
					"info",
					context.verbosity,
				);
				return {
					success: true,
					warnings: [],
					errors: [],
					method: "overwrite-backup",
				};
			}

			const backupPath = policyOptions.createBackup
				? `${target}${policyOptions.backupSuffix}`
				: undefined;

			if (policyOptions.createBackup && backupPath && fs.exists(target)) {
				const existingContent = await fs.readFile(target);
				await fs.writeFile(backupPath, existingContent);
				display.show(
					`Created backup: ${backupPath}`,
					"progress",
					context.verbosity,
				);
			}

			const newContent = await fs.readFile(source);
			await fs.writeFile(target, newContent);
			display.show(
				`Overwrote file with backup: ${target}`,
				"progress",
				context.verbosity,
			);

			return {
				success: true,
				warnings: [],
				errors: [],
				method: "overwrite-backup",
				rollbackData: { target, backupPath } as RollbackData,
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
		const { target, backupPath } = executionData;

		if (!backupPath) {
			display.show(
				"No backup path provided for rollback",
				"warning",
				context.verbosity,
			);
			return;
		}

		try {
			if (fs.exists(backupPath)) {
				const backupContent = await fs.readFile(backupPath);
				await fs.writeFile(target, backupContent);
				display.show(
					`Restored from backup: ${target}`,
					"progress",
					context.verbosity,
				);
			} else {
				display.show(
					`Backup file not found: ${backupPath}`,
					"warning",
					context.verbosity,
				);
			}
		} catch (error) {
			display.show(
				`Failed to rollback overwrite: ${error instanceof Error ? error.message : "Unknown error"}`,
				"warning",
				context.verbosity,
			);
		}
	}
}
