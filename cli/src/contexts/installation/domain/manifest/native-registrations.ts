import { asPlainObject } from "../../../../shared/domain/reading/plain-object.js";
import { InvalidManifestDataError } from "../installation.error.js";

export interface NativePluginClaim {
  readonly ref: string;
  readonly dependents: readonly string[];
}

/**
 * What the manifest stores for a tool's host registration. The host record is opaque here and
 * travels as it came, since only host registration knows what it means; the claims on its refs
 * are the manifest's own, so they alone are read.
 *
 * Limit: a hand-edited record keeps what the host's rewrites pass through. Every host read goes
 * through `validProvenance`, so nothing invalid is acted on. A rewrite through the host codec
 * normalizes: `withoutMarketplace` drops entry-level unknown keys and invalid provenance but keeps
 * the top-level keys, and `afterActivation` and `mergeCatalogueClaims` drop all of it. A
 * pass-through rewrite (`withoutRef`) keeps unknown keys and invalid provenance as they came. No
 * manifest has been seen to hold either.
 */
export type NativeRegistrations = Readonly<Record<string, unknown>> & {
  readonly pluginClaims?: readonly NativePluginClaim[];
};

/** The host data as it came, then the claims, which are copied so the manifest owns them. */
export function serializeNativeRegistrations(
  registrations: NativeRegistrations
): Record<string, unknown> {
  const { pluginClaims, ...host } = registrations;
  return {
    ...host,
    ...(pluginClaims === undefined
      ? {}
      : {
          pluginClaims: pluginClaims.map((claim) => ({
            ref: claim.ref,
            dependents: [...claim.dependents],
          })),
        }),
  };
}

export function parseNativeRegistrations(data: unknown): NativeRegistrations | undefined {
  if (data === undefined) return undefined;
  const stored = asPlainObject(data);
  if (stored === null) {
    throw new InvalidManifestDataError("nativeRegistrations: expected an object.");
  }
  const { pluginClaims, ...host } = stored;
  return pluginClaims === undefined ? host : { ...host, pluginClaims: readClaims(pluginClaims) };
}

function readClaims(value: unknown): NativePluginClaim[] {
  if (!Array.isArray(value)) {
    throw new InvalidManifestDataError("nativeRegistrations.pluginClaims: expected an array.");
  }
  return value.map((item) => {
    const claim = asPlainObject(item);
    if (
      claim === null ||
      typeof claim.ref !== "string" ||
      !Array.isArray(claim.dependents) ||
      !claim.dependents.every((dependent) => typeof dependent === "string")
    ) {
      throw new InvalidManifestDataError(
        "nativeRegistrations.pluginClaims: expected a ref and its dependents."
      );
    }
    return { ref: claim.ref, dependents: [...claim.dependents] };
  });
}
