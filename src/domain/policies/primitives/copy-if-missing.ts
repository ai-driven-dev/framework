import { attempt } from "../attempt.js";
import type {
	InstallationPolicy,
	PolicyContext,
	PolicyResult,
} from "../installation-policy.js";

/**
 * Copy If Missing Policy
 * Copies a file or directory only when the target is absent.
 * Safe for reruns: existing targets are left untouched.
 */
export class CopyIfMissingPolicy implements InstallationPolicy {
	readonly id = "copy-if-missing";
	readonly name = "Copy If Missing Policy";
	readonly description =
		"Copies a file or directory only when the target does not already exist";

	async execute(context: PolicyContext): Promise<PolicyResult> {
		return attempt(context, async () => {
			const { source, target, options, fs, display, verbosity, policyOptions } =
				context;

			if (!fs.exists(source)) {
				const error = `Source path does not exist: ${source}`;
				display.show(error, "error", verbosity);
				return { success: false, warnings: [], errors: [error] };
			}

			if (fs.exists(target)) {
				const message = `File already exists, skipping copy: ${target}`;
				display.show(message, "info", verbosity);
				return {
					success: true,
					warnings: [message],
					errors: [],
					skipped: true,
				};
			}

			if (options.dryRun) {
				display.show(
					`Would copy (absent target): ${source} -> ${target}`,
					"info",
					verbosity,
				);
				return {
					success: true,
					warnings: [],
					errors: [],
					method: "copy-if-missing",
					rollbackData: { target, wasExisting: false },
				};
			}

			await fs.copy(source, target, {
				preserveTimestamps: policyOptions?.preserveTimestamps,
				includeFiles: policyOptions?.includeFiles,
			});

			display.show(
				`Copied (missing target): ${source} -> ${target}`,
				"progress",
				verbosity,
			);

			return {
				success: true,
				warnings: [],
				errors: [],
				method: "copy-if-missing",
				rollbackData: { target },
			};
		});
	}

	canRollback(): boolean {
		return false;
	}
}
