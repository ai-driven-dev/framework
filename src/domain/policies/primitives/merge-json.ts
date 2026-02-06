import { parseJsonc } from "../../utils/jsonc.js";
import type {
	InstallationPolicy,
	PolicyContext,
	PolicyResult,
} from "../installation-policy.js";

type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
interface JsonObject {
	[key: string]: JsonValue;
}
type JsonArray = JsonValue[];

interface JsonMergeOptions {
	userFirst?: boolean;
	arrayUnion?: boolean;
	json?: {
		targetKey?: string;
	};
}

/**
 * Merge JSON Policy
 * Safely merges JSON/JSONC files with configurable precedence and array strategy.
 */
export class MergeJsonPolicy implements InstallationPolicy {
	readonly id = "merge-json";
	readonly name = "Merge JSON Policy";
	readonly description =
		"Merges JSON/JSONC files with deep merge semantics and optional array union";

	async execute(context: PolicyContext): Promise<PolicyResult> {
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
			userFirst = true,
			arrayUnion = true,
			json,
		} = (policyOptions as JsonMergeOptions) || {};
		const targetKey = json?.targetKey;

		try {
			if (!fs.exists(source)) {
				const error = `Source JSON not found: ${source}`;
				display.show(error, "error", context.verbosity);
				return { success: false, warnings, errors: [error] };
			}

			const sourceContent = await fs.readFile(source);
			let sourceJson: JsonValue;
			try {
				const parsedSource = parseJsonc<JsonValue>(sourceContent);
				// Wrap source under targetKey if specified
				sourceJson = targetKey
					? ({ [targetKey]: parsedSource } as JsonObject)
					: parsedSource;
			} catch (e) {
				const msg = `Invalid JSON in source: ${source} - ${(e as Error).message}`;
				return { success: false, warnings, errors: [msg] };
			}

			if (options.dryRun) {
				const action = fs.exists(target) ? "merge into" : "create";
				display.show(
					`Would ${action} JSON file: ${target}`,
					"info",
					context.verbosity,
				);
				return { success: true, warnings, errors: [], method: "merge" };
			}

			let finalJson: JsonValue = sourceJson;
			let wasExisting = false;
			if (fs.exists(target)) {
				wasExisting = true;
				try {
					const existingContent = await fs.readFile(target);
					const existingJson: JsonValue =
						parseJsonc<JsonValue>(existingContent);
					finalJson = this.mergeJson(
						sourceJson,
						existingJson,
						userFirst,
						arrayUnion,
					);
					display.show(
						`Merged JSON into existing file: ${target}`,
						"progress",
						context.verbosity,
					);
				} catch (e) {
					warnings.push(
						`Could not parse existing JSON at ${target} - overwriting. ${(e as Error).message}`,
					);
					finalJson = sourceJson;
				}
			} else {
				display.show(
					`Created JSON file: ${target}`,
					"progress",
					context.verbosity,
				);
			}

			await fs.writeFile(target, JSON.stringify(finalJson, null, 2));
			return {
				success: true,
				warnings,
				errors: [],
				method: wasExisting ? "merge" : "create",
			};
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			display.show(errorMessage, "error", context.verbosity);
			return { success: false, warnings, errors: [errorMessage] };
		}
	}

	canRollback(): boolean {
		return false;
	}

	private mergeJson(
		template: JsonValue,
		existing: JsonValue,
		userFirst: boolean,
		arrayUnion: boolean,
	): JsonValue {
		if (this.isObject(template) && this.isObject(existing)) {
			const result: JsonObject = {};
			const keys = new Set([
				...Object.keys(template as JsonObject),
				...Object.keys(existing as JsonObject),
			]);
			for (const key of keys) {
				const tVal = (template as JsonObject)[key];
				const eVal = (existing as JsonObject)[key];
				if (tVal === undefined) {
					result[key] = eVal;
				} else if (eVal === undefined) {
					result[key] = tVal;
				} else if (this.isObject(tVal) && this.isObject(eVal)) {
					result[key] = this.mergeJson(tVal, eVal, userFirst, arrayUnion);
				} else if (Array.isArray(tVal) && Array.isArray(eVal)) {
					result[key] = this.mergeArrays(tVal, eVal, arrayUnion);
				} else {
					result[key] = userFirst ? eVal : tVal;
				}
			}
			return result;
		}

		if (Array.isArray(template) && Array.isArray(existing)) {
			return this.mergeArrays(template, existing, arrayUnion);
		}

		return userFirst ? existing : template;
	}

	private mergeArrays(
		template: JsonArray,
		existing: JsonArray,
		arrayUnion: boolean,
	): JsonArray {
		if (!arrayUnion) {
			return [...existing, ...template];
		}

		const out: JsonArray = [...existing];
		const primitiveSet = new Set(
			existing.filter((v) => this.isPrimitive(v)).map((v) => String(v)),
		);
		for (const v of template) {
			if (this.isPrimitive(v)) {
				const key = String(v);
				if (!primitiveSet.has(key)) {
					primitiveSet.add(key);
					out.push(v);
				}
			} else {
				const exists = existing.some(
					(e) => JSON.stringify(e) === JSON.stringify(v),
				);
				if (!exists) out.push(v);
			}
		}
		return out;
	}

	private isObject(v: JsonValue): v is JsonObject {
		return typeof v === "object" && v !== null && !Array.isArray(v);
	}

	private isPrimitive(v: JsonValue): v is string | number | boolean | null {
		return (
			typeof v === "string" ||
			typeof v === "number" ||
			typeof v === "boolean" ||
			v === null
		);
	}
}
