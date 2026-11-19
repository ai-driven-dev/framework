import type { AiToolId } from "../../../shared/domain/tool.js";
import type { ToolCatalog } from "../../tools/contract/tool-catalog.js";

export interface DistributionProbe {
  /** The tool whose layout a plugin distribution follows. */
  readonly format: AiToolId;
  readonly relativePath: string;
}

/**
 * Probes ordered most specific first: deepest path wins, ties broken by the order the tools
 * were registered. The order is behaviour, not presentation: the reader takes the first probe
 * that resolves, and copilot declares a bare `plugin.json` at the root that any directory can
 * satisfy. Takes the catalog explicitly so the rule can be probed with synthetic tools.
 */
export function distributionProbesOf(
  tools: ToolCatalog,
  kind: "manifest" | "marketplace"
): readonly DistributionProbe[] {
  const probes: DistributionProbe[] = [];
  for (const format of tools.inHelpOrder("ai")) {
    for (const relativePath of tools.aiProfile(format).distributionPaths(kind)) {
      probes.push({ format, relativePath });
    }
  }
  // `sort` is stable: equally deep paths keep the order the tools were registered in.
  return probes
    .map((probe) => ({ probe, depth: probe.relativePath.split("/").length }))
    .sort((a, b) => b.depth - a.depth)
    .map((entry) => entry.probe);
}

/** Where a plugin manifest can sit, across every registered tool's layout. */
export function pluginManifestProbes(tools: ToolCatalog): readonly DistributionProbe[] {
  return distributionProbesOf(tools, "manifest");
}
