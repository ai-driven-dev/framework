import {
  type RegistrationRecord,
  readRegistrationRecord,
} from "../../../src/contexts/host-registration/domain/record/registration-record.js";
import type { ToolRecord } from "../../../src/contexts/installation/contract/records/scope-records.js";
import {
  type HeldClaim,
  type HeldRefClaim,
  holdersOf as holdersRead,
  pluginClaimsNamed,
  readHeldClaims,
  readHeldRefClaims,
} from "../../../src/contexts/machine-claims/domain/plugin-claim.model.js";

type ClaimedRecord = RegistrationRecord & { readonly pluginClaims?: readonly HeldClaim[] };

/** The claims a manifest's registrations keep on their refs, as machine claims read them. */
export function claimsRecorded(registrations: ToolRecord | undefined): HeldRefClaim[] {
  return readHeldRefClaims(registrations?.pluginClaims);
}

/** The project roots holding claims, as machine claims read them. */
export const holdersRecorded = holdersRead;

/** A record's claims on the named plugins, as machine claims read them. */
export function pluginClaimsRecorded(
  registrations: ToolRecord | undefined,
  names: readonly string[]
) {
  return pluginClaimsNamed(readHeldClaims(registrations?.pluginClaims), names);
}

/** The project roots a record's claim on a plugin lists, as machine claims read them. */
export function dependentsRecorded(
  registrations: ToolRecord | undefined,
  plugin: string
): readonly string[] {
  return holdersRead(pluginClaimsRecorded(registrations, [plugin]));
}

/** A manifest's registrations as the host reads them, for a test that asserts on their fields:
 * the manifest holds them opaque, so only the host's reading gives them a shape. */
export function hostRecord(registrations: ToolRecord | undefined): ClaimedRecord | undefined {
  const record = readRegistrationRecord(registrations);
  if (record === undefined) return undefined;
  return registrations?.pluginClaims === undefined
    ? record
    : { ...record, pluginClaims: readHeldClaims(registrations?.pluginClaims) };
}
