import { NativePluginCliError } from "../domain/host-registration.error.js";
import type { HostRefusal } from "../ports/host-actions.js";

/** Lets the refusal a host call returned travel as a thrown error: for a caller that has no
 * warning of its own to report it by. */
export function throwRefusal(refusal: HostRefusal): void {
  if (refusal !== undefined) throw new NativePluginCliError(refusal.detail);
}
