import type { NativeMarketplaceSource } from "../../../tools/domain/ports/native-marketplace-source-reader.js";

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
    marketplaces: registrations.marketplaces.map((m) => ({
      ...m,
      ...(m.provenance === undefined ? {} : { provenance: { ...m.provenance } }),
    })),
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
    marketplaces: data.marketplaces.map((m) => ({
      alias: m.alias,
      hostName: m.hostName,
      ...(validProvenance(m.provenance) ? { provenance: { ...m.provenance } } : {}),
    })),
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

function validProvenance(value: unknown): value is NativeMarketplaceSource {
  if (value === null || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  if (typeof data.source !== "string" || data.source === "") return false;
  if (data.kind === "registry") return true;
  return (
    data.kind === "effective-list" &&
    typeof data.root === "string" &&
    data.root !== "" &&
    typeof data.sourceType === "string" &&
    data.sourceType !== ""
  );
}
