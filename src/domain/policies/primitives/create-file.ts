import { attempt } from "../attempt.js";
import type {
	InstallationPolicy,
	PolicyContext,
	PolicyResult,
} from "../installation-policy.js";

/**
 * Create File Policy
 * Creates empty files or files with specific content.
 */
export class CreateFilePolicy implements InstallationPolicy {
	readonly id = "create-file";
	readonly name = "Create File Policy";
	readonly description = "Creates empty files or files with specific content";

	async execute(context: PolicyContext): Promise<PolicyResult> {
		return attempt(context, async () => {
			const { target, options, fs, display, policyOptions = {} } = context;
			const { content = "" } = policyOptions as { content?: string };

			if (options.dryRun) {
				display.show(`Would create file: ${target}`, "info", context.verbosity);
				return {
					success: true,
					warnings: [],
					errors: [],
					method: "create-file",
				};
			}

			if (fs.exists(target)) {
				display.show(
					`File already exists: ${target}`,
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

			const lastSlashIndex = target.lastIndexOf("/");
			const parentDir =
				lastSlashIndex > 0 ? target.substring(0, lastSlashIndex) : "";
			if (parentDir && !fs.exists(parentDir)) {
				await fs.mkdir(parentDir, { recursive: true });
			}

			await fs.writeFile(target, content);
			display.show(`Created file: ${target}`, "progress", context.verbosity);

			return {
				success: true,
				warnings: [],
				errors: [],
				method: "create-file",
				rollbackData: { target },
			};
		});
	}

	canRollback(): boolean {
		return false;
	}
}
