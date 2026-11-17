import { join } from "node:path";
import type { NativeMarketplaceSource } from "./native-marketplace-source.js";

/** One marketplace registration a tool's own CLI was asked to make — aidd's own local name for it
 * (`alias`, what this project's registry is keyed by) beside what the host actually registered it
 * under (`hostName`, the catalog's own declared name, which every host-facing call must use
 * instead). The two differ whenever a project chooses a local alias its catalog does not declare
 * itself under, a supported capability. */
export interface NativeMarketplaceRegistration {
  readonly alias: string;
  readonly hostName: string;
  /** Missing on legacy records: never infer current host ownership from the name alone. */
  readonly provenance?: NativeMarketplaceSource;
}

/** What aidd asked a host's own CLI to register: the host data only. The installation manifest
 * stores it, and the claims on its refs stay with the manifest. */
export interface RegistrationRecord {
  readonly binary: string;
  readonly marketplaces: readonly NativeMarketplaceRegistration[];
  readonly pluginRefs: readonly string[];
}

/** A claim the manifest keeps on a ref: only the ref is the host's business. */
interface RecordedClaim {
  readonly ref: string;
}

/** A record together with the claims the manifest keeps beside it. */
type ClaimedRegistrationRecord = RegistrationRecord & {
  readonly pluginClaims?: readonly RecordedClaim[];
};

/** The record with its claims list always written, as the manifest rewrites it. */
type WithClaims<R> = R & { readonly pluginClaims: readonly RecordedClaim[] };

interface RegistrationPreview {
  readonly binary: string;
  readonly marketplaceCount: number;
  readonly pluginRefCount: number;
  readonly cachePaths: readonly string[];
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

/** The refs recorded on the host, none when nothing was recorded. */
export function pluginRefsOf(record: RegistrationRecord | undefined): readonly string[] {
  return record?.pluginRefs ?? [];
}

/** The registration aidd's local name stands for, `undefined` when it was never registered. */
export function marketplaceOf(
  record: Pick<RegistrationRecord, "marketplaces">,
  alias: string
): NativeMarketplaceRegistration | undefined {
  return record.marketplaces.find((entry) => entry.alias === alias);
}

const hostNameOf = (
  record: Pick<RegistrationRecord, "marketplaces">,
  alias: string
): string | undefined => marketplaceOf(record, alias)?.hostName;

/** The claims on the refs sitting on the host name the alias was registered under. */
export function claimsOnMarketplace<Claim extends RecordedClaim>(
  record: Pick<RegistrationRecord, "marketplaces"> & { readonly pluginClaims?: readonly Claim[] },
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
  record: RegistrationRecord | undefined,
  plugin: string,
  alias: string | undefined
): string | undefined {
  const hostName =
    record === undefined || alias === undefined ? undefined : hostNameOf(record, alias);
  return hostName === undefined ? undefined : refOnHostName(plugin, hostName);
}

export function withoutRef<R extends RegistrationRecord>(record: R, ref: string): R {
  return { ...record, pluginRefs: record.pluginRefs.filter((recorded) => recorded !== ref) };
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
    marketplaces: record.marketplaces.filter((entry) => entry.alias !== alias),
    pluginRefs: record.pluginRefs.filter(offHost),
    pluginClaims: (record.pluginClaims ?? []).filter((claim) => offHost(claim.ref)),
  };
}

export function registrationPreview(
  record: RegistrationRecord,
  cacheRoot: string | undefined
): RegistrationPreview {
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
  record: Pick<ClaimedRegistrationRecord, "pluginRefs" | "pluginClaims">,
  hostNames: Iterable<string>
): string[] {
  return [...record.pluginRefs, ...(record.pluginClaims ?? []).map((claim) => claim.ref)].filter(
    (ref) => refOnAnyHost(ref, hostNames)
  );
}
