import { join } from "node:path";
import { compareSemver } from "../../../../shared/domain/plugin/semver.js";
import type { AiToolId } from "../../../../shared/domain/tool.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import { InvalidPluginScopeError } from "../../contract/installation.error.js";
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
import type { PluginUpdateOutcome, UpdatePluginRequest } from "./update-plugin-command.js";

/** Where one tool's project plugins are updated, and the manifest recording them. */
export interface ProjectPluginUpdate {
  readonly projectRoot: string;
  readonly cacheDir: string;
  readonly manifest: Manifest;
  readonly machine: Manifest;
  readonly rebuild: boolean;
}

/** A project update, and the machine's manifest that tells which user directories it owns. */
export interface ProjectPluginUpdateRequest extends UpdatePluginRequest {
  readonly machine: Manifest;
}

/** What UpdateProjectPlugins is built from. */
export interface UpdateProjectPluginsDeps {
  readonly manifestRepo: ManifestRepository;
  readonly loadDistribution: LoadDistribution;
  readonly replacePluginFiles: Pick<ReplacePluginFiles, "execute">;
  readonly pluginRuntime?: Pick<EnsurePluginRuntimeFiles, "execute">;
}

/** Brings the project-scope plugins of each tool asked for to their latest version, records
 * them in the project's manifest, and names the ones it changed. */
export class UpdateProjectPlugins {
  constructor(
    private readonly deps: UpdateProjectPluginsDeps,
    private readonly tools: ToolCatalog
  ) {}

  async execute(request: ProjectPluginUpdateRequest): Promise<PluginUpdateOutcome> {
    const { pluginNames, toolIds, projectRoot } = request;
    const manifest = await requireManifest(this.deps.manifestRepo);
    const update = {
      projectRoot,
      cacheDir: join(projectRoot, PLUGIN_CACHE_SUBDIR),
      manifest,
      machine: request.machine,
      rebuild: request.rebuild === true,
    };
    const updated: string[] = [];
    const skippedUserScope: AiToolId[] = [];
    for (const toolId of resolvePluginToolIds(toolIds, manifest, this.tools)) {
      const tool = this.tools.aiProfile(toolId);
      updated.push(...(await this.updateTool(tool, pluginNames, update)));
      if (!pluginNames && this.holdsUserScope(manifest, toolId)) skippedUserScope.push(toolId);
    }
    await this.deps.manifestRepo.save(manifest);
    return { updated, skippedUserScope };
  }

  private holdsUserScope(manifest: Manifest, toolId: AiToolId): boolean {
    return manifest.getRecordedPlugins(toolId).some((p) => p.plugin.scope === "user");
  }

  private async updateTool(
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
    const { projectRoot, cacheDir, manifest, machine, rebuild } = update;
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
      machine,
    });
    return true;
  }
}
