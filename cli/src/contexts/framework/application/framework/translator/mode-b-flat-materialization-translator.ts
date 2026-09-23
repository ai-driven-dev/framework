import { CursorProjectScopeUnsupportedError } from "../../../../../kernel/errors.js";
import type { InstallationFile } from "../../../../../kernel/file.js";
import type { FileReader } from "../../../../../kernel/ports/file-reader.js";
import type { FileWriter } from "../../../../../kernel/ports/file-writer.js";
import type { Hasher } from "../../../../../kernel/ports/hasher.js";
import type { PluginSource } from "../../../../../kernel/source.js";
import type { AiToolId } from "../../../../../kernel/tool.js";
import type { PluginsCapability } from "../../../../tools/domain/capabilities/plugins-capability.js";
import { getToolConfig, isAiTool } from "../../../../tools/domain/registry.js";
import { PluginContentTranslator } from "../../../../translate/domain/content-translator.js";
import type { PluginDistribution } from "../../../../translate/domain/plugin-distribution.js";
import type { ReadonlySkipList } from "../../../../translate/domain/plugin-translation-skip.js";
import type { Manifest } from "../../../domain/manifest.js";
import {
  InstalledPlugin,
  type PluginScope,
  type ProjectHooksProvenance,
} from "../../../domain/plugins/installed-plugin.js";
import { writePluginFiles } from "../../plugin/plugin-helpers.js";
import {
  resolveBaseDirFromRecord,
  resolveScopeForInstall,
} from "../../plugin/plugin-target-resolution.js";
import { materializeFlatMcp, refreshTrackedMcpConfigHash } from "./flat-mcp-materializer.js";
import type { PluginTranslator } from "./plugin-translator.js";
import { ProjectHooksMaterializer, withoutHooks } from "./project-hooks-materializer.js";

/**
 * Mode B — flat materialization: writes a plugin's content directly into the tool's plugin
 * directory, for a tool without native marketplace support. A translator adapter, not a hexagonal
 * port adapter.
 */
export class ModeBFlatMaterializationTranslator implements PluginTranslator {
  readonly mode = "flat" as const;
  private readonly projectHooks: ProjectHooksMaterializer;

  constructor(
    private readonly fs: FileWriter & FileReader,
    private readonly hasher: Hasher,
    private readonly homedir: () => string
  ) {
    this.projectHooks = new ProjectHooksMaterializer(fs);
  }

  async addPlugin(
    dist: PluginDistribution,
    toolId: AiToolId,
    source: PluginSource,
    projectRoot: string,
    manifest: Manifest,
    marketplace: string | undefined,
    previousMcpEntries: ReadonlyMap<string, string> = new Map(),
    userScopeDirTaken = false,
    previousProjectHooks?: ProjectHooksProvenance
  ): Promise<{ skipped: ReadonlySkipList }> {
    const ctx = this.resolveFlatToolContext(toolId, dist, projectRoot);
    if (ctx === null) return { skipped: [] };
    const mcp = await materializeFlatMcp(
      this.fs,
      this.hasher,
      dist,
      toolId,
      projectRoot,
      previousMcpEntries
    );
    await refreshTrackedMcpConfigHash(this.fs, manifest, toolId, projectRoot, mcp.outputRelPath);
    const hooks = await this.projectHooks.materializeWithProvenance(
      dist,
      toolId,
      projectRoot,
      previousProjectHooks
    );
    const allSkipped: ReadonlySkipList = [...ctx.skipped, ...mcp.mcpSkips, ...hooks.skipped];
    if (ctx.files.length === 0 && mcp.mcpEntries.size === 0 && hooks.projectHooks === undefined)
      return { skipped: allSkipped };
    await this.writeAndRegisterPlugin(
      dist,
      toolId,
      source,
      userScopeDirTaken ? [] : ctx.files,
      mcp.mcpEntries,
      hooks.projectHooks,
      ctx.componentPaths,
      marketplace,
      ctx.baseDir,
      ctx.scope,
      manifest
    );
    return { skipped: allSkipped };
  }

  private resolveFlatToolContext(
    toolId: AiToolId,
    dist: PluginDistribution,
    projectRoot: string
  ): {
    caps: Record<string, unknown>;
    files: InstallationFile[];
    componentPaths: ReadonlyMap<string, string>;
    skipped: ReadonlySkipList;
    baseDir: string;
    scope: PluginScope;
  } | null {
    const toolConfig = getToolConfig(toolId);
    if (!isAiTool(toolConfig)) return null;
    const caps = toolConfig.capabilities as Record<string, unknown>;
    const pluginsCap = caps.plugins as PluginsCapability;
    if (pluginsCap.mode === "native" && pluginsCap.installScope !== "user") {
      throw new CursorProjectScopeUnsupportedError();
    }
    const distForNative = pluginsCap.hooksDestination === "project" ? withoutHooks(dist) : dist;
    const { files, componentPaths, skipped } = new PluginContentTranslator(
      this.hasher
    ).translateWithComponentPaths(distForNative, toolConfig);
    const scope = resolveScopeForInstall(toolId);
    const baseDir = resolveBaseDirFromRecord(scope, toolId, projectRoot, this.homedir);
    return { caps, files, componentPaths, skipped, baseDir, scope };
  }

  private async writeAndRegisterPlugin(
    dist: PluginDistribution,
    toolId: AiToolId,
    source: PluginSource,
    files: InstallationFile[],
    mcpEntries: ReadonlyMap<string, string>,
    projectHooks: ProjectHooksProvenance | undefined,
    componentPaths: ReadonlyMap<string, string>,
    marketplace: string | undefined,
    baseDir: string,
    scope: PluginScope,
    manifest: Manifest
  ): Promise<void> {
    if (files.length > 0) await writePluginFiles(files, baseDir, this.fs);
    const plugin = InstalledPlugin.fromDistributionWithMcp(
      dist,
      source,
      files,
      mcpEntries,
      scope,
      componentPaths,
      marketplace
    );
    manifest.addPlugin(toolId, InstalledPlugin.withProjectHooks(plugin, projectHooks));
  }
}
