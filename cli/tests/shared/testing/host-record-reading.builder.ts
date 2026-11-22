import {
  type RegistrationRecord,
  readRegistrationRecord,
} from "../../../src/contexts/host-registration/domain/record/registration-record.js";
import type { NativeRegistrations } from "../../../src/contexts/installation/domain/manifest/native-registrations.js";
import {
  type HeldRefClaim,
  readHeldClaims,
} from "../../../src/contexts/machine-claims/domain/ref-claims.js";

type ClaimedRecord = RegistrationRecord & { readonly pluginClaims?: readonly HeldRefClaim[] };

/** The claims a manifest's registrations keep on their refs, as machine claims read them. */
export function claimsRecorded(registrations: NativeRegistrations | undefined): HeldRefClaim[] {
  return readHeldClaims(registrations?.pluginClaims);
}

/** A manifest's registrations as the host reads them, for a test that asserts on their fields:
 * the manifest holds them opaque, so only the host's reading gives them a shape. */
export function hostRecord(
  registrations: NativeRegistrations | undefined
): ClaimedRecord | undefined {
  const record = readRegistrationRecord(registrations);
  if (record === undefined) return undefined;
  return registrations?.pluginClaims === undefined
    ? record
    : { ...record, pluginClaims: claimsRecorded(registrations) };
}
