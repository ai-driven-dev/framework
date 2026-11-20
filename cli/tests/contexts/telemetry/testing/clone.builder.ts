import {
  type CloneIdentity,
  cloneKey,
} from "../../../../src/contexts/telemetry/domain/consent/clone-identity.js";
import { consentValue } from "../../../../src/contexts/telemetry/domain/telemetry-consent.js";

/** A clone as the fakes know it: told from another at the same path by any of `overrides`. */
export function cloneOf(path: string, overrides: Partial<CloneIdentity> = {}): CloneIdentity {
  return { path, dev: "1", ino: "7", birthtimeMs: 1_000, ...overrides };
}

/** The token of the interval a test opens for `clone`: one per clone, since a token names one
 * interval. */
export function tokenOf(clone: CloneIdentity): string {
  return `token-${cloneKey(clone)}`;
}

/** What the clone's key holds once `on` has opened `clone`'s interval. */
export function grantedBy(clone: CloneIdentity): string {
  return consentValue(tokenOf(clone));
}
