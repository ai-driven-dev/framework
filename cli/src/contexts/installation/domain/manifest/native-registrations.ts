import { asPlainObject } from "../../../../shared/domain/reading/plain-object.js";
import { InvalidManifestDataError } from "../installation.error.js";

/** What the manifest stores for a tool's host registration, kept opaque as it came. */
export type NativeRegistrations = Readonly<Record<string, unknown>>;

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
