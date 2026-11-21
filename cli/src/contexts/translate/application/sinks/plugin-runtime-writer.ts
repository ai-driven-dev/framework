import { basename, join, relative } from "node:path";
import { rewritePluginRootToken } from "../../../tools/contract/plugin-root-token.js";
import { PLUGIN_HOOKS_RELATIVE, PLUGIN_MCP_RELATIVE } from "../../domain/canon-format.js";
import type { DiskSinkDeps, PluginSource } from "../../ports/disk-sink-deps.js";
import type { SupportedArtifact } from "../../ports/flat-plugin-writer.js";
import type { DiskTarget } from "../../ports/plugin-tree-sink.js";

type RuntimeDeps = Pick<DiskSinkDeps, "fs" | "flat" | "logger">;

/** One plugin's hooks, in the marketplace layout or the flat one. Returns the files written. */
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
  if (t.mode === "marketplace") {
    return writeMarketplaceHooks(deps, { t, artifact, pluginName: plugin.name, hooksSrc });
  }
  return deps.flat.writeHooks({
    target: t,
    artifact,
    pluginName: plugin.name,
    hooksSrc,
    pluginSrc: plugin.src,
  });
}

async function writeMarketplaceHooks(
  deps: RuntimeDeps,
  {
    t,
    artifact,
    pluginName,
    hooksSrc,
  }: { t: DiskTarget; artifact: SupportedArtifact; pluginName: string; hooksSrc: string }
): Promise<number> {
  const pluginOut = join(t.outDir, "plugins", pluginName);
  let count = 0;
  for (const absPath of await deps.fs.listFilesRecursive(hooksSrc)) {
    const relPath = relative(hooksSrc, absPath).replace(/\\/g, "/");
    const content = await deps.fs.readFile(absPath);
    const outContent = applyPluginRootToken(
      t,
      artifact.transform && absPath.endsWith(".json")
        ? artifact.transform(content, pluginName, basename(absPath))
        : content
    );
    const script = artifact.script?.(`hooks/${relPath}`, outContent) ?? outContent;
    await deps.fs.writeFile(join(pluginOut, "hooks", relPath), script);
    count++;
  }
  return count;
}

/** One plugin's MCP servers, in the marketplace layout or merged into the flat file. */
export async function writePluginMcp(
  deps: RuntimeDeps,
  t: DiskTarget,
  plugin: PluginSource
): Promise<number> {
  const artifact = t.contract.artifacts.mcp;
  if (!artifact.supported) return 0;
  const mcpSrc = join(plugin.src, PLUGIN_MCP_RELATIVE);
  if (!(await deps.fs.fileExists(mcpSrc))) return 0;
  if (t.mode === "flat") {
    const { merge, mergeDest } = artifact;
    if (!merge || !mergeDest) return 0;
    return deps.flat.writeMcp({
      target: t,
      mcp: { merge, mergeDest },
      pluginName: plugin.name,
      mcpSrc,
    });
  }
  const content = await deps.fs.readFile(mcpSrc);
  const transformed = artifact.transform
    ? artifact.transform(content, plugin.name, PLUGIN_MCP_RELATIVE)
    : content;
  await deps.fs.writeFile(
    join(t.outDir, "plugins", plugin.name, PLUGIN_MCP_RELATIVE),
    applyPluginRootToken(t, transformed)
  );
  return 1;
}

function applyPluginRootToken(t: DiskTarget, content: string): string {
  if (!t.contract.pluginRootToken) return content;
  return rewritePluginRootToken(content, t.contract.pluginRootToken);
}
