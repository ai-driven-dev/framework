import { refOnAnyHost } from "./host-ref.js";
import {
  type NativeMarketplaceRegistration,
  sameNativeMarketplaceSource,
} from "./native-marketplace-source.js";
import {
  type ClaimedRegistrationRecord,
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

/** The host binary an activation ran, and whether the run was narrowed to some marketplaces. */
export interface ActivationRun {
  readonly binary: string;
  readonly narrowed: boolean;
}

/**
 * The record a tool's activation leaves, `undefined` when it equals the one recorded. A narrowed
 * run reports only the marketplaces it touched, so every other entry survives; an unnarrowed run
 * replaces outright, since anything it does not report is a dead registration. Refs are kept by
 * the host name they sit on, and only for a host name no retained marketplace still owns: two
 * aliases may share one. Order counts, both sides being built in the same order each run.
 */
export function afterActivation(
  existing: ClaimedRegistrationRecord | undefined,
  outcome: ActivationOutcome,
  { binary, narrowed }: ActivationRun
): ClaimedRegistrationRecord | undefined {
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
  const activated: ClaimedRegistrationRecord = {
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
