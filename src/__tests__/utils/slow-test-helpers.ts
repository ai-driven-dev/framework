import { it } from "vitest";

/**
 * Returns vitest `it` or `it.skip` based on a condition.
 */
export function itWhen(condition: boolean): typeof it {
	const runner = condition ? it : it.skip;
	return runner as typeof it;
}

/**
 * Enable a slow test in CI or when a specific env flag is set.
 */
export function itWhenCiOrFlag(envFlag: string): typeof it {
	const enabled = process.env.CI === "true" || process.env[envFlag] === "1";
	return itWhen(enabled);
}
