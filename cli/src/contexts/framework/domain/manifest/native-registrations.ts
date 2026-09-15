/** One marketplace registration a tool's own CLI was asked to make — aidd's own local name for it
 * (`alias`, what this project's registry is keyed by) beside what the host actually registered it
 * under (`hostName`, the catalog's own declared name, which every host-facing call must use
 * instead). The two differ whenever a project chooses a local alias its catalog does not declare
 * itself under, a supported capability. */
export interface NativeMarketplaceRegistration {
  readonly alias: string;
  readonly hostName: string;
}

export interface NativeRegistrations {
  readonly binary: string;
  readonly marketplaces: readonly NativeMarketplaceRegistration[];
  readonly pluginRefs: readonly string[];
  readonly pluginClaims?: readonly NativePluginClaim[];
}

export interface NativePluginClaim {
  readonly ref: string;
  readonly dependents: readonly string[];
}

export interface NativeRegistrationsData {
  binary: string;
  marketplaces: NativeMarketplaceRegistration[];
  pluginRefs: string[];
  pluginClaims?: NativePluginClaim[];
}

export function toNativeRegistrationsData(
  registrations: NativeRegistrations
): NativeRegistrationsData {
  return {
    binary: registrations.binary,
    marketplaces: registrations.marketplaces.map((m) => ({ ...m })),
    pluginRefs: [...registrations.pluginRefs],
    ...(registrations.pluginClaims === undefined
      ? {}
      : {
          pluginClaims: registrations.pluginClaims.map((claim) => ({
            ref: claim.ref,
            dependents: [...claim.dependents],
          })),
        }),
  };
}

export function parseNativeRegistrations(
  data: NativeRegistrationsData | undefined
): NativeRegistrations | undefined {
  if (data === undefined) return undefined;
  return {
    binary: data.binary,
    marketplaces: data.marketplaces.map((m) => ({ alias: m.alias, hostName: m.hostName })),
    pluginRefs: [...data.pluginRefs],
    ...(data.pluginClaims === undefined
      ? {}
      : {
          pluginClaims: data.pluginClaims.map((claim) => ({
            ref: claim.ref,
            dependents: [...claim.dependents],
          })),
        }),
  };
}
