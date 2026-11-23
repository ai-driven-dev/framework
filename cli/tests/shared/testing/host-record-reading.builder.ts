import {
  type RegistrationRecord,
  readRegistrationRecord,
} from "../../../src/contexts/host-registration/domain/record/registration-record.js";
import type { ToolRecord } from "../../../src/contexts/installation/contract/records/scope-records.js";
import {
  type HeldRefClaim,
  holdersOf as holdersRead,
  readHeldClaims,
} from "../../../src/contexts/machine-claims/domain/plugin-claim.model.js";

type ClaimedRecord = RegistrationRecord & { readonly pluginClaims?: readonly HeldRefClaim[] };

/** The claims a manifest's registrations keep on their refs, as machine claims read them. */
export function claimsRecorded(registrations: ToolRecord | undefined): HeldRefClaim[] {
  return readHeldClaims(registrations?.pluginClaims);
}

/** The project roots holding plugins or refs, as machine claims read them. */
export const holdersRecorded = holdersRead;

/** The project roots a recorded plugin's machine claim lists, as machine claims read them. */
export function dependentsRecorded(plugin: { readonly machineClaim?: unknown }): readonly string[] {
  return holdersRead([plugin], []);
}

/** A manifest's registrations as the host reads them, for a test that asserts on their fields:
 * the manifest holds them opaque, so only the host's reading gives them a shape. */
export function hostRecord(registrations: ToolRecord | undefined): ClaimedRecord | undefined {
  const record = readRegistrationRecord(registrations);
  if (record === undefined) return undefined;
  return registrations?.pluginClaims === undefined
    ? record
    : { ...record, pluginClaims: claimsRecorded(registrations) };
}
