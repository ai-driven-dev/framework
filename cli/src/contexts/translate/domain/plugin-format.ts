import type { AiToolId } from "../../../kernel/tool.js";
import type { ToolCatalog } from "../../tools/contract/tool-catalog.js";

/** The tool whose layout a plugin distribution follows. An alias rather than its own union: a
 * format is a tool's way of laying out a plugin, so a sixth tool is a sixth format by
 * construction. */
export type PluginFormat = AiToolId;

export interface DistributionProbe {
  readonly format: PluginFormat;
  readonly relativePath: string;
}

/**
 * Probes ordered most specific first — deepest path wins, ties broken by the order the tools
 * were registered. The order is behaviour, not presentation: the reader takes the first probe
 * that resolves, and copilot declares a bare `plugin.json` at the root that any directory can
 * satisfy. Takes the catalog explicitly so the rule can be probed with synthetic tools.
 */
export function distributionProbesOf(
  tools: ToolCatalog,
  kind: "manifest" | "marketplace"
): readonly DistributionProbe[] {
  const probes: DistributionProbe[] = [];
  for (const id of tools.inHelpOrder("ai")) {
    const format = id as AiToolId;
    for (const relativePath of tools.aiProfile(format).distributionPaths(kind)) {
      probes.push({ format, relativePath });
    }
  }
  return probes
    .map((probe, index) => ({ probe, index, depth: probe.relativePath.split("/").length }))
    .sort((a, b) => b.depth - a.depth || a.index - b.index)
    .map((entry) => entry.probe);
}

/** Where a plugin manifest can sit, across every registered tool's layout. */
export function pluginManifestProbes(tools: ToolCatalog): readonly DistributionProbe[] {
  return distributionProbesOf(tools, "manifest");
}
