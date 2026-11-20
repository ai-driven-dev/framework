import { join } from "node:path";
import type { AiToolId } from "../../../../shared/domain/tool.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
// biome-ignore lint/plugin: hands the profile to the plugin translation pipeline; it narrows when installation declares its own profile input
import type { AiToolProfile } from "../../../tools/contract/tool-profile.js";
import type { Manifest } from "../../domain/manifest.js";
import type { InstalledPlugin } from "../../domain/plugins/installed-plugin.js";
import { PLUGIN_CACHE_SUBDIR } from "../../domain/project-layout.js";
import type { ApplyPluginFiles } from "./apply-plugin-files.js";

interface RestoreAllPluginsCommand {
  projectRoot: string;
  manifest: Manifest;
  fileFilter: ((p: string) => boolean) | null;
  pluginName?: string;
  /** Restrict which AI tools' plugins get touched. Undefined means every installed AI tool (unscoped). */
  toolIds?: readonly string[];
  force?: boolean;
}

export interface RestoreAllPluginsResult {
  totalFiles: number;
  /** Names of plugins that had >=1 file actually restored, deduped across tools. */
  pluginNames: string[];
  /** AI tools with an installed plugin this pass could not restore anything for,
   * because that tool's own CLI owns the registration and this CLI tracks zero
   * files for it: not a failure, a fact about who owns the file tree. */
  nativeOnlyToolIds: AiToolId[];
}

export class RestoreAllPlugins {
  constructor(
    private readonly applyPluginFiles: ApplyPluginFiles,
    private readonly tools: ToolCatalog
  ) {}

  async execute(options: RestoreAllPluginsCommand): Promise<RestoreAllPluginsResult> {
    const { projectRoot, manifest, fileFilter, pluginName, toolIds, force = false } = options;
    const cacheDir = join(projectRoot, PLUGIN_CACHE_SUBDIR);
    let totalFiles = 0;
    const restoredNames = new Set<string>();
    const nativeOnlyToolIds: AiToolId[] = [];
    for (const toolId of this.tools.idsInCanonicalOrder("ai")) {
      if (!manifest.hasTool(toolId)) continue;
      if (toolIds !== undefined && !toolIds.includes(toolId)) continue;
      const toolConfig = this.tools.aiProfile(toolId);
      const targets = this.targetPlugins(toolId, manifest, pluginName);
      if (
        targets.length > 0 &&
        this.everyTargetUntracked(targets) &&
        toolConfig.nativeActivation()
      ) {
        nativeOnlyToolIds.push(toolId);
      }
      const result = await this.restoreToolPlugins(
        toolId,
        manifest,
        toolConfig,
        projectRoot,
        cacheDir,
        fileFilter,
        pluginName,
        force
      );
      totalFiles += result.totalFiles;
      for (const name of result.pluginNames) restoredNames.add(name);
    }
    return { totalFiles, pluginNames: [...restoredNames], nativeOnlyToolIds };
  }

  private targetPlugins(
    toolId: AiToolId,
    manifest: Manifest,
    pluginName: string | undefined
  ): readonly InstalledPlugin[] {
    const plugins = manifest.getPlugins(toolId);
    return pluginName !== undefined ? plugins.filter((p) => p.name === pluginName) : plugins;
  }

  private everyTargetUntracked(targets: readonly InstalledPlugin[]): boolean {
    return targets.every((plugin) => plugin.files.size === 0);
  }

  private async restoreToolPlugins(
    toolId: AiToolId,
    manifest: Manifest,
    toolConfig: AiToolProfile,
    projectRoot: string,
    cacheDir: string,
    fileFilter: ((p: string) => boolean) | null,
    pluginName: string | undefined,
    force: boolean
  ): Promise<{ totalFiles: number; pluginNames: string[] }> {
    let totalFiles = 0;
    const pluginNames: string[] = [];
    const targets = this.targetPlugins(toolId, manifest, pluginName);
    for (const plugin of targets) {
      const filesWritten = await this.applyPluginFiles.execute({
        toolId,
        plugin,
        tool: toolConfig,
        projectRoot,
        cacheDir,
        manifest,
        fileFilter,
        force,
      });
      totalFiles += filesWritten;
      if (filesWritten > 0) pluginNames.push(plugin.name);
    }
    return { totalFiles, pluginNames };
  }
}
