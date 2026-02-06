import type { PolicyContext, PolicyResult } from "./installation-policy.js";

/**
 * Executes a policy function with automatic error handling.
 * Catches exceptions and transforms them into PolicyResult errors.
 */
export async function attempt(
	context: PolicyContext,
	fn: () => Promise<PolicyResult>,
): Promise<PolicyResult> {
	try {
		return await fn();
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		context.display.show(message, "error", context.verbosity);
		return { success: false, warnings: [], errors: [message] };
	}
}
