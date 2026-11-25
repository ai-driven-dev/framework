import type { InstallationFile } from "../../../../../shared/domain/installation-file.js";
import type { ReadonlySkipList } from "../../../../../shared/domain/plugin/plugin-translation-skip.js";
import type { FileReader } from "../../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../../shared/ports/file-writer.js";
import type { FrameworkBuildMode } from "../../../../tools/contract/tool-profile.js";
import type {
  BuiltMarketplaceEnsurer,
  MarketplaceToBuild,
} from "../../../contract/built-marketplace.js";
import type { ProjectHooksProvenance } from "../../../domain/plugins/plugin-entry.js";
import type {
  PluginTranslation,
  PluginTranslationResult,
} from "../../../ports/plugin/plugin-translation.js";
import type { AddPluginRequest } from "../add-plugin-request.js";
import { materializeRequestedMcp } from "../flat-mcp-materializer.js";
import { deliversHooksToProject } from "../plugin-placement.js";
import type { ProjectHooksMaterializer } from "../project-hooks-materializer.use-case.js";
import {
  readBuiltFlatFiles,
  readBuiltUserPluginFiles,
  withoutDroppedFiles,
} from "./read-built-plugin-files.js";

/** What reading a plugin's built tree reaches: the build, the translation and the project hooks. */
export interface BuiltTreeReadDeps {
  fs: FileWriter & FileReader;
  ensureBuilt: BuiltMarketplaceEnsurer;
  /** The platform whose path rules spell a built file's relative path. */
  platform: string;
  translate: PluginTranslation;
  /** Delivers a plugin's hooks to the project; composition builds it. */
  projectHooks: ProjectHooksMaterializer;
}

interface BuiltRead {
  deps: BuiltTreeReadDeps;
  marketplace: MarketplaceToBuild;
  mode: FrameworkBuildMode;
}

/** Reads one registered marketplace's built tree for the request's tool. */
export type ReadBuiltTree = (
  request: AddPluginRequest,
  at: { marketplace: MarketplaceToBuild; mode: FrameworkBuildMode }
) => Promise<BuiltTreeRead>;

/** The built-tree read, bound to the build and file system it reads. */
export function builtTreeReader(deps: BuiltTreeReadDeps): ReadBuiltTree {
  return (request, at) => readTranslatedBuiltTree(request, { deps, ...at });
}

export type BuiltTreeRead = Awaited<ReturnType<typeof readTranslatedBuiltTree>>;

// One translation of the request feeds both the built-tree read and the MCP merge.
export async function readTranslatedBuiltTree(request: AddPluginRequest, read: BuiltRead) {
  const { deps } = read;
  const translated = deps.translate.execute({
    distribution: request.dist,
    tool: request.tool,
  });
  const { files, hooks } = await readBuiltContent(request, translated, read);
  const mcp = await materializeRequestedMcp(deps.fs, request, {
    declaration: translated.installedMcp,
    rulesGlob: null,
  });
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
  const { builtDir } = await deps.ensureBuilt.execute({
    projectRoot,
    marketplace,
    target: tool.toolId,
    mode,
  });
  const takesHooks = deliversHooksToProject(tool);
  const name = dist.manifest.name;
  const platform = deps.platform;
  const extraPaths = takesHooks ? new Set<string>() : translated.flatHookPaths;
  const builtRead =
    mode === "flat"
      ? await readBuiltFlatFiles(deps.fs, { builtDir, platform }, { name, tool, extraPaths })
      : await readBuiltUserPluginFiles(deps.fs, { builtDir, name, platform });
  const files = withoutDroppedFiles(builtRead, name, translated.dropsBuiltFile);
  if (!takesHooks) return { files, hooks: { skipped: [] } };
  const hooks = await deps.projectHooks.execute({
    dist,
    hooks: translated.projectHooks,
    tool,
    projectRoot,
    previous: previousProjectHooks,
    guard: hooksGuard,
  });
  return { files, hooks };
}
