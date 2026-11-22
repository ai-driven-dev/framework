import type { InstallationFile } from "../../../../shared/domain/installation-file.js";
import type { PluginDistribution } from "../../../../shared/domain/plugin/plugin-distribution.js";
import type { ReadonlySkipList } from "../../../../shared/domain/plugin/plugin-translation-skip.js";
import type { Scope } from "../../../../shared/domain/scope.js";
import type { PluginSource } from "../../../../shared/domain/source.js";
import type { AiToolId } from "../../../../shared/domain/tool.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
// biome-ignore lint/plugin: hands the profile to the plugin translation pipeline; it narrows when installation declares its own profile input
import type { AiToolProfile } from "../../../tools/contract/tool-profile.js";
import { ProjectScopeUnsupportedError } from "../../domain/installation.error.js";
import type { Manifest } from "../../domain/manifest.js";
import type { ProjectHooksProvenance } from "../../domain/plugins/plugin-entry.js";
import { RecordedPlugin } from "../../domain/plugins/recorded-plugin.js";
import type {
  PluginTranslation,
  PluginTranslationResult,
} from "../../ports/plugin/plugin-translation.js";
import { resolveScopeForInstall, scopeBaseOf } from "../plugin/plugin-target-resolution.js";
import { writeChangedPluginFiles } from "../plugin/write-changed-plugin-files.js";
import { hashOutputFiles } from "../shared/hash-output-files.js";
import { materializeRequestedMcp } from "./flat-mcp-materializer.js";
import type { AddPluginRequest, AddPluginResult, PluginTranslator } from "./plugin-translator.js";
import { ProjectHooksMaterializer } from "./project-hooks-materializer.use-case.js";

interface PluginRegistration {
  dist: PluginDistribution;
  toolId: AiToolId;
  source: PluginSource;
  files: InstallationFile[];
  mcpEntries: ReadonlyMap<string, string>;
  projectHooks: ProjectHooksProvenance | undefined;
  componentPaths: ReadonlyMap<string, string>;
  marketplace: string | undefined;
  baseDir: string;
  scope: Scope;
  manifest: Manifest;
}

/**
 * Mode B: flat materialization: writes a plugin's content directly into the tool's plugin
 * directory, for a tool without native marketplace support. A translator adapter, not a hexagonal
 * port adapter.
 */
export class ModeBFlatMaterializationTranslator implements PluginTranslator {
  readonly mode = "flat" as const;
  private readonly projectHooks: ProjectHooksMaterializer;

  constructor(
    private readonly fs: FileWriter & FileReader,
    private readonly homedir: () => string,
    private readonly translate: PluginTranslation
  ) {
    this.projectHooks = new ProjectHooksMaterializer(fs);
  }

  async addPlugin(request: AddPluginRequest): Promise<AddPluginResult> {
    const {
      dist,
      tool,
      source,
      projectRoot,
      manifest,
      marketplace,
      userScopeDirTaken = false,
    } = request;
    const ctx = this.resolveFlatToolContext(tool, dist, projectRoot);
    if (ctx === null) return { skipped: [] };
    const mcp = await materializeRequestedMcp(this.fs, request, ctx.installedMcp);
    const hooks = await this.projectHooksOf(request, ctx.projectHooks);
    const allSkipped: ReadonlySkipList = [...ctx.skipped, ...mcp.mcpSkips, ...hooks.skipped];
    if (ctx.files.length === 0 && mcp.mcpEntries.size === 0 && hooks.projectHooks === undefined)
      return { skipped: allSkipped };
    const written = await this.writeAndRegisterPlugin({
      dist,
      toolId: tool.toolId,
      source,
      files: userScopeDirTaken ? [] : ctx.files,
      mcpEntries: mcp.mcpEntries,
      projectHooks: hooks.projectHooks,
      componentPaths: ctx.componentPaths,
      marketplace,
      baseDir: ctx.baseDir,
      scope: ctx.scope,
      manifest,
    });
    return { skipped: allSkipped, written };
  }

  private projectHooksOf(
    request: AddPluginRequest,
    hooks: PluginTranslationResult["projectHooks"]
  ) {
    const { dist, tool, projectRoot, previousProjectHooks, hooksGuard = {} } = request;
    return this.projectHooks.execute({
      dist,
      hooks,
      tool,
      projectRoot,
      previous: previousProjectHooks,
      guard: hooksGuard,
    });
  }

  private resolveFlatToolContext(
    tool: AiToolProfile,
    dist: PluginDistribution,
    projectRoot: string
  ): {
    files: InstallationFile[];
    componentPaths: ReadonlyMap<string, string>;
    skipped: ReadonlySkipList;
    installedMcp: string | null;
    projectHooks: PluginTranslationResult["projectHooks"];
    baseDir: string;
    scope: Scope;
  } | null {
    const pluginsCap = tool.plugins();
    if (pluginsCap === null) return null;
    if (pluginsCap.kind === "native" && !pluginsCap.materializesFromBuiltTree()) {
      throw new ProjectScopeUnsupportedError();
    }
    const translated = this.translate.execute({ distribution: dist, tool });
    const files = hashOutputFiles(translated.files);
    const { componentPaths, skipped, installedMcp, projectHooks } = translated;
    const scope = resolveScopeForInstall(tool);
    const baseDir = scopeBaseOf(tool, {
      scope: scope,
      projectRoot: projectRoot,
      homedir: () => this.homedir(),
    });
    return { files, componentPaths, skipped, installedMcp, projectHooks, baseDir, scope };
  }

  private async writeAndRegisterPlugin(registration: PluginRegistration): Promise<number> {
    const {
      dist,
      toolId,
      source,
      files,
      mcpEntries,
      projectHooks,
      componentPaths,
      marketplace,
      baseDir,
      scope,
      manifest,
    } = registration;
    const written = await writeChangedPluginFiles(this.fs, files, baseDir);
    const plugin = RecordedPlugin.fromDistributionWithMcp({
      dist,
      source,
      files,
      mcpEntries,
      scope,
      componentPaths,
      marketplace,
    });
    manifest.addPlugin(toolId, plugin.withProjectHooks(projectHooks));
    return written;
  }
}
