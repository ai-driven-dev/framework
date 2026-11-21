import { join } from "node:path";
import { PLUGIN_AGENT_INPUT_EXT } from "../../domain/canon-format.js";
import type { DiskSinkDeps, PluginSource } from "../../ports/disk-sink-deps.js";
import type { DiskTarget } from "../../ports/plugin-tree-sink.js";

type ContentDeps = Pick<DiskSinkDeps, "fs" | "flat">;

/** One plugin's agents in the flat layout; the marketplace one is built by the engine. Returns
 * the files written. */
export async function writePluginAgents(
  deps: ContentDeps,
  t: DiskTarget,
  plugin: PluginSource
): Promise<number> {
  const artifact = t.contract.artifacts.agents;
  if (!artifact.supported || t.mode === "marketplace") return 0;
  const agentsSrc = join(plugin.src, "agents");
  let count = 0;
  for (const absPath of await deps.fs.listFilesRecursive(agentsSrc)) {
    if (!absPath.endsWith(PLUGIN_AGENT_INPUT_EXT)) continue;
    count += await deps.flat.writeAgent({
      target: t,
      artifact,
      pluginName: plugin.name,
      absPath,
      srcRoot: agentsSrc,
    });
  }
  return count;
}
