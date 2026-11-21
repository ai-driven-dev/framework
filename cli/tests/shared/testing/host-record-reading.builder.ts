import {
  type RegistrationRecord,
  readRegistrationRecord,
} from "../../../src/contexts/host-registration/domain/record/registration-record.js";
import type {
  NativePluginClaim,
  NativeRegistrations,
} from "../../../src/contexts/installation/domain/manifest/native-registrations.js";

type ClaimedRecord = RegistrationRecord & { readonly pluginClaims?: readonly NativePluginClaim[] };

/** A manifest's registrations as the host reads them, for a test that asserts on their fields:
 * the manifest holds them opaque, so only the host's reading gives them a shape. */
export function hostRecord(
  registrations: NativeRegistrations | undefined
): ClaimedRecord | undefined {
  const record = readRegistrationRecord(registrations);
  if (record === undefined) return undefined;
  return registrations?.pluginClaims === undefined
    ? record
    : { ...record, pluginClaims: registrations.pluginClaims };
}
