import {
  InspectHostRegistration,
  type InspectHostRegistrationDeps,
} from "../../../src/contexts/host-registration/application/inspect/inspect-host-registration.use-case.js";
import { catalogIdentityReader } from "../../../src/contexts/host-registration/infrastructure/marketplace-registry-reader.js";
import type { ToolCatalog } from "../../../src/contexts/tools/contract/tool-catalog.js";

/** The host registration inspection wired over the catalog's tools, as composition wires it. */
export function hostInspector(
  tools: ToolCatalog,
  deps: Omit<InspectHostRegistrationDeps, "platform" | "identities">
): InspectHostRegistration {
  return new InspectHostRegistration(
    { ...deps, identities: catalogIdentityReader(deps.fs), platform: process.platform },
    tools
  );
}
