import {
  type NativeMarketplaceRegistration,
  sameNativeMarketplaceSource,
} from "./native-marketplace-source.js";
import {
  type RegistrationRecord,
  readRegistrationRecord,
  registrationRecordData,
} from "./registration-record.js";

/** The host data once a run's marketplaces are merged in, and whether the merge changed it. */
interface MergedMarketplaces {
  readonly record: RegistrationRecord;
  readonly changed: boolean;
}

/**
 * A machine's host data with the marketplaces one run claims merged in: a marketplace is added,
 * or replaced when the claim proves another source than the recorded one. The fallback binary
 * names the record only when none was recorded.
 */
export function mergeCatalogueMarketplaces(
  existing: unknown,
  claimed: readonly NativeMarketplaceRegistration[],
  fallbackBinary: string
): MergedMarketplaces {
  const recorded = readRegistrationRecord(existing);
  const merged = mergeMarketplaceClaims(recorded?.marketplaces ?? [], claimed);
  const record = registrationRecordData({
    binary: recorded?.binary ?? fallbackBinary,
    marketplaces: merged.entries,
    pluginRefs: recorded?.pluginRefs ?? [],
  });
  return { record, changed: merged.changed };
}

function mergeMarketplaceClaims(
  recorded: readonly NativeMarketplaceRegistration[],
  claimed: readonly NativeMarketplaceRegistration[]
): { readonly entries: NativeMarketplaceRegistration[]; readonly changed: boolean } {
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
