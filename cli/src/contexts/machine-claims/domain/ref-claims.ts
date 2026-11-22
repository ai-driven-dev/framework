import { asPlainObject } from "../../../shared/domain/reading/plain-object.js";

/** A claim kept on a host ref: the ref, and the project roots holding it. */
export interface HeldRefClaim {
  readonly ref: string;
  readonly dependents: readonly string[];
}

/** The claims a record keeps on its refs, each copied; none when it keeps none. Refuses a list,
 * or a claim, that is not a ref with the paths of the projects holding it. */
export function readHeldClaims(value: unknown): HeldRefClaim[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new Error("nativeRegistrations.pluginClaims: expected an array.");
  }
  return value.map((item) => {
    const claim = asPlainObject(item);
    if (
      claim === null ||
      typeof claim.ref !== "string" ||
      !Array.isArray(claim.dependents) ||
      !claim.dependents.every((dependent) => typeof dependent === "string")
    ) {
      throw new Error("nativeRegistrations.pluginClaims: expected a ref and its dependents.");
    }
    return { ref: claim.ref, dependents: [...claim.dependents] };
  });
}

interface OpenClaim {
  readonly ref: string;
  readonly dependents: string[];
}

/** The claims once one run's refs are merged in, and whether the merge changed anything. */
interface MergedRefClaims {
  readonly entries: OpenClaim[];
  readonly changed: boolean;
}

/** The claims with the dependent holding each ref's claim, a claim opened for a ref nobody
 * claimed yet. Every claim is copied, never the ones it was given. */
export function mergeRefClaims(
  recorded: readonly HeldRefClaim[],
  refs: readonly string[],
  dependent: string | undefined
): MergedRefClaims {
  const entries = recorded.map((claim) => ({ ref: claim.ref, dependents: [...claim.dependents] }));
  let changed = false;
  for (const ref of refs) changed = holdRef(entries, ref, dependent) || changed;
  return { entries, changed };
}

/** Records the dependent as a holder of the ref's claim, adding the claim when it is new. Says
 * whether anything changed. */
function holdRef(entries: OpenClaim[], ref: string, dependent: string | undefined): boolean {
  const claim = entries.find((candidate) => candidate.ref === ref);
  if (claim === undefined) {
    entries.push({ ref, dependents: dependent === undefined ? [] : [dependent] });
    return true;
  }
  if (dependent === undefined || claim.dependents.includes(dependent)) return false;
  claim.dependents.push(dependent);
  return true;
}

/** The claims whose ref is kept, by identity, none when there were none. */
export function claimsKeeping<Claim extends { readonly ref: string }>(
  claims: readonly Claim[] | undefined,
  keep: (ref: string) => boolean
): Claim[] {
  return (claims ?? []).filter((claim) => keep(claim.ref));
}
