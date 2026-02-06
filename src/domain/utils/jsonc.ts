/**
 * JSONC Utilities
 * Provides helpers to parse JSON with comments and trailing commas (JSONC)
 */

/**
 * Strip comments and trailing commas from JSONC content to make it JSON-parseable.
 * - Removes single-line // comments
 * - Removes /* ... *\/ comments
 * - Removes trailing commas before } and ]
 */
export function stripJsonc(content: string): string {
	// Remove single-line comments
	let result = content.replace(/^\s*\/\/.*$/gm, "");

	// Remove multi-line comments
	result = result.replace(/\/\*[\s\S]*?\*\//g, "");

	// Remove trailing commas before closing braces/brackets
	result = result.replace(/,(\s*[}\]])/g, "$1");

	return result;
}

/**
 * Parse JSONC content by stripping comments and trailing commas first.
 * Throws a normal JSON.parse error if the stripped content is invalid.
 */
export function parseJsonc<T = unknown>(content: string): T {
	const json = stripJsonc(content);
	return JSON.parse(json) as T;
}
