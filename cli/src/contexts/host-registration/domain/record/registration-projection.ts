import { refOnAnyHost } from "./host-ref.js";
import {
  type NativeMarketplaceRegistration,
  sameNativeMarketplaceSource,
} from "./native-marketplace-source.js";
import {
  type ClaimedRegistrationRecord,
  type DependentClaim,
  type RecordedClaim,
  type RegistrationRecord,
  readRegistrationRecord,
  registrationRecordData,
} from "./registration-record.js";

/** What one tool's activation reported, which its record is rebuilt from. */
interface ActivationOutcome {
  readonly marketplaces: readonly NativeMarketplaceRegistration[];
  readonly preservedMarketplaces: readonly NativeMarketplaceRegistration[];
  readonly pluginRefs: readonly string[];
}

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
 * The record a tool's activation leaves, `undefined` when it equals the one recorded. A narrowed
 * run reports only the marketplaces it touched, so every other entry survives; an unnarrowed run
 * replaces outright, since anything it does not report is a dead registration. Refs are kept by
 * the host name they sit on, and only for a host name no retained marketplace still owns: two
 * aliases may share one. Order counts, both sides being built in the same order each run.
 */
export function afterActivation<Claim extends RecordedClaim>(
  existing: ClaimedRegistrationRecord<Claim> | undefined,
  outcome: ActivationOutcome,
  binary: string,
  narrowed: boolean
): ClaimedRegistrationRecord<Claim> | undefined {
  const recorded = readRegistrationRecord(existing);
  const projected = [...outcome.marketplaces, ...outcome.preservedMarketplaces];
  const recordedRefs = recorded?.pluginRefs ?? [];
  const retainedMarketplaces = narrowed ? untouchedBy(recorded?.marketplaces ?? [], projected) : [];
  const released = releasedHostNames(projected, retainedMarketplaces);
  const retainedRefs = narrowed ? recordedRefs.filter((ref) => !refOnAnyHost(ref, released)) : [];
  const preservedHostNames = hostNamesOf(outcome.preservedMarketplaces);
  const preservedRefs = recordedRefs.filter((ref) => refOnAnyHost(ref, preservedHostNames));
  const rebuilt = {
    binary,
    marketplaces: [...retainedMarketplaces, ...projected],
    pluginRefs: [...new Set([...retainedRefs, ...preservedRefs, ...outcome.pluginRefs])],
  };
  const activated: ClaimedRegistrationRecord<Claim> = {
    ...registrationRecordData(rebuilt),
    ...(existing?.pluginClaims === undefined ? {} : { pluginClaims: existing.pluginClaims }),
  };
  return recorded !== undefined && sameActivation(recorded, rebuilt) ? undefined : activated;
}

const hostNamesOf = (marketplaces: readonly NativeMarketplaceRegistration[]): Set<string> =>
  new Set(marketplaces.map((entry) => entry.hostName));

function untouchedBy(
  recorded: readonly NativeMarketplaceRegistration[],
  touched: readonly NativeMarketplaceRegistration[]
): NativeMarketplaceRegistration[] {
  const touchedAliases = new Set(touched.map((entry) => entry.alias));
  return recorded.filter((entry) => !touchedAliases.has(entry.alias));
}

function releasedHostNames(
  touched: readonly NativeMarketplaceRegistration[],
  retained: readonly NativeMarketplaceRegistration[]
): string[] {
  const stillOwned = hostNamesOf(retained);
  return [...hostNamesOf(touched)].filter((hostName) => !stillOwned.has(hostName));
}

function sameActivation(recorded: RegistrationRecord, activated: RegistrationRecord): boolean {
  return (
    recorded.binary === activated.binary &&
    sameInOrder(recorded.marketplaces, activated.marketplaces, sameMarketplace) &&
    sameInOrder(recorded.pluginRefs, activated.pluginRefs, (a, b) => a === b)
  );
}

function sameMarketplace(
  a: NativeMarketplaceRegistration,
  b: NativeMarketplaceRegistration
): boolean {
  if (a.alias !== b.alias || a.hostName !== b.hostName) return false;
  if (a.provenance === undefined || b.provenance === undefined)
    return a.provenance === b.provenance;
  return sameNativeMarketplaceSource(a.provenance, b.provenance);
}

function sameInOrder<T>(a: readonly T[], b: readonly T[], same: (x: T, y: T) => boolean): boolean {
  return a.length === b.length && a.every((value, index) => same(value, b[index]));
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
  for (const ref of refs) {
    const claim = entries.find((candidate) => candidate.ref === ref);
    if (claim === undefined) {
      entries.push({ ref, dependents: dependent === undefined ? [] : [dependent] });
      changed = true;
    } else if (dependent !== undefined && !claim.dependents.includes(dependent)) {
      claim.dependents.push(dependent);
      changed = true;
    }
  }
  return { entries, changed };
}
