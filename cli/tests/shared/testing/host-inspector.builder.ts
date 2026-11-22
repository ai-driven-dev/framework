import {
  InspectHostRegistration,
  type InspectHostRegistrationDeps,
} from "../../../src/contexts/host-registration/application/inspect/inspect-host-registration.use-case.js";
import type { ToolCatalog } from "../../../src/contexts/tools/contract/tool-catalog.js";

/** The host registration inspection wired over the catalog's tools, as composition wires it. */
export function hostInspector(
  tools: ToolCatalog,
  deps: Omit<InspectHostRegistrationDeps, "platform">
): InspectHostRegistration {
  return new InspectHostRegistration({ ...deps, platform: process.platform }, tools);
}
