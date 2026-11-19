import { join } from "node:path";
import { asPlainObject } from "../../../../shared/domain/reading/plain-object.js";
import {
  type NativeMarketplaceRegistration,
  readMarketplaceRegistration,
  sameNativeMarketplaceSource,
} from "./native-marketplace-source.js";

/** What aidd asked a host's own CLI to register: the host data only. The installation manifest
 * stores it, and the claims on its refs stay with the manifest. */
export type RegistrationRecord = {
  readonly binary: string;
  readonly marketplaces: readonly NativeMarketplaceRegistration[];
  readonly pluginRefs: readonly string[];
};

/** A record as the manifest holds it: opaque to every reader but this one, which narrows it
 * through {@link readRegistrationRecord}. */
export type RegistrationRecordData = Readonly<Record<string, unknown>>;

/** A claim the manifest keeps on a ref: only the ref is the host's business. */
interface RecordedClaim {
  readonly ref: string;
}

/** A record together with the claims the manifest keeps beside it. */
type ClaimedRegistrationRecord<Claim extends RecordedClaim = RecordedClaim> =
  RegistrationRecordData & {
    readonly pluginClaims?: readonly Claim[];
  };

/** A claim with the projects that hold it. */
export interface DependentClaim extends RecordedClaim {
  readonly dependents: readonly string[];
}

/** The record with its claims list always written, as the manifest rewrites it. */
type WithClaims<R> = R & { readonly pluginClaims: readonly RecordedClaim[] };

interface RegistrationPreview {
  readonly binary: string;
  readonly marketplaceCount: number;
  readonly pluginRefCount: number;
  readonly cachePaths: readonly string[];
}

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

const CATALOGUE_SEPARATOR = "@";

const refOnHost = (ref: string, hostName: string): boolean =>
  ref.endsWith(`${CATALOGUE_SEPARATOR}${hostName}`);

/** Whether a ref sits on one of the host names. */
export function refOnAnyHost(ref: string, hostNames: Iterable<string>): boolean {
  return [...hostNames].some((hostName) => refOnHost(ref, hostName));
}

/** Whether a plugin selector names its catalogue, so it can only mean one exact ref. */
export function isQualifiedRef(selector: string): boolean {
  return selector.includes(CATALOGUE_SEPARATOR);
}

/** A qualified selector is one exact ref; a bare plugin name selects it in every catalogue. */
export function refSelectedBy(ref: string, selector: string): boolean {
  return isQualifiedRef(selector)
    ? ref === selector
    : ref.startsWith(`${selector}${CATALOGUE_SEPARATOR}`);
}

/** The record as the host reads it: every entry copied, a provenance that proves nothing dropped
 * while the registration stays. `undefined` when nothing was recorded or no binary was. Limit: a
 * hand-edited entry that is no registration is skipped; no manifest has been seen to hold one. */
export function readRegistrationRecord(data: unknown): RegistrationRecord | undefined {
  const record = asPlainObject(data);
  if (record === null || typeof record.binary !== "string") return undefined;
  return {
    binary: record.binary,
    marketplaces: recordedMarketplaces(record),
    pluginRefs: refsIn(record),
  };
}

/** The record as the manifest stores it: an independent copy of the host data. */
export function registrationRecordData(record: RegistrationRecord): RegistrationRecord {
  return {
    binary: record.binary,
    marketplaces: record.marketplaces.map((m) => ({
      ...m,
      ...(m.provenance === undefined ? {} : { provenance: { ...m.provenance } }),
    })),
    pluginRefs: [...record.pluginRefs],
  };
}

const refsIn = (data: unknown): readonly string[] => {
  const refs = asPlainObject(data)?.pluginRefs;
  return Array.isArray(refs) ? refs.filter((ref) => typeof ref === "string") : [];
};

export const recordedMarketplaces = (data: unknown): NativeMarketplaceRegistration[] => {
  const entries = asPlainObject(data)?.marketplaces;
  if (!Array.isArray(entries)) return [];
  return entries.flatMap((entry) => readMarketplaceRegistration(entry) ?? []);
};

/** What a tool's host holds when its record is absent or unreadable. */
const NOTHING_RECORDED: RegistrationRecord = { binary: "", marketplaces: [], pluginRefs: [] };

