import { pluginManifestProbes } from "../../../src/contexts/translate/domain/plugin-format.js";
import { registeredTools } from "./registered-tools.builder.js";

/** Where a plugin manifest can sit across the registered tools, as the composition hands them
 * to the reader. */
export function registeredManifestProbes() {
  return pluginManifestProbes(registeredTools());
}

/** The same places as plain paths, as the translation engine takes them. */
export function registeredManifestPaths(): readonly string[] {
  return registeredManifestProbes().map((probe) => probe.relativePath);
}
