import { attempt } from "../attempt.js";
import type {
	InstallationPolicy,
	PolicyContext,
	PolicyResult,
} from "../installation-policy.js";

/**
 * Symlink Absolute Policy
 *
 * @deprecated Prefer using the relative symlink policy (`symlink-relative`)
 * whenever possible. Absolute symlinks are harder to move or share across
 * environments and should be reserved for configurations that explicitly
 * require absolute paths.
 */
export class AbsoluteSymlinkPolicy implements InstallationPolicy {
	readonly id = "symlink-absolute";
	readonly name = "Symlink Absolute Policy";
	readonly description =
		"(deprecated) Creates absolute symbolic links for files that must stay synchronized with the source. Prefer relative symlinks when possible.";

	async execute(context: PolicyContext): Promise<PolicyResult> {
		return attempt(context, async () => {
			const { source, target, options, fs, display } = context;

			if (!fs.exists(source)) {
				const error = `Source path does not exist: ${source}`;
				display.show(error, "error", context.verbosity);
				return { success: false, warnings: [], errors: [error] };
			}

			if (options.dryRun) {
				display.show(
					`Would create symlink: ${source} → ${target}`,
					"info",
					context.verbosity,
				);
				return { success: true, warnings: [], errors: [], method: "symlink" };
			}

			await fs.createSymlink(source, target);
			display.show(
				`Created symlink: ${source} → ${target}`,
				"progress",
				context.verbosity,
			);
			return {
				success: true,
				warnings: [],
				errors: [],
				method: "symlink",
				rollbackData: { target },
			};
		});
	}

	canRollback(): boolean {
		return false;
	}
}
