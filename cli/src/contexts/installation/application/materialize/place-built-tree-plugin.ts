import type { InstallationFile } from "../../../../shared/domain/installation-file.js";
import type { Scope } from "../../../../shared/domain/scope.js";
import { RecordedPlugin } from "../../domain/plugins/recorded-plugin.js";
import { resolveScopeForInstall, scopeBaseOf } from "../plugin/plugin-target-resolution.js";
import { writeChangedPluginFiles } from "../plugin/write-changed-plugin-files.js";
import type { AddPluginRequest, AddPluginResult, PlacementDeps } from "./add-plugin-request.js";
import { placeFlatPlugin } from "./place-flat-plugin.js";
import { type BuiltTreeRead, readTranslatedBuiltTree } from "./read-translated-built-tree.js";

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
      : (await deps.built.marketplaceRegistry.list(projectRoot)).find(
          (m) => m.name === marketplace
        );
  if (marketplace === undefined || resolved === undefined) {
    return placeFlatPlugin(request, {
      fs: deps.fs,
      homedir: deps.built.homedir,
      translate: deps.built.translate,
      projectHooks: deps.built.projectHooks,
    });
  }
  const mode = tool.frameworkBuildMode();
  const { files, hooks, mcp } = await readTranslatedBuiltTree(request, {
    deps,
    marketplace: resolved,
    mode,
  });
  const scope = resolveScopeForInstall(tool);
  const owned = request.userScopeDirTaken === true ? [] : files;
  const baseDir =
    mode === "flat"
      ? projectRoot
      : scopeBaseOf(tool, { scope, projectRoot, homedir: () => deps.built.homedir() });
  const written = await writeChangedPluginFiles(deps.fs, owned, baseDir);
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
