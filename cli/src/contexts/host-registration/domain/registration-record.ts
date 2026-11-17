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
export interface RecordedClaim {
  readonly ref: string;
}

/** A record together with the claims the manifest keeps beside it. */
export type ClaimedRegistrationRecord = RegistrationRecord & {
  readonly pluginClaims?: readonly RecordedClaim[];
};

/** The record with its claims list always written, as the manifest rewrites it. */
type WithClaims<R> = R & { readonly pluginClaims: readonly RecordedClaim[] };

export interface RegistrationPreview {
  readonly binary: string;
  readonly marketplaceCount: number;
  readonly pluginRefCount: number;
  readonly cachePaths: readonly string[];
}

const refOnHost = (ref: string, hostName: string): boolean => ref.endsWith(`@${hostName}`);

export function pluginRefsOf(record: RegistrationRecord): readonly string[] {
  return record.pluginRefs;
}

export function hostNameOf(record: RegistrationRecord, alias: string): string | undefined {
  return record.marketplaces.find((entry) => entry.alias === alias)?.hostName;
}

export function refOf(
  record: RegistrationRecord,
  plugin: string,
  alias: string
): string | undefined {
  const hostName = hostNameOf(record, alias);
  return hostName === undefined ? undefined : `${plugin}@${hostName}`;
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
  hostNames: readonly string[]
): string[] {
  return [...record.pluginRefs, ...(record.pluginClaims ?? []).map((claim) => claim.ref)].filter(
    (ref) => hostNames.some((hostName) => refOnHost(ref, hostName))
  );
}
