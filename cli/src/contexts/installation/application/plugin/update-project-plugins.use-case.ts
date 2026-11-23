import { compareSemver } from "../../../../shared/domain/plugin/semver.js";
import { InvalidPluginScopeError } from "../../domain/installation.error.js";
import type { Manifest } from "../../domain/manifest.js";
import type { RecordedPlugin } from "../../domain/plugins/recorded-plugin.js";
import type { LoadDistribution } from "../../ports/plugin/load-plugin-distribution.js";
import type { RuntimeConfigSection } from "../../ports/tool-sections.js";
import type { EnsurePluginRuntimeFiles } from "../install/config/ensure-plugin-runtime-files.use-case.js";
import type { ReplacePluginFiles } from "../materialize/replace-plugin-files.use-case.js";

/** Where one tool's project plugins are updated, and the manifest recording them. */
export interface ProjectPluginUpdate {
  readonly projectRoot: string;
  readonly cacheDir: string;
  readonly manifest: Manifest;
  readonly rebuild: boolean;
}

/** What UpdateProjectPlugins is built from. */
export interface UpdateProjectPluginsDeps {
  readonly loadDistribution: LoadDistribution;
  readonly replacePluginFiles: Pick<ReplacePluginFiles, "execute">;
  readonly pluginRuntime?: Pick<EnsurePluginRuntimeFiles, "execute">;
}

/** Brings one tool's project-scope plugins to their latest version and names the ones it changed. */
export class UpdateProjectPlugins {
  constructor(private readonly deps: UpdateProjectPluginsDeps) {}

  async execute(
    tool: RuntimeConfigSection,
    pluginNames: readonly string[] | undefined,
    update: ProjectPluginUpdate
  ): Promise<string[]> {
    const plugins = update.manifest.getRecordedPlugins(tool.toolId);
    const targets = pluginNames
      ? plugins.filter((p) => pluginNames.includes(p.plugin.name))
      : plugins.filter((p) => p.plugin.scope !== "user");
    const updated: string[] = [];
    for (const recorded of targets) {
      if (await this.updateOne(recorded, tool, update)) updated.push(recorded.plugin.name);
    }
    return updated;
  }

  private async updateOne(
    recorded: RecordedPlugin,
    tool: RuntimeConfigSection,
    update: ProjectPluginUpdate
  ): Promise<boolean> {
    const { projectRoot, cacheDir, manifest, rebuild } = update;
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
