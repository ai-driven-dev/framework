/** The project roots a machine plugin's claim lists, none when it keeps none. Refuses a claim
 * that is not a list of paths. */
export function readDependents(claim: unknown): readonly string[] {
  if (claim === undefined) return [];
  if (!Array.isArray(claim) || !claim.every((root) => typeof root === "string")) {
    throw new Error("plugin dependents: expected a list of project roots.");
  }
  return [...claim];
}

/** The claim listing these project roots once each, none when there are none. */
export function dependentsClaim(dependents: readonly string[]): readonly string[] | undefined {
  return dependents.length === 0 ? undefined : [...new Set(dependents)];
}
