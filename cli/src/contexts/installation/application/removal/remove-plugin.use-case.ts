import { dirname, join } from "node:path";
import type { AiToolId, ToolId } from "../../../../shared/domain/tool.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import type { ToolRecords } from "../../contract/records/scope-records.js";
import { PluginNotFoundError } from "../../domain/installation.error.js";
import type { Manifest } from "../../domain/manifest.js";
import type { RecordedPlugin } from "../../domain/plugins/recorded-plugin.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";
import { resolvePluginToolIds, scopeBaseOf } from "../plugin/plugin-target-resolution.js";
import { requireManifest } from "../shared/require-manifest.js";
import type { AssertProjectIntegrationRemovable } from "./assert-project-integration-removable.use-case.js";
import type { ProjectPluginWithdrawalSteps } from "./project-plugin-withdrawal.js";
import type { RemoveProjectIntegration } from "./remove-project-integration.use-case.js";

export interface RemovePluginRequest {
  pluginName: string;
  toolIds: AiToolId[] | "all";
  projectRoot: string;
  withdrawal: ProjectPluginWithdrawalSteps;
}

/** What RemovePlugin is built from. */
export interface RemovePluginDeps {
  readonly fs: FileWriter & FileReader;
  readonly projectRepo: ManifestRepository;
  readonly homedir: () => string;
  readonly integration: {
    readonly assert: Pick<AssertProjectIntegrationRemovable, "execute">;
    readonly remove: Pick<RemoveProjectIntegration, "execute">;
  };
}

export class RemovePlugin {
  constructor(
    private readonly deps: RemovePluginDeps,
    private readonly tools: ToolCatalog
  ) {}

  async execute(options: RemovePluginRequest): Promise<void> {
    const { pluginName, toolIds, projectRoot, withdrawal } = options;
    const manifest = await requireManifest(this.deps.projectRepo);
    const registered = await withdrawal.loadRecords();
    const resolvedToolIds = resolvePluginToolIds(toolIds, manifest, this.tools);
    const named = resolvedToolIds.flatMap((toolId) => {
      const plugin = manifest.getRecordedPlugins(toolId).find((p) => p.plugin.name === pluginName);
      return plugin === undefined ? [] : [{ toolId, plugin }];
    });
    await this.assertRemovable(registered, named, { projectRoot, withdrawal });
    const userTools = resolvedToolIds.filter((toolId) =>
      manifest.getPlugins(toolId).some((p) => p.name === pluginName && p.scope === "user")
    );
    const nativeRefs = new Map<ToolId, readonly string[]>();
    for (const { toolId, plugin } of named) {
      const ref = withdrawal.recordedRef(registered.get(toolId), plugin);
      if (ref !== undefined) nativeRefs.set(toolId, [ref]);
    }
    const removed = await this.removeFromTools(
      { manifest, registered },
      {
        pluginName,
        toolIds: resolvedToolIds,
        projectRoot,
        withdrawal,
      }
    );
    if (!removed) throw new PluginNotFoundError(pluginName);
    await withdrawal.saveRecords(registered);
    await this.deps.projectRepo.save(manifest);
    await withdrawal.detachNativeRefs(projectRoot, nativeRefs);
    for (const toolId of userTools) {
      await withdrawal.detachUserPlugin(toolId, pluginName, projectRoot);
    }
  }

  private async assertRemovable(
    registered: ToolRecords,
    named: readonly { toolId: AiToolId; plugin: RecordedPlugin }[],
    { projectRoot, withdrawal }: Pick<RemovePluginRequest, "projectRoot" | "withdrawal">
  ): Promise<void> {
    for (const { toolId, plugin } of named) {
      const tool = this.tools.aiProfile(toolId);
      await this.deps.integration.assert.execute({ plugin, tool, projectRoot });
      await withdrawal.assertSource({
        toolId,
        tool,
        plugin,
        projectRoot,
        registrations: registered.get(toolId),
      });
    }
  }

  private async removeFromTools(
    { manifest, registered }: { manifest: Manifest; registered: ToolRecords },
    removal: Omit<RemovePluginRequest, "toolIds"> & { toolIds: AiToolId[] }
  ): Promise<boolean> {
    const { pluginName, toolIds, projectRoot, withdrawal } = removal;
    let removed = false;
    for (const toolId of toolIds) {
      const tool = this.tools.aiProfile(toolId);
      const entry = manifest.getRecordedPlugins(toolId).find((p) => p.plugin.name === pluginName);
      if (entry === undefined) continue;
      const { plugin } = entry;
      const registrations = registered.get(toolId);
      const baseDir = scopeBaseOf(tool, {
        scope: plugin.scope,
        projectRoot: projectRoot,
        homedir: this.deps.homedir,
      });
      const confirmed = await withdrawal.withdraw({
        tool,
        plugin: entry,
        projectRoot,
        registrations,
      });
      if (plugin.scope !== "user") await this.deletePluginFiles(plugin.files, baseDir);
      await this.deps.integration.remove.execute({ plugin: entry, tool, projectRoot });
      const ref = withdrawal.recordedRef(registrations, entry);
      if (
        ref !== undefined &&
        registrations !== undefined &&
        (await withdrawal.canDetachRef({ toolId, tool, confirmed, ref }))
      ) {
        registered.set(toolId, withdrawal.withoutRef(registrations, ref));
      }
      manifest.removePlugin(toolId, pluginName);
      removed = true;
    }
    return removed;
  }

  private async deletePluginFiles(
    files: ReadonlyMap<string, string>,
    baseDir: string
  ): Promise<void> {
    for (const relativePath of files.keys()) {
      const fullPath = join(baseDir, relativePath);
      await this.deps.fs.deleteFile(fullPath);
      await this.deps.fs.deleteEmptyDirectories(dirname(fullPath));
    }
  }
}
