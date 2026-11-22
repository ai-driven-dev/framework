import { join } from "node:path";
import { compareSemver } from "../../../../shared/domain/plugin/semver.js";
import type { Scope } from "../../../../shared/domain/scope.js";
import type { AiToolId } from "../../../../shared/domain/tool.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import { InvalidPluginScopeError } from "../../domain/installation.error.js";
import type { Manifest } from "../../domain/manifest.js";
import type { RecordedPlugin } from "../../domain/plugins/recorded-plugin.js";
import { PLUGIN_CACHE_SUBDIR } from "../../domain/project-layout.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";
import type { LoadDistribution } from "../../ports/plugin/load-plugin-distribution.js";
import type { RuntimeConfigSection } from "../../ports/tool-sections.js";
import type { EnsurePluginRuntimeFiles } from "../install/config/ensure-plugin-runtime-files.use-case.js";
import type { ReplacePluginFiles } from "../materialize/replace-plugin-files.use-case.js";
import { requireManifest } from "../shared/require-manifest.js";
import { resolvePluginToolIds } from "./plugin-target-resolution.js";

export interface UpdatePluginRequest {
  pluginNames?: string[];
  toolIds: AiToolId[] | "all";
  projectRoot: string;
  scope?: Scope;
  /** Re-materialize at the same version: the source or the build changed, not the plugin's
   * version, as a new agent provider changes it. `sync --global` drives the machine-scope one. */
  rebuild?: boolean;
}

interface ProjectUpdateScope {
  projectRoot: string;
  cacheDir: string;
  manifest: Manifest;
  rebuild: boolean;
}

/** What UpdatePlugin is built from. */
export interface UpdatePluginDeps {
  readonly manifestRepo: ManifestRepository;
  readonly loadDistribution: LoadDistribution;
  readonly replacePluginFiles: ReplacePluginFiles;
  readonly pluginRuntime?: Pick<EnsurePluginRuntimeFiles, "execute">;
}

export class UpdatePlugin {
  constructor(
    private readonly deps: UpdatePluginDeps,
    private readonly tools: ToolCatalog
  ) {}

  async execute(options: UpdatePluginRequest): Promise<string[]> {
    if (options.scope === "user")
      throw new Error("User-scope plugin update requires UpdateUserPluginFiles.");
    const { pluginNames, toolIds, projectRoot } = options;
    const manifest = await requireManifest(this.deps.manifestRepo);
    const resolvedToolIds = resolvePluginToolIds(toolIds, manifest, this.tools);
    const scope: ProjectUpdateScope = {
      projectRoot,
      cacheDir: join(projectRoot, PLUGIN_CACHE_SUBDIR),
      manifest,
      rebuild: options.rebuild === true,
    };
    const updated: string[] = [];
    for (const toolId of resolvedToolIds) {
      const names = await this.updatePluginsForTool(
        this.tools.aiProfile(toolId),
        pluginNames,
        scope
      );
      updated.push(...names);
    }
    await this.deps.manifestRepo.save(manifest);
    return updated;
  }

  private async updatePluginsForTool(
    tool: RuntimeConfigSection,
    pluginNames: string[] | undefined,
    scope: ProjectUpdateScope
  ): Promise<string[]> {
    const plugins = scope.manifest.getRecordedPlugins(tool.toolId);
    const targets = pluginNames
      ? plugins.filter((p) => pluginNames.includes(p.plugin.name))
      : plugins.filter((p) => p.plugin.scope !== "user");
    const updated: string[] = [];
    for (const recorded of targets) {
      const didUpdate = await this.updateOnePlugin(recorded, tool, scope);
      if (didUpdate) updated.push(recorded.plugin.name);
    }
    return updated;
  }

  private async updateOnePlugin(
    recorded: RecordedPlugin,
    tool: RuntimeConfigSection,
    scope: ProjectUpdateScope
  ): Promise<boolean> {
    const { projectRoot, cacheDir, manifest, rebuild } = scope;
    const { plugin } = recorded;
    const toolId = tool.toolId;
    if (plugin.scope === "user") throw new InvalidPluginScopeError(toolId, "project", "user");
    const dist = await this.deps.loadDistribution(plugin.source, cacheDir, {
      forceRefresh: true,
    });
    await this.deps.pluginRuntime?.execute(tool, projectRoot, manifest);
    if (!rebuild && compareSemver(dist.manifest.version, plugin.version) <= 0) return false;
    await this.deps.replacePluginFiles.execute({
      plugin: recorded,
      dist,
      toolId,
      projectRoot,
      manifest,
    });
    return true;
  }
}
