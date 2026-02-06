import { dirname } from "node:path";
import type {
	InstallationPolicy,
	PolicyContext,
	PolicyResult,
} from "../installation-policy.js";
import type { RollbackData } from "../rollback-data.js";

/**
 * Copy & Overwrite With Backup Policy
 * Copies a file, overwriting the target and keeping a backup when needed.
 * Acts as the "overwrite" counterpart to copy-if-missing.
 */
export class CopyOverwriteWithBackupPolicy implements InstallationPolicy {
	readonly id = "copy-overwrite-with-backup";
	readonly name = "Copy Overwrite With Backup Policy";
	readonly description =
		"Copies a file and overwrites the target, keeping a backup when forced";

	private backupPaths: string[] = [];

	canRollback(): boolean {
		return true;
	}

	async execute(context: PolicyContext): Promise<PolicyResult> {
		const { source, target, options, fs } = context;
		const { force = false } = options;

		try {
			const targetExists = fs.exists(target);

			if (!targetExists) {
				await this.copyFile(context, source, target);
				return {
					success: true,
					warnings: [],
					errors: [],
				};
			}

			if (force) {
				const backupPath = await fs.createBackup(target);
				if (backupPath) {
					this.backupPaths.push(backupPath);
				}

				await this.copyFile(context, source, target);

				return {
					success: true,
					warnings: [
						`File ${target} was overwritten. Backup saved to ${backupPath}`,
					],
					errors: [],
				};
			}

			return {
				success: true,
				warnings: [`File ${target} already exists. Use --force to overwrite.`],
				errors: [],
			};
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			return {
				success: false,
				warnings: [],
				errors: [`Failed to process file ${target}: ${errorMessage}`],
			};
		}
	}

	async rollback(
		context: PolicyContext,
		_executionData: RollbackData,
	): Promise<void> {
		const { fs } = context;

		for (const backupPath of this.backupPaths) {
			try {
				const originalPath = backupPath.replace(/\.backup\.\d+$/, "");
				await this.copyFile(context, backupPath, originalPath);
				await fs.remove(backupPath);
			} catch {
				context.display.show(
					`Failed to restore backup ${backupPath}`,
					"error",
					context.verbosity,
				);
			}
		}

		this.backupPaths = [];
	}

	private async copyFile(
		context: PolicyContext,
		sourcePath: string,
		targetPath: string,
	): Promise<void> {
		const { fs } = context;
		const targetDir = dirname(targetPath);
		await fs.mkdir(targetDir, { recursive: true });

		const data = await fs.readFile(sourcePath);
		await fs.writeFile(targetPath, data);
	}
}
