import { AI_TOOL_IDS, type AiToolId } from "../../../kernel/tool.js";
import type { ToolProfile } from "../../tools/contract/tool-profile.js";

/** The tool whose layout a plugin distribution follows. An alias rather than its own union: a
 * format is a tool's way of laying out a plugin, so a sixth tool is a sixth format by
 * construction. */
export type PluginFormat = AiToolId;

export interface DistributionProbe {
  readonly format: PluginFormat;
  readonly relativePath: string;
}

/**
 * Probes ordered most specific first — deepest path wins, ties broken by tool order. The order
 * is behaviour, not presentation: the reader takes the first probe that resolves, and copilot
 * declares a bare `plugin.json` at the root that any directory can satisfy. Takes the profiles
 * explicitly so the rule can be probed with synthetic tools.
 */
export function distributionProbesOf(
  profiles: readonly ToolProfile[],
  kind: "manifest" | "marketplace"
): readonly DistributionProbe[] {
  const probes: DistributionProbe[] = [];
  for (const format of AI_TOOL_IDS) {
    const profile = profiles.find((candidate) => candidate.toolId === format);
    if (profile === undefined || profile.kind !== "ai") continue;
    for (const relativePath of profile.distributionPaths(kind)) {
      probes.push({ format, relativePath });
    }
  }
  return probes
    .map((probe, index) => ({ probe, index, depth: probe.relativePath.split("/").length }))
    .sort((a, b) => b.depth - a.depth || a.index - b.index)
    .map((entry) => entry.probe);
}

/** Where a plugin manifest can sit, across every registered tool's layout. */
export function pluginManifestProbes(
  profiles: readonly ToolProfile[]
): readonly DistributionProbe[] {
  return distributionProbesOf(profiles, "manifest");
}
