import { AIDD_MARKER } from "../../../infra/constants/markers.js";
import { getGlobalAiddDir } from "../../../infra/utils/aidd-paths.js";
import { attempt } from "../attempt.js";
import type {
	InstallationPolicy,
	PolicyContext,
	PolicyResult,
} from "../installation-policy.js";
import type { RollbackData } from "../rollback-data.js";

const AIDD_ROOT_PLACEHOLDER = "__AIDD_ROOT_ABSOLUTE__";

function ensureTrailingNewline(value: string): string {
	return value.endsWith("\n") ? value : `${value}\n`;
}

function stripManagedBlock(
	content: string,
	startMarker: string,
	endMarker: string,
): string {
	const startIndex = content.indexOf(startMarker);
	if (startIndex === -1) {
		return content.trimEnd();
	}

	const endIndex = content.indexOf(endMarker, startIndex);
	if (endIndex === -1) {
		return content.trimEnd();
	}

	const before = content.slice(0, startIndex).replace(/\s*$/, "");
	const after = content.slice(endIndex + endMarker.length).replace(/^\s*/, "");
	const pieces: string[] = [];

	if (before.length > 0) pieces.push(before);
	if (after.length > 0) pieces.push(after);

	if (pieces.length === 0) {
		return "";
	}

	return pieces.join("\n").trimEnd();
}

/**
 * Merge Text Policy
 * Merges text blocks into existing files using markers to avoid duplicates.
 */
export class MergeTextPolicy implements InstallationPolicy {
	readonly id = "merge-text";
	readonly name = "Merge Text Policy";
	readonly description =
		"Merges text content into files with start/end markers to prevent duplicates";

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
			const warnings: string[] = [];
			const {
				startMarker = AIDD_MARKER.START,
				endMarker = AIDD_MARKER.END,
				skipIfExists = true,
				appendNewline = true,
				content,
				installDir,
				header,
				mode,
			} = policyOptions as {
				startMarker?: string;
				endMarker?: string;
				skipIfExists?: boolean;
				appendNewline?: boolean;
				content?: string;
				installDir?: string;
				header?: string;
				mode?: number;
			};

			let sourceContent: string;
			if (typeof content === "string" && content.length > 0) {
				sourceContent = content;
			} else if (fs.exists(source)) {
				sourceContent = await fs.readFile(source);
			} else {
				const error = `Neither source file exists nor content provided: ${source}`;
				display.show(error, "error", context.verbosity);
				return { success: false, warnings: [], errors: [error] };
			}

			if (installDir && sourceContent.includes(AIDD_ROOT_PLACEHOLDER)) {
				// Use ~/.aidd/ as AIDD_ROOT for all users
				const aiddRoot = getGlobalAiddDir();
				sourceContent = sourceContent.replace(
					new RegExp(AIDD_ROOT_PLACEHOLDER, "g"),
					aiddRoot,
				);
			}

			if (options.dryRun) {
				const action = fs.exists(target) ? "merge into" : "create";
				display.show(
					`Would ${action} file: ${target}`,
					"info",
					context.verbosity,
				);
				return { success: true, warnings: [], errors: [], method: "merge" };
			}

			let existingContent = "";
			let wasExisting = false;

			if (fs.exists(target)) {
				existingContent = await fs.readFile(target);
				wasExisting = true;

				if (skipIfExists && existingContent.includes(startMarker as string)) {
					display.show(
						`Content already exists in ${target} - skipping`,
						"info",
						context.verbosity,
					);
					return {
						success: true,
						warnings: [`Content already exists in ${target}`],
						errors: [],
						method: "skip",
					};
				}

				if (!skipIfExists && existingContent.includes(startMarker as string)) {
					existingContent = stripManagedBlock(
						existingContent,
						startMarker as string,
						endMarker as string,
					);
				}
			} else if (header) {
				existingContent = ensureTrailingNewline(header);
			}

			let contentToAppend: string;
			if (
				sourceContent.includes(startMarker as string) &&
				sourceContent.includes(endMarker as string)
			) {
				contentToAppend = ensureTrailingNewline(sourceContent);
			} else {
				contentToAppend = `${startMarker}\n${sourceContent}\n${endMarker}`;
			}

			if (appendNewline && existingContent && !existingContent.endsWith("\n")) {
				contentToAppend = `\n${contentToAppend}`;
			}

			const mergedContent = existingContent
				? ensureTrailingNewline(existingContent) + contentToAppend
				: contentToAppend;

			await fs.writeFile(target, mergedContent);

			if (typeof mode === "number" && fs.chmod) {
				try {
					await fs.chmod(target, mode);
				} catch {
					const warning = `Unable to set permissions on ${target}`;
					warnings.push(warning);
					display.show(warning, "warning", context.verbosity);
				}
			}

			const action = wasExisting ? "Updated" : "Created";
			display.show(
				`${action} ${target} with merged content`,
				"progress",
				context.verbosity,
			);

			return {
				success: true,
				warnings,
				errors: [],
				method: "merge",
				rollbackData: {
					target,
					originalContent: wasExisting ? existingContent : null,
					wasExisting,
				} as RollbackData,
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
		const { target, originalContent, wasExisting } = executionData;

		try {
			if (wasExisting && originalContent) {
				await fs.writeFile(target, originalContent);
				display.show(
					`Restored original content: ${target}`,
					"progress",
					context.verbosity,
				);
			} else if (!wasExisting && fs.exists(target)) {
				await fs.remove(target);
				display.show(
					`Removed created file: ${target}`,
					"progress",
					context.verbosity,
				);
			}
		} catch (error) {
			display.show(
				`Failed to rollback text merge: ${error instanceof Error ? error.message : "Unknown error"}`,
				"warning",
				context.verbosity,
			);
		}
	}
}
