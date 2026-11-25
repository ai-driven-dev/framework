import type { InstallationFile } from "../../../../shared/domain/installation-file.js";
import { rulesGlobOf } from "../../../../shared/domain/materialization/flat-paths.js";
import type { PluginDistribution } from "../../../../shared/domain/plugin/plugin-distribution.js";
import type { ReadonlySkipList } from "../../../../shared/domain/plugin/plugin-translation-skip.js";
import type { Scope } from "../../../../shared/domain/scope.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
// biome-ignore lint/plugin: hands the profile to the plugin translation pipeline; it narrows when installation declares its own profile input
import type { AiToolProfile } from "../../../tools/contract/tool-profile.js";
import { ProjectScopeUnsupportedError } from "../../contract/installation.error.js";
import { RecordedPlugin } from "../../domain/plugins/recorded-plugin.js";
import type {
  PluginTranslation,
  PluginTranslationResult,
} from "../../ports/plugin/plugin-translation.js";
import { removeObsoletePluginFiles } from "../plugin/files/remove-obsolete-plugin-files.js";
import { writeChangedPluginFiles } from "../plugin/files/write-changed-plugin-files.js";
import { resolveScopeForInstall, scopeBaseOf } from "../plugin/plugin-target-resolution.js";
import { hashOutputFiles } from "../shared/hash-output-files.js";
import type { AddPluginRequest, AddPluginResult } from "./add-plugin-request.js";
import { materializeRequestedMcp } from "./flat-mcp-materializer.js";
import type { ProjectHooksMaterializer } from "./project-hooks-materializer.use-case.js";

export interface FlatPlacementDeps {
  fs: FileWriter & FileReader;
  homedir: () => string;
  translate: PluginTranslation;
  projectHooks: ProjectHooksMaterializer;
}

/** Places one plugin flat: written straight into the tool's plugin directory. */
export type PlaceFlat = (request: AddPluginRequest) => Promise<AddPluginResult>;

/** The flat placement, bound to the file system and translation it reads. */
export function flatPlacement(deps: FlatPlacementDeps): PlaceFlat {
  return (request) => placeFlatPlugin(request, deps);
}

interface FlatContext {
  files: InstallationFile[];
  componentPaths: ReadonlyMap<string, string>;
  skipped: ReadonlySkipList;
  installedMcp: string | null;
  projectHooks: PluginTranslationResult["projectHooks"];
  baseDir: string;
  scope: Scope;
}

/** Writes a plugin's content directly into the tool's plugin directory: a tool without native marketplace support. */
export async function placeFlatPlugin(
  request: AddPluginRequest,
  deps: FlatPlacementDeps
): Promise<AddPluginResult> {
  const { dist, tool, source, projectRoot, manifest, marketplace } = request;
  const ctx = flatContextOf(tool, dist, { projectRoot, deps });
  if (ctx === null) return { skipped: [] };
  const mcp = await materializeRequestedMcp(deps.fs, request, {
    declaration: ctx.installedMcp,
    rulesGlob: rulesGlobOf(
      tool.flatRulesPlacement(dist.manifest.name),
      ctx.files.map((file) => file.relativePath)
    ),
  });
  const hooks = await placeProjectHooks(request, { ctx, deps });
  const skipped: ReadonlySkipList = [...ctx.skipped, ...mcp.mcpSkips, ...hooks.skipped];
  // Limit: a version with no files, MCP or hooks returns here without removing what an older
  // version placed; no plugin has been observed to drop all three.
  if (ctx.files.length === 0 && mcp.mcpEntries.size === 0 && hooks.projectHooks === undefined)
    return { skipped };
  const taken = request.userScopeDirTaken === true;
  const files = taken ? [] : ctx.files;
  const written = await writeChangedPluginFiles(deps.fs, files, ctx.baseDir);
  await removeObsoletePluginFiles(deps.fs, request.previousFiles ?? new Map(), {
    current: new Set(files.map((f) => f.relativePath)),
    base: { dir: ctx.baseDir, scope: ctx.scope },
  });
  const plugin = RecordedPlugin.fromDistributionWithMcp({
    dist,
    source,
    files,
    mcpEntries: mcp.mcpEntries,
    scope: ctx.scope,
    componentPaths: ctx.componentPaths,
    marketplace,
  });
  manifest.addPlugin(tool.toolId, plugin.withProjectHooks(hooks.projectHooks));
  return { skipped, written };
}

function placeProjectHooks(
  { dist, tool, projectRoot, previousProjectHooks, hooksGuard }: AddPluginRequest,
  { ctx, deps }: { ctx: FlatContext; deps: FlatPlacementDeps }
) {
  return deps.projectHooks.execute({
    dist,
    hooks: ctx.projectHooks,
    tool,
    projectRoot,
    previous: previousProjectHooks,
    guard: hooksGuard ?? {},
  });
}

function flatContextOf(
  tool: AiToolProfile,
  dist: PluginDistribution,
  at: { projectRoot: string; deps: FlatPlacementDeps }
): FlatContext | null {
  const pluginsCap = tool.plugins();
  if (pluginsCap === null) return null;
  if (pluginsCap.kind === "native" && !pluginsCap.materializesFromBuiltTree()) {
    throw new ProjectScopeUnsupportedError();
  }
  const translated = at.deps.translate.execute({ distribution: dist, tool });
  const files = hashOutputFiles(translated.files);
  const { componentPaths, skipped, installedMcp, projectHooks } = translated;
  const scope = resolveScopeForInstall(tool);
  const baseDir = scopeBaseOf(tool, {
    scope,
    projectRoot: at.projectRoot,
    homedir: () => at.deps.homedir(),
  });
  return { files, componentPaths, skipped, installedMcp, projectHooks, baseDir, scope };
}
