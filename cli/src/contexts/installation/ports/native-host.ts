import type { NativeRegistrations } from "../domain/manifest/native-registrations.js";

/** A claim the manifest keeps on a ref: only the ref is the host's business. */
interface RecordedClaim {
  readonly ref: string;
}

type ClaimedRecord = Omit<NativeRegistrations, "pluginClaims"> & {
  readonly pluginClaims?: readonly RecordedClaim[];
};

/** What the settings sync asks of the host registration to read a record it keeps. */
export interface RegistrationRecordRules {
  /** The ref a plugin has on a host catalogue, which the host knows by its own name. */
  readonly refOnHostName: (plugin: string, hostName: string) => string;
  /** The refs, then the claimed refs, that sit on one of the host names. */
  readonly refsOnHosts: (record: ClaimedRecord, hostNames: Iterable<string>) => string[];
}

/** A marketplace the host registered: the manifest reads the two names and keeps the rest. */
export type RegisteredMarketplace = Readonly<Record<string, unknown>> & {
  readonly alias: string;
  readonly hostName: string;
};

/** What the manifest records after one tool's registration. */
export type HostRegistrationOutcome = {
  readonly marketplaces: readonly RegisteredMarketplace[];
  readonly preservedMarketplaces: readonly RegisteredMarketplace[];
  readonly catalogClaims: readonly RegisteredMarketplace[];
  readonly pluginRefs: readonly string[];
  /** True when a build failed, so the host keeps its earlier registration for it. */
  readonly buildFailed: boolean;
};
