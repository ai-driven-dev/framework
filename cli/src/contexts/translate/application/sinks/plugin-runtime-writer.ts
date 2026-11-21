import { join } from "node:path";
import type { PluginDistribution } from "../../../../shared/domain/plugin/plugin-distribution.js";
import { flatMcpServers } from "../../domain/build-layout/flat-mcp.js";
import { PLUGIN_HOOKS_RELATIVE } from "../../domain/canon-format.js";
import type { DiskSinkDeps, PluginSource } from "../../ports/disk-sink-deps.js";
import type { DiskTarget } from "../../ports/plugin-tree-sink.js";

type RuntimeDeps = Pick<DiskSinkDeps, "fs" | "flat" | "logger">;

/** One plugin's hooks file merged into the flat tool's own; its scripts, its bridge and the
 * marketplace layout are built by the engine. Returns the files written. */
export async function writePluginHooks(
  deps: RuntimeDeps,
  t: DiskTarget,
  plugin: PluginSource
): Promise<number> {
  const artifact = t.contract.artifacts.hooks;
  const hooksSrc = join(plugin.src, t.mode === "flat" ? PLUGIN_HOOKS_RELATIVE : "hooks");
  if (!artifact.supported) {
    if (t.mode === "flat" && (await deps.fs.fileExists(hooksSrc))) {
      deps.logger.warn(
        `Skipping hooks/ in plugin '${plugin.name}' (hooks not supported for this target).`
      );
    }
    return 0;
  }
  if (!(await deps.fs.fileExists(hooksSrc))) return 0;
  if (t.mode === "marketplace") return 0;
  return deps.flat.writeHooks({
    target: t,
    artifact,
    pluginName: plugin.name,
    hooksSrc,
  });
}

/** One plugin's MCP servers merged into the flat file; the marketplace layout is built by the
 * engine. */
export async function writePluginMcp(
  deps: RuntimeDeps,
  t: DiskTarget,
  canon: PluginDistribution
): Promise<number> {
  const artifact = t.contract.artifacts.mcp;
  if (!artifact.supported || t.mode === "marketplace") return 0;
  const { merge, mergeDest } = artifact;
  if (!merge || !mergeDest) return 0;
  const servers = flatMcpServers(canon);
  if (servers === null) return 0;
  return deps.flat.writeMcp({
    target: t,
    mcp: { merge, mergeDest },
    pluginName: canon.manifest.name,
    servers,
  });
}
