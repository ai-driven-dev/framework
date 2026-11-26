import type { RegisteredCatalog } from "../../../src/composition/contexts/tools.js";
import { pluginManifestProbes } from "../../../src/contexts/translate/domain/plugin-format.js";

/** Where a plugin manifest can sit across the catalog's tools, as the composition hands them
 * to the reader. */
export function manifestProbesOf(tools: RegisteredCatalog) {
  return pluginManifestProbes(tools);
}

/** The same places as plain paths, as the translation engine takes them. */
export function manifestPathsOf(tools: RegisteredCatalog): readonly string[] {
  return manifestProbesOf(tools).map((probe) => probe.relativePath);
}
