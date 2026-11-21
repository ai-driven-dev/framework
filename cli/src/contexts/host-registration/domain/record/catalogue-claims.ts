import {
  type NativeMarketplaceRegistration,
  sameNativeMarketplaceSource,
} from "./native-marketplace-source.js";
import {
  type ClaimedRegistrationRecord,
  type DependentClaim,
  readRegistrationRecord,
  registrationRecordData,
} from "./registration-record.js";

/** What a run claims on a machine's record, and for which project. */
interface CatalogueClaims {
  readonly marketplaces: readonly NativeMarketplaceRegistration[];
  readonly refs: readonly string[];
  /** The project root holding the claims, none when the project is unknown. */
  readonly dependent: string | undefined;
}

/** The machine record once the claims are merged, and whether the merge changed anything. */
interface MergedClaims {
  readonly record: ClaimedRegistrationRecord<DependentClaim> & {
    readonly pluginClaims: readonly DependentClaim[];
  };
  readonly changed: boolean;
}

/**
 * A machine's record with the claims of one run merged in: a marketplace is added, or replaced
 * when the claim proves another source than the recorded one; a ref gains the dependent as a
 * holder of its claim. The fallback binary names the record only when none was recorded.
 */
export function mergeCatalogueClaims(
  existing: ClaimedRegistrationRecord<DependentClaim> | undefined,
  claimed: CatalogueClaims,
  fallbackBinary: string
): MergedClaims {
  const recorded = readRegistrationRecord(existing);
  const marketplaces = mergeMarketplaceClaims(recorded?.marketplaces ?? [], claimed.marketplaces);
  const claims = mergeRefClaims(existing?.pluginClaims ?? [], claimed.refs, claimed.dependent);
  return {
    record: {
      ...registrationRecordData({
        binary: recorded?.binary ?? fallbackBinary,
        marketplaces: marketplaces.entries,
        pluginRefs: recorded?.pluginRefs ?? [],
      }),
      pluginClaims: claims.entries,
    },
    changed: marketplaces.changed || claims.changed,
  };
}

interface Merged<Entry> {
  readonly entries: Entry[];
  readonly changed: boolean;
}

function mergeMarketplaceClaims(
  recorded: readonly NativeMarketplaceRegistration[],
  claimed: readonly NativeMarketplaceRegistration[]
): Merged<NativeMarketplaceRegistration> {
  const entries = [...recorded];
  let changed = false;
  for (const claim of claimed) {
    const index = entries.findIndex(
      (entry) => entry.alias === claim.alias && entry.hostName === claim.hostName
    );
    if (index < 0) {
      entries.push(claim);
      changed = true;
    } else if (provesAnotherSource(claim, entries[index])) {
      entries[index] = claim;
      changed = true;
    }
  }
  return { entries, changed };
}

/** A claim without a source proves nothing, so it never displaces a recorded entry. */
function provesAnotherSource(
  claim: NativeMarketplaceRegistration,
  recorded: NativeMarketplaceRegistration
): boolean {
  return (
    claim.provenance !== undefined &&
    (recorded.provenance === undefined ||
      !sameNativeMarketplaceSource(recorded.provenance, claim.provenance))
  );
}

interface HeldClaim {
  readonly ref: string;
  readonly dependents: string[];
}

function mergeRefClaims(
  recorded: readonly DependentClaim[],
  refs: readonly string[],
  dependent: string | undefined
): Merged<HeldClaim> {
  const entries = recorded.map((claim) => ({ ref: claim.ref, dependents: [...claim.dependents] }));
  let changed = false;
  for (const ref of refs) changed = holdRef(entries, ref, dependent) || changed;
  return { entries, changed };
}

/** Records the dependent as a holder of the ref's claim, adding the claim when it is new. Says
 * whether anything changed. */
function holdRef(entries: HeldClaim[], ref: string, dependent: string | undefined): boolean {
  const claim = entries.find((candidate) => candidate.ref === ref);
  if (claim === undefined) {
    entries.push({ ref, dependents: dependent === undefined ? [] : [dependent] });
    return true;
  }
  if (dependent === undefined || claim.dependents.includes(dependent)) return false;
  claim.dependents.push(dependent);
  return true;
}
