import { attempt } from "../attempt.js";
import type {
	InstallationPolicy,
	PolicyContext,
	PolicyResult,
} from "../installation-policy.js";
import type { RollbackData } from "../rollback-data.js";

/**
 * Copy Hard Policy
 * Creates complete directory copies for AIDD framework components.
 */
export class HardCopyPolicy implements InstallationPolicy {
	readonly id = "copy-hard";
	readonly name = "Hard Copy Policy";
	readonly description =
		"Creates complete copies of directories to make projects self-contained";

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
			const { includeDirectories = [], includeFiles = [] } = policyOptions as {
				includeDirectories?: string[];
				includeFiles?: string[];
			};

			if (!fs.exists(source)) {
				const error = `Source path does not exist: ${source}`;
				display.show(error, "error", context.verbosity);
				return { success: false, warnings: [], errors: [error] };
			}

			// Prevent infinite recursion - check if target is inside source
			const { resolve } = await import("node:path");
			const absoluteSource = resolve(source);
			const absoluteTarget = resolve(target);

			if (absoluteTarget.startsWith(absoluteSource)) {
				const error = `Cannot copy source into itself. Target '${absoluteTarget}' is inside source '${absoluteSource}'`;
				display.show(error, "error", context.verbosity);
				return { success: false, warnings: [], errors: [error] };
			}

			if (options.dryRun) {
				display.show(
					`Would copy directory: ${source} → ${target}`,
					"info",
					context.verbosity,
				);
				return { success: true, warnings: [], errors: [], method: "copy" };
			}

			const copyOptions = {
				overwrite: true,
				include:
					includeDirectories && includeDirectories.length > 0
						? includeDirectories
						: undefined,
				includeFiles:
					includeFiles && includeFiles.length > 0 ? includeFiles : undefined,
				preserveTimestamps: true,
			};

			await fs.copy(source, target, copyOptions);
			display.show(
				`Copied directory: ${source} → ${target}`,
				"progress",
				context.verbosity,
			);
			return {
				success: true,
				warnings: [],
				errors: [],
				method: "copy",
				rollbackData: { target, wasExisting: fs.exists(target) },
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
		const { target, wasExisting } = executionData;

		try {
			if (!wasExisting && fs.exists(target)) {
				await fs.remove(target);
				display.show(
					`Removed copied directory: ${target}`,
					"progress",
					context.verbosity,
				);
			} else if (wasExisting) {
				display.show(
					`Cannot rollback: target directory existed before copy: ${target}`,
					"warning",
					context.verbosity,
				);
			}
		} catch (error) {
			display.show(
				`Failed to rollback copy: ${error instanceof Error ? error.message : "Unknown error"}`,
				"warning",
				context.verbosity,
			);
		}
	}
}
