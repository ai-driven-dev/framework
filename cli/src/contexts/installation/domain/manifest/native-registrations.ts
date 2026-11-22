import { asPlainObject } from "../../../../shared/domain/reading/plain-object.js";
import { InvalidManifestDataError } from "../installation.error.js";

/**
 * What the manifest stores for a tool's host registration, as it came. The record is opaque here:
 * host registration reads its host data and machine claims the claims block it keeps beside it,
 * so nothing is read, checked or reordered on the way in or out.
 *
 * Limit: a hand-edited record keeps what the host's rewrites pass through. Every host read goes
 * through `validProvenance`, so nothing invalid is acted on. A rewrite through the host codec
 * normalizes: `withoutMarketplace` drops entry-level unknown keys and invalid provenance but keeps
 * the top-level keys, and `afterActivation` and `mergeCatalogueClaims` drop all of it. A
 * pass-through rewrite (`withoutRef`) keeps unknown keys and invalid provenance as they came. No
 * manifest has been seen to hold either.
 */
export type NativeRegistrations = Readonly<Record<string, unknown>>;

/** A claim on a native ref, with the project roots still holding it. */
export interface NativeRefClaim {
  readonly ref: string;
  readonly dependents: readonly string[];
}

/** What the manifest carries and machine claims read: the claims a tool's record keeps on its
 * native refs, and the project roots a plugin's own claim lists. */
export interface MachineClaimsReading {
  claimsOf(registrations: NativeRegistrations | undefined): readonly NativeRefClaim[];
  dependentsOf(plugin: { readonly machineClaim?: unknown }): readonly string[];
}

/** The record as it came, copied so the manifest owns its top level. */
export function serializeNativeRegistrations(
  registrations: NativeRegistrations
): Record<string, unknown> {
  return { ...registrations };
}

export function parseNativeRegistrations(data: unknown): NativeRegistrations | undefined {
  if (data === undefined) return undefined;
  const stored = asPlainObject(data);
  if (stored === null) {
    throw new InvalidManifestDataError("nativeRegistrations: expected an object.");
  }
  return { ...stored };
}
