import type { ToolCatalog } from "../../../src/contexts/tools/contract/tool-catalog.js";
import { pluginManifestProbes } from "../../../src/contexts/translate/domain/plugin-format.js";

/** Where a plugin manifest can sit across the catalog's tools, as the composition hands them
 * to the reader. */
export function manifestProbesOf(tools: ToolCatalog) {
  return pluginManifestProbes(tools);
}

/** The same places as plain paths, as the translation engine takes them. */
export function manifestPathsOf(tools: ToolCatalog): readonly string[] {
  return manifestProbesOf(tools).map((probe) => probe.relativePath);
}
