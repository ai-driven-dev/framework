import type { PluginMcp } from "../../domain/build-layout/flat-mcp.js";
import type { DiskSinkDeps } from "../../ports/disk-sink-deps.js";
import type { DiskTarget } from "../../ports/plugin-tree-sink.js";

type RuntimeDeps = Pick<DiskSinkDeps, "flat" | "logger">;

/** What the engine handed over of one plugin, for the files other plugins share. */
interface FoldedHooks {
  readonly name: string;
  readonly hooks: string | null;
}

interface FoldedMcp {
  readonly name: string;
  readonly mcp: PluginMcp | null;
}

/** One plugin's hooks file merged into the flat tool's own; its scripts, its bridge and the
 * marketplace layout are built by the engine. Returns the files written. */
export async function writePluginHooks(
  deps: RuntimeDeps,
  t: DiskTarget,
  { name, hooks }: FoldedHooks
): Promise<number> {
  if (hooks === null) return 0;
  const artifact = t.contract.artifacts.hooks;
  if (!artifact.supported) {
    deps.logger.warn(`Skipping hooks/ in plugin '${name}' (hooks not supported for this target).`);
    return 0;
  }
  return deps.flat.writeHooks({ target: t, artifact, pluginName: name, hooksJson: hooks });
}

/** One plugin's MCP servers merged into the flat file; the marketplace layout is built by the
 * engine. */
export async function writePluginMcp(
  deps: RuntimeDeps,
  t: DiskTarget,
  { name, mcp }: FoldedMcp
): Promise<number> {
  const artifact = t.contract.artifacts.mcp;
  if (!artifact.supported || mcp === null) return 0;
  const { merge, mergeDest } = artifact;
  if (!merge || !mergeDest) return 0;
  return deps.flat.writeMcp({
    target: t,
    mcp: { merge, mergeDest },
    pluginName: name,
    servers: mcp.servers,
  });
}
