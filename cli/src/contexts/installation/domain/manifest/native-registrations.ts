/** Where the host says a marketplace comes from, kept to tell a stale entry from a current one. */
export type NativeMarketplaceSource =
  | { readonly kind: "registry"; readonly source: string }
  | {
      readonly kind: "effective-list";
      readonly root: string;
      readonly sourceType: string;
      readonly source: string;
    };

/** A marketplace as the manifest records it: the project's alias and the host's own name. */
export interface NativeMarketplaceRegistration {
  readonly alias: string;
  readonly hostName: string;
  /** Absent on older records. */
  readonly provenance?: NativeMarketplaceSource;
}

/** The host data the manifest stores for a tool; claims on its refs are kept apart. */
export interface RegistrationRecord {
  readonly binary: string;
  readonly marketplaces: readonly NativeMarketplaceRegistration[];
  readonly pluginRefs: readonly string[];
}

export interface NativeRegistrations extends RegistrationRecord {
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
