import type { InstallationFile } from "../../../../../shared/domain/installation-file.js";
import type { Scope } from "../../../../../shared/domain/scope.js";
import type { FileReader } from "../../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../../shared/ports/file-writer.js";
import { RecordedPlugin } from "../../../domain/plugins/recorded-plugin.js";
import type { InstallationMarketplaceRegistry } from "../../../ports/marketplace-sources.js";
import { removeObsoletePluginFiles } from "../../plugin/files/remove-obsolete-plugin-files.js";
import { writeChangedPluginFiles } from "../../plugin/files/write-changed-plugin-files.js";
import { resolveScopeForInstall, scopeBaseOf } from "../../plugin/plugin-target-resolution.js";
import type { AddPluginRequest, AddPluginResult, PlaceBuiltTree } from "../add-plugin-request.js";
import type { PlaceFlat } from "../place-flat-plugin.js";
import type { BuiltTreeRead, ReadBuiltTree } from "./read-translated-built-tree.js";

/** What placing a plugin from its built tree reaches, and the flat placement it falls back to. */
export interface PlacementDeps {
  fs: FileWriter & FileReader;
  marketplaceRegistry: InstallationMarketplaceRegistry;
  homedir: () => string;
  readBuiltTree: ReadBuiltTree;
  placeFlat: PlaceFlat;
}

/** The built-tree placement, bound to the build and file system it reads. */
export function builtTreePlacement(deps: PlacementDeps): PlaceBuiltTree {
  return (request) => placeBuiltTreePlugin(request, deps);
}

/**
 * Materializes plugin content by copying the per-target BUILT tree verbatim into the tool's plugin
 * directory, bypassing the per-file transform the build already applied. Marketplace-sourced
 * installs only; a raw local-path install falls back to flat materialization.
 */
export async function placeBuiltTreePlugin(
  request: AddPluginRequest,
  deps: PlacementDeps
): Promise<AddPluginResult> {
  const { tool, projectRoot, manifest, marketplace } = request;
  const resolved =
    marketplace === undefined
      ? undefined
      : (await deps.marketplaceRegistry.list(projectRoot)).find((m) => m.name === marketplace);
  if (marketplace === undefined || resolved === undefined) {
    return deps.placeFlat(request);
  }
  const mode = tool.frameworkBuildMode();
  const { files, hooks, mcp } = await deps.readBuiltTree(request, { marketplace: resolved, mode });
  const scope = resolveScopeForInstall(tool);
  const taken = request.userScopeDirTaken === true;
  const owned = taken ? [] : files;
  const baseDir =
    mode === "flat"
      ? projectRoot
      : scopeBaseOf(tool, { scope, projectRoot, homedir: () => deps.homedir() });
  const written = await writeChangedPluginFiles(deps.fs, owned, baseDir);
  const previous = taken ? undefined : request.previousFiles;
  await removeObsoletePluginFiles(deps.fs, previous ?? new Map(), {
    current: new Set(owned.map((f) => f.relativePath)),
    baseDir,
  });
  manifest.addPlugin(tool.toolId, builtTreeEntry(request, { owned, scope, mcp, hooks }));
  return { skipped: [...mcp.mcpSkips, ...hooks.skipped], written };
}

function builtTreeEntry(
  request: AddPluginRequest,
  placed: { owned: InstallationFile[]; scope: Scope } & Pick<BuiltTreeRead, "mcp" | "hooks">
): RecordedPlugin {
  const { dist, source, marketplace } = request;
  const { owned, scope, mcp, hooks } = placed;
  return RecordedPlugin.fromDistributionWithMcp({
    dist,
    source,
    files: owned,
    mcpEntries: mcp.mcpEntries,
    scope,
    componentPaths: new Map(),
    marketplace,
  }).withProjectHooks(hooks.projectHooks);
}
