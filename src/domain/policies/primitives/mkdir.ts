import { attempt } from "../attempt.js";
import type {
	InstallationPolicy,
	PolicyContext,
	PolicyResult,
} from "../installation-policy.js";

/**
 * Mkdir Policy
 * Creates directories with proper permissions.
 */
export class MkdirPolicy implements InstallationPolicy {
	readonly id = "mkdir";
	readonly name = "Mkdir Policy";
	readonly description = "Creates directories with proper permissions";

	async execute(context: PolicyContext): Promise<PolicyResult> {
		return attempt(context, async () => {
			const { target, options, fs, display } = context;

			if (options.dryRun) {
				display.show(
					`Would create directory: ${target}`,
					"info",
					context.verbosity,
				);
				return { success: true, warnings: [], errors: [], method: "mkdir" };
			}

			if (fs.exists(target)) {
				display.show(
					`Directory already exists: ${target}`,
					"info",
					context.verbosity,
				);
				return {
					success: true,
					warnings: [],
					errors: [],
					method: "skip",
				};
			}

			await fs.mkdir(target, { recursive: true });
			display.show(
				`Created directory: ${target}`,
				"progress",
				context.verbosity,
			);

			return {
				success: true,
				warnings: [],
				errors: [],
				method: "mkdir",
				rollbackData: { target },
			};
		});
	}

	canRollback(): boolean {
		return false;
	}
}
