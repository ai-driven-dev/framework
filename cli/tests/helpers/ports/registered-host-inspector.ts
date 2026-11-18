import { InspectHostRegistration } from "../../../src/contexts/host-registration/application/inspect/inspect-host-registration.js";
import type { FileReader } from "../../../src/shared/ports/file-reader.js";
import { registeredTools } from "../../shared/testing/registered-tools.js";

/** The host registration inspection wired over the registered tools, as composition wires it. */
export function registeredHostInspector(
  fs: FileReader,
  pluginRegistries: ConstructorParameters<typeof InspectHostRegistration>[1],
  marketplaceRegistries: ConstructorParameters<typeof InspectHostRegistration>[2]
): InspectHostRegistration {
  return new InspectHostRegistration(
    fs,
    pluginRegistries,
    marketplaceRegistries,
    process.platform,
    registeredTools()
  );
}
