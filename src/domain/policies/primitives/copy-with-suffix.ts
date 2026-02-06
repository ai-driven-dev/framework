import { basename, dirname, extname, join } from "node:path";
import { attempt } from "../attempt.js";
import type {
	InstallationPolicy,
	PolicyContext,
	PolicyResult,
} from "../installation-policy.js";
import type { RollbackData } from "../rollback-data.js";

/**
 * Copy With Suffix Policy
 * Copies files from source to target directory with suffix transformation.
 * Example: dev.md → dev.agent.md
 */
export class CopyWithSuffixPolicy implements InstallationPolicy {
	readonly id = "copy-with-suffix";
	readonly name = "Copy With Suffix Policy";
	readonly description =
		"Copies files from source to target with suffix transformation";

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
			const { suffix = "", glob = "**/*.md" } = policyOptions as {
				suffix?: string;
				glob?: string;
			};

			if (!fs.exists(source)) {
				const error = `Source path does not exist: ${source}`;
				display.show(error, "error", context.verbosity);
				return { success: false, warnings: [], errors: [error] };
			}

			const sourceFiles = await this.collectFiles(fs, source, glob);

			if (sourceFiles.length === 0) {
				const msg = `No files matching '${glob}' found in ${source}`;
				display.show(msg, "warning", context.verbosity);
				return {
					success: true,
					warnings: [msg],
					errors: [],
					method: "copy-with-suffix",
				};
			}

			if (options.dryRun) {
				for (const file of sourceFiles) {
					const relativePath = file.replace(source, "").replace(/^\//, "");
					const targetPath = this.transformPath(
						join(target, relativePath),
						suffix,
					);
					display.show(
						`Would copy: ${file} → ${targetPath}`,
						"info",
						context.verbosity,
					);
				}
				return {
					success: true,
					warnings: [],
					errors: [],
					method: "copy-with-suffix",
				};
			}

			const copiedFiles: string[] = [];

			for (const sourceFile of sourceFiles) {
				const relativePath = sourceFile.replace(source, "").replace(/^\//, "");
				const targetPath = this.transformPath(
					join(target, relativePath),
					suffix,
				);
				const targetDir = dirname(targetPath);

				if (!fs.exists(targetDir)) {
					await fs.mkdir(targetDir, { recursive: true });
				}

				const content = await fs.readFile(sourceFile);
				await fs.writeFile(targetPath, content);
				copiedFiles.push(targetPath);

				display.show(
					`Copied: ${sourceFile} → ${targetPath}`,
					"progress",
					context.verbosity,
				);
			}

			return {
				success: true,
				warnings: [],
				errors: [],
				method: "copy-with-suffix",
				rollbackData: { copiedFiles, target },
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
		const { copiedFiles } = executionData;

		try {
			if (copiedFiles && Array.isArray(copiedFiles)) {
				for (const file of copiedFiles) {
					if (fs.exists(file)) {
						await fs.remove(file);
						display.show(
							`Removed copied file: ${file}`,
							"progress",
							context.verbosity,
						);
					}
				}
			}
		} catch (error) {
			display.show(
				`Failed to rollback copy-with-suffix: ${error instanceof Error ? error.message : "Unknown error"}`,
				"warning",
				context.verbosity,
			);
		}
	}

	private transformPath(path: string, suffix: string): string {
		if (!suffix) return path;

		const dir = dirname(path);
		const ext = extname(path);
		const base = basename(path, ext);

		return join(dir, `${base}${suffix}${ext}`);
	}

	private async collectFiles(
		fs: PolicyContext["fs"],
		sourceDir: string,
		pattern: string,
	): Promise<string[]> {
		const files: string[] = [];

		// Simple pattern matching: **/*.md → match all .md files recursively
		// *.md → match .md files in root only
		const isRecursive = pattern.includes("**/");
		const extension = pattern.replace("**/", "").replace("*", "");

		const traverse = async (dir: string): Promise<void> => {
			const entries = await fs.readdir(dir);

			for (const entry of entries) {
				const fullPath = join(dir, entry);
				const stat = await fs.lstat(fullPath);

				if (stat.isDirectory()) {
					if (isRecursive) {
						await traverse(fullPath);
					}
				} else if (stat.isFile()) {
					if (entry.endsWith(extension)) {
						files.push(fullPath);
					}
				}
			}
		};

		await traverse(sourceDir);
		return files;
	}
}
