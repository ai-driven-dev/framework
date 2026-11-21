import {
  InspectHostRegistration,
  type InspectHostRegistrationDeps,
} from "../../../src/contexts/host-registration/application/inspect/inspect-host-registration.use-case.js";
import type { FileReader } from "../../../src/shared/ports/file-reader.js";
import { registeredTools } from "./registered-tools.builder.js";

/** The host registration inspection wired over the registered tools, as composition wires it. */
export function registeredHostInspector(
  fs: FileReader,
  pluginRegistries: InspectHostRegistrationDeps["pluginRegistries"],
  marketplaceRegistries: InspectHostRegistrationDeps["marketplaceRegistries"]
): InspectHostRegistration {
  return new InspectHostRegistration(
    { fs, pluginRegistries, marketplaceRegistries, platform: process.platform },
    registeredTools()
  );
}