/** The record as the host reads it, or an empty one for data that names no binary. */
export function recordedRegistrations(data: unknown): RegistrationRecord {
  return readRegistrationRecord(data) ?? NOTHING_RECORDED;
}

/** The refs recorded on the host, none when nothing was recorded. */
export function pluginRefsOf(record: RegistrationRecordData | undefined): readonly string[] {
  return refsIn(record);
}

/** The registration aidd's local name stands for, `undefined` when the alias is absent or was
 * never registered. */
export function marketplaceOf(
  record: RegistrationRecordData | undefined,
  alias: string | undefined
): NativeMarketplaceRegistration | undefined {
  return recordedMarketplaces(record).find((entry) => entry.alias === alias);
}

const hostNameOf = (
  record: RegistrationRecordData | undefined,
  alias: string | undefined
): string | undefined => marketplaceOf(record, alias)?.hostName;

/** The claims on the refs sitting on the host name the alias was registered under. */
export function claimsOnMarketplace<Claim extends RecordedClaim>(
  record: RegistrationRecordData & { readonly pluginClaims?: readonly Claim[] },
  alias: string
): readonly Claim[] {
  const hostName = hostNameOf(record, alias);
  if (hostName === undefined) return [];
  return (record.pluginClaims ?? []).filter((claim) => refOnHost(claim.ref, hostName));
}

/** The ref a plugin has on a host catalogue, which the host knows by its own name. */
export const refOnHostName = (plugin: string, hostName: string): string =>
  `${plugin}${CATALOGUE_SEPARATOR}${hostName}`;

/**
 * The ref a plugin has on the host, `undefined` when nothing was recorded for the alias.
 * Limit: a plugin without a marketplace has no alias to look up and so no ref; only a
 * hand-edited manifest lacks one, and no real manifest has been seen to.
 */
export function refOf(
  record: RegistrationRecordData | undefined,
  plugin: string,
  alias: string | undefined
): string | undefined {
  const hostName = hostNameOf(record, alias);
  return hostName === undefined ? undefined : refOnHostName(plugin, hostName);
}

export function withoutRef<R extends RegistrationRecordData>(record: R, ref: string): R {
  return { ...record, pluginRefs: pluginRefsOf(record).filter((recorded) => recorded !== ref) };
}

/** The ref and the claim the manifest keeps on it, always writing the claims list. */
export function withoutClaimedRef<R extends ClaimedRegistrationRecord>(
  record: R,
  ref: string
): WithClaims<R> {
  return {
    ...withoutRef(record, ref),
    pluginClaims: (record.pluginClaims ?? []).filter((claim) => claim.ref !== ref),
  };
}

/** The marketplace and every ref and claim on the host name it was registered under. */
export function withoutMarketplace<R extends ClaimedRegistrationRecord>(
  record: R,
  alias: string
): WithClaims<R> {
  const hostName = hostNameOf(record, alias);
  const offHost = (ref: string): boolean => hostName === undefined || !refOnHost(ref, hostName);
  return {
    ...record,
    marketplaces: recordedMarketplaces(record).filter((entry) => entry.alias !== alias),
    pluginRefs: pluginRefsOf(record).filter(offHost),
    pluginClaims: (record.pluginClaims ?? []).filter((claim) => offHost(claim.ref)),
  };
}

export function registrationPreview(
  data: RegistrationRecordData,
  cacheRoot: string | undefined
): RegistrationPreview {
  const record = recordedRegistrations(data);
  return {
    binary: record.binary,
    marketplaceCount: record.marketplaces.length,
    pluginRefCount: record.pluginRefs.length,
    cachePaths:
      cacheRoot === undefined
        ? []
        : record.marketplaces.map((entry) => join(cacheRoot, entry.hostName)),
  };
}

/** The refs, then the claimed refs, that sit on one of the proven host names. */
export function refsOnHosts(
  record: ClaimedRegistrationRecord,
  hostNames: Iterable<string>
): string[] {
  return [...pluginRefsOf(record), ...(record.pluginClaims ?? []).map((claim) => claim.ref)].filter(
    (ref) => refOnAnyHost(ref, hostNames)
  );
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
