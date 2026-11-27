import { join } from "node:path";
import type { AiToolId } from "../../../../shared/domain/tool.js";
// biome-ignore lint/plugin: hands the profile to the plugin translation pipeline; it narrows when installation declares its own profile input
import type { AiToolProfile } from "../../../tools/contract/tool-profile.js";
import type { Manifest } from "../../domain/manifest.js";
import type { RecordedPlugin } from "../../domain/plugins/recorded-plugin.js";
import { PLUGIN_CACHE_SUBDIR } from "../../domain/project-layout.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";
import type { InstallationCatalog, NativeRegistrationReach } from "../../ports/tool-sections.js";
import { loadMachineManifest } from "../shared/load-machine-manifest.js";
import type { ApplyPluginFiles } from "./apply-plugin-files.use-case.js";

interface RestoreAllPluginsRequest {
  projectRoot: string;
  manifest: Manifest;
  fileFilter: ((p: string) => boolean) | null;
  pluginName?: string;
  /** Restrict which AI tools' plugins get touched. Undefined means every installed AI tool (unscoped). */
  toolIds?: readonly string[];
  force?: boolean;
}

interface PluginRestoreScope {
  manifest: Manifest;
  machine: Manifest;
  projectRoot: string;
  cacheDir: string;
  fileFilter: ((p: string) => boolean) | null;
  pluginName: string | undefined;
  force: boolean;
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

/** What RestoreAllPlugins is built from. */
export interface RestoreAllPluginsDeps {
  readonly applyPluginFiles: Pick<ApplyPluginFiles, "execute">;
  readonly machineManifest: Pick<ManifestRepository, "load">;
}

export class RestoreAllPlugins {
  constructor(
    private readonly deps: RestoreAllPluginsDeps,
    private readonly tools: InstallationCatalog
  ) {}

  async execute(options: RestoreAllPluginsRequest): Promise<RestoreAllPluginsResult> {
    const { projectRoot, manifest, fileFilter, pluginName, toolIds, force = false } = options;
    const scope: PluginRestoreScope = {
      manifest,
      machine: await loadMachineManifest(this.deps.machineManifest),
      projectRoot,
      cacheDir: join(projectRoot, PLUGIN_CACHE_SUBDIR),
      fileFilter,
      pluginName,
      force,
    };
    let totalFiles = 0;
    const restoredNames = new Set<string>();
    const nativeOnlyToolIds: AiToolId[] = [];
    const selected = this.tools
      .idsInCanonicalOrder("ai")
      .filter((toolId) => manifest.hasTool(toolId) && (toolIds?.includes(toolId) ?? true));
    for (const toolId of selected) {
      const toolConfig = this.tools.aiProfile(toolId);
      const targets = this.targetPlugins(toolId, manifest, pluginName);
      if (this.isNativeOnly(targets, toolConfig)) nativeOnlyToolIds.push(toolId);
      const result = await this.restoreToolPlugins(toolId, toolConfig, scope);
      totalFiles += result.totalFiles;
      for (const name of result.pluginNames) restoredNames.add(name);
    }
    return { totalFiles, pluginNames: [...restoredNames], nativeOnlyToolIds };
  }

  private targetPlugins(
    toolId: AiToolId,
    manifest: Manifest,
    pluginName: string | undefined
  ): readonly RecordedPlugin[] {
    const plugins = manifest.getRecordedPlugins(toolId);
    return pluginName !== undefined ? plugins.filter((p) => p.plugin.name === pluginName) : plugins;
  }

  private isNativeOnly(
    targets: readonly RecordedPlugin[],
    toolConfig: NativeRegistrationReach
  ): boolean {
    return (
      targets.length > 0 &&
      targets.every(({ plugin }) => plugin.files.size === 0) &&
      Boolean(toolConfig.nativeActivation())
    );
  }

  private async restoreToolPlugins(
    toolId: AiToolId,
    toolConfig: AiToolProfile,
    scope: PluginRestoreScope
  ): Promise<{ totalFiles: number; pluginNames: string[] }> {
    const { manifest, machine, projectRoot, cacheDir, fileFilter, pluginName, force } = scope;
    let totalFiles = 0;
    const pluginNames: string[] = [];
    const targets = this.targetPlugins(toolId, manifest, pluginName);
    for (const plugin of targets) {
      const filesWritten = await this.deps.applyPluginFiles.execute({
        toolId,
        plugin,
        tool: toolConfig,
        projectRoot,
        cacheDir,
        manifest,
        machine,
        fileFilter,
        force,
      });
      totalFiles += filesWritten;
      if (filesWritten > 0) pluginNames.push(plugin.plugin.name);
    }
    return { totalFiles, pluginNames };
  }
}
