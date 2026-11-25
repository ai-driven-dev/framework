import type { ProjectCleanFacts } from "../../../../src/contexts/host-registration/application/withdraw/withdrawal.js";

/** The machine-wide claims a clean is told about, `undefined` when no machine record exists. */
export function machineFacts(
  claims: readonly { ref: string; dependents: readonly string[] }[] | undefined
): ProjectCleanFacts["machine"] {
  return {
    claimedRefs: async () => claims?.map((claim) => claim.ref),
    othersHolding: async (_tool, refs, projectRoot) => [
      ...new Set(
        (claims ?? [])
          .filter((claim) => refs.includes(claim.ref))
          .flatMap((claim) => claim.dependents.filter((root) => root !== projectRoot))
      ),
    ],
  };
}
