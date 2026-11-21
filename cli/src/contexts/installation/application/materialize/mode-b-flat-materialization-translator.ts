import { join } from "node:path";
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
import {
  InstalledPlugin,
  type ProjectHooksProvenance,
} from "../../domain/plugins/installed-plugin.js";
import type { PluginTranslation } from "../../ports/plugin/plugin-translation.js";
import { isPluginFileAtDesiredState } from "../plugin/plugin-helpers.js";
import { resolveScopeForInstall, scopeBaseOf } from "../plugin/plugin-target-resolution.js";
import { hashOutputFiles } from "../shared/hash-output-files.js";
import { materializeFlatMcp, refreshTrackedMcpConfigHash } from "./flat-mcp-materializer.js";
import type { AddPluginRequest, AddPluginResult, PluginTranslator } from "./plugin-translator.js";
import { ProjectHooksMaterializer, withoutHooks } from "./project-hooks-materializer.js";

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
      previousMcpEntries = new Map(),
      userScopeDirTaken = false,
      previousProjectHooks,
      hooksGuard = {},
    } = request;
    const ctx = this.resolveFlatToolContext(tool, dist, projectRoot);
    if (ctx === null) return { skipped: [] };
    const mcp = await materializeFlatMcp({
      fs: this.fs,
      dist,
      tool,
      projectRoot,
      previousMcpEntries,
    });
    await refreshTrackedMcpConfigHash({
      fs: this.fs,
      manifest,
      toolId: tool.toolId,
      projectRoot,
      outputRelPath: mcp.outputRelPath,
    });
    const hooks = await this.projectHooks.execute({
      dist,
      tool,
      projectRoot,
      previous: previousProjectHooks,
      guard: hooksGuard,
    });
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

  private resolveFlatToolContext(
    tool: AiToolProfile,
    dist: PluginDistribution,
    projectRoot: string
  ): {
    files: InstallationFile[];
    componentPaths: ReadonlyMap<string, string>;
    skipped: ReadonlySkipList;
    baseDir: string;
    scope: Scope;
  } | null {
    const pluginsCap = tool.plugins();
    if (pluginsCap === null) return null;
    if (pluginsCap.kind === "native" && !pluginsCap.materializesFromBuiltTree()) {
      throw new ProjectScopeUnsupportedError();
    }
    const distForNative = pluginsCap.deliversHooksToProject() ? withoutHooks(dist) : dist;
    const translated = this.translate.execute({ distribution: distForNative, tool });
    const files = hashOutputFiles(translated.files);
    const { componentPaths, skipped } = translated;
    const scope = resolveScopeForInstall(tool);
    const baseDir = scopeBaseOf(tool, {
      scope: scope,
      projectRoot: projectRoot,
      homedir: () => this.homedir(),
    });
    return { files, componentPaths, skipped, baseDir, scope };
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
    let written = 0;
    for (const file of files) {
      const outputPath = join(baseDir, file.relativePath);
      if (await isPluginFileAtDesiredState(this.fs, outputPath, file.hash.value)) continue;
      await this.fs.writeFile(outputPath, file.content);
      written++;
    }
    const plugin = InstalledPlugin.fromDistributionWithMcp({
      dist,
      source,
      files,
      mcpEntries,
      scope,
      componentPaths,
      marketplace,
    });
    manifest.addPlugin(toolId, InstalledPlugin.withProjectHooks(plugin, projectHooks));
    return written;
  }
}
