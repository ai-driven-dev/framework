import type { InstallationFile } from "../../../../../shared/domain/installation-file.js";
import type { ReadonlySkipList } from "../../../../../shared/domain/plugin/plugin-translation-skip.js";
import type { FrameworkBuildMode } from "../../../../tools/contract/tool-profile.js";
import type { MarketplaceToBuild } from "../../../contract/built-marketplace.js";
import type { ProjectHooksProvenance } from "../../../domain/plugins/plugin-entry.js";
import type { PluginTranslationResult } from "../../../ports/plugin/plugin-translation.js";
import type { AddPluginRequest, PlacementDeps } from "../add-plugin-request.js";
import { materializeRequestedMcp } from "../flat-mcp-materializer.js";
import {
  readBuiltFlatFiles,
  readBuiltUserPluginFiles,
  withoutDroppedFiles,
} from "./read-built-plugin-files.js";

export interface BuiltRead {
  deps: PlacementDeps;
  marketplace: MarketplaceToBuild;
  mode: FrameworkBuildMode;
}

export type BuiltTreeRead = Awaited<ReturnType<typeof readTranslatedBuiltTree>>;

// One translation of the request feeds both the built-tree read and the MCP merge.
export async function readTranslatedBuiltTree(request: AddPluginRequest, read: BuiltRead) {
  const { deps } = read;
  const translated = deps.built.translate.execute({
    distribution: request.dist,
    tool: request.tool,
  });
  const { files, hooks } = await readBuiltContent(request, translated, read);
  const mcp = await materializeRequestedMcp(deps.fs, request, translated.installedMcp);
  return { files, hooks, mcp };
}

// The built tree still carries a plugin's hooks for a capability declaring `hooksDestination:
// "project"`: dropped from the plugin's files, recorded once, by the project-hooks side channel
// the local-source route uses, so both land where the tool's own declaration says.
async function readBuiltContent(
  request: AddPluginRequest,
  translated: PluginTranslationResult,
  read: BuiltRead
): Promise<{
  files: InstallationFile[];
  hooks: { skipped: ReadonlySkipList; projectHooks?: ProjectHooksProvenance };
}> {
  const { dist, tool, projectRoot, previousProjectHooks, hooksGuard = {} } = request;
  const { deps, marketplace, mode } = read;
  const { builtDir } = await deps.built.ensureBuilt.execute({
    projectRoot,
    marketplace,
    target: tool.toolId,
    mode,
  });
  const deliversHooksToProject = tool.plugins()?.deliversHooksToProject() === true;
  const name = dist.manifest.name;
  const platform = deps.built.platform;
  const extraPaths = deliversHooksToProject ? new Set<string>() : translated.flatHookPaths;
  const builtRead =
    mode === "flat"
      ? await readBuiltFlatFiles(deps.fs, { builtDir, platform }, { name, tool, extraPaths })
      : await readBuiltUserPluginFiles(deps.fs, { builtDir, name, platform });
  const files = withoutDroppedFiles(builtRead, name, translated.dropsBuiltFile);
  if (!deliversHooksToProject) return { files, hooks: { skipped: [] } };
  const hooks = await deps.built.projectHooks.execute({
    dist,
    hooks: translated.projectHooks,
    tool,
    projectRoot,
    previous: previousProjectHooks,
    guard: hooksGuard,
  });
  return { files, hooks };
}
