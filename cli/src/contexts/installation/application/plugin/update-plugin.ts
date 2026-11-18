import { join } from "node:path";
import { InvalidPluginScopeError } from "../../../../shared/domain/errors.js";
import { compareSemver } from "../../../../shared/domain/semver.js";
import type { AiToolId } from "../../../../shared/domain/tool.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import type { Manifest } from "../../domain/manifest.js";
import type { InstalledPlugin } from "../../domain/plugins/installed-plugin.js";
import { PLUGIN_CACHE_SUBDIR } from "../../domain/project-layout.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";
import type { RuntimeConfigSection } from "../../ports/tool-sections.js";
import type { InstallRuntimeConfig } from "../install/config/install-runtime-config.js";
import type { ReplacePluginFiles } from "../materialize/replace-plugin-files.js";
import { requireManifest } from "../shared/require-manifest.js";
import type { PluginDistributionLoader } from "./plugin-distribution-loader.js";
import { resolvePluginToolIds } from "./plugin-target-resolution.js";

export interface UpdatePluginCommand {
  pluginNames?: string[];
  toolIds: AiToolId[] | "all";
  projectRoot: string;
  scope?: "project" | "user";
  /** Re-materialize at the same version: the source or the build changed, not the plugin's
   * version, as a new agent provider changes it. `sync --global` drives the machine-scope one. */
  rebuild?: boolean;
}

export class UpdatePlugin {
  constructor(
    private readonly manifestRepo: ManifestRepository,
    private readonly distributionLoader: PluginDistributionLoader,
    private readonly replacePluginFiles: ReplacePluginFiles,
    private readonly tools: ToolCatalog,
    private readonly pluginRuntime?: Pick<InstallRuntimeConfig, "ensurePluginRuntimeFiles">
  ) {}

  async execute(options: UpdatePluginCommand): Promise<string[]> {
    if (options.scope === "user")
      throw new Error("User-scope plugin update requires UpdateUserPluginFiles.");
    const { pluginNames, toolIds, projectRoot } = options;
    const manifest = await requireManifest(this.manifestRepo);
    const resolvedToolIds = resolvePluginToolIds(toolIds, manifest, this.tools);
    const cacheDir = join(projectRoot, PLUGIN_CACHE_SUBDIR);
    const updated: string[] = [];
    for (const toolId of resolvedToolIds) {
      const names = await this.updatePluginsForTool(
        this.tools.aiProfile(toolId),
        pluginNames,
        projectRoot,
        cacheDir,
        manifest,
        options.rebuild === true
      );
      updated.push(...names);
    }
    await this.manifestRepo.save(manifest);
    return updated;
  }

  private async updatePluginsForTool(
    tool: RuntimeConfigSection,
    pluginNames: string[] | undefined,
    projectRoot: string,
    cacheDir: string,
    manifest: Manifest,
    rebuild: boolean
  ): Promise<string[]> {
    const plugins = manifest.getPlugins(tool.toolId);
    const targets = pluginNames
      ? plugins.filter((p) => pluginNames.includes(p.name))
      : plugins.filter((plugin) => plugin.scope !== "user");
    const updated: string[] = [];
    for (const plugin of targets) {
      const didUpdate = await this.updateOnePlugin(
        plugin,
        tool,
        projectRoot,
        cacheDir,
        manifest,
        rebuild
      );
      if (didUpdate) updated.push(plugin.name);
    }
    return updated;
  }

  private async updateOnePlugin(
    plugin: InstalledPlugin,
    tool: RuntimeConfigSection,
    projectRoot: string,
    cacheDir: string,
    manifest: Manifest,
    rebuild: boolean
  ): Promise<boolean> {
    const toolId = tool.toolId;
    if (plugin.scope === "user") throw new InvalidPluginScopeError(toolId, "project", "user");
    const dist = await this.distributionLoader.load(plugin.source, cacheDir, {
      forceRefresh: true,
    });
    await this.pluginRuntime?.ensurePluginRuntimeFiles(tool, projectRoot, manifest);
    if (!rebuild && compareSemver(dist.manifest.version, plugin.version) <= 0) return false;
    await this.replacePluginFiles.execute({
      plugin,
      dist,
      toolId,
      projectRoot,
      manifest,
    });
    return true;
  }
}
