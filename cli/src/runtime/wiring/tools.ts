import {
  type HostRegistrationDeps,
  wireHostRegistration,
} from "../../composition/host-registration.js";

/** The tools context's wiring: one adapter per tool whose profile declares an activation
 * shape, read off the registry rather than listed by hand, so a new tool costs no edit here. */
export function wireTools(): HostRegistrationDeps {
  return wireHostRegistration();
}
