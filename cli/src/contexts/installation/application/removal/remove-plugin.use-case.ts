import type { AiToolId, ToolId } from "../../../../shared/domain/tool.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import { PluginNotFoundError } from "../../contract/installation.error.js";
import type { ToolRecords } from "../../contract/records/scope-records.js";
import type { Manifest } from "../../domain/manifest.js";
import type { InstalledPlugin } from "../../domain/plugins/installed-plugin.js";
import type { RecordedPlugin } from "../../domain/plugins/recorded-plugin.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";
import type { InstallationCatalog, PluginPlacement } from "../../ports/tool-sections.js";
import { deleteOldFiles } from "../plugin/files/delete-plugin-files.js";
import { resolvePluginToolIds, scopeBaseOf } from "../plugin/plugin-target-resolution.js";
import { requireManifest } from "../shared/require-manifest.js";
import type { AssertProjectIntegrationRemovable } from "./assert-project-integration-removable.use-case.js";
import { mayLetRefGo, type ProjectPluginWithdrawalSteps } from "./project-plugin-withdrawal.js";
import type { RemoveProjectIntegration } from "./remove-project-integration.use-case.js";

export interface RemovePluginRequest {
  pluginName: string;
  toolIds: AiToolId[] | "all";
  projectRoot: string;
  /** The machine home, read only for a plugin the manifest recorded at user scope. */
  home: string;
  withdrawal: ProjectPluginWithdrawalSteps;
}

/** What RemovePlugin is built from. */
export interface RemovePluginDeps {
  readonly fs: FileWriter & FileReader;
  readonly projectRepo: ManifestRepository;
  readonly integration: {
    readonly assert: Pick<AssertProjectIntegrationRemovable, "execute">;
    readonly remove: Pick<RemoveProjectIntegration, "execute">;
  };
}

export class RemovePlugin {
  constructor(
    private readonly deps: RemovePluginDeps,
    private readonly tools: InstallationCatalog
  ) {}

  async execute(options: RemovePluginRequest): Promise<void> {
    const { pluginName, toolIds, projectRoot, home, withdrawal } = options;
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
        home,
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
    const { pluginName, toolIds, projectRoot, home, withdrawal } = removal;
    let removed = false;
    for (const toolId of toolIds) {
      const tool = this.tools.aiProfile(toolId);
      const entry = manifest.getRecordedPlugins(toolId).find((p) => p.plugin.name === pluginName);
      if (entry === undefined) continue;
      const registrations = registered.get(toolId);
      const confirmed = await withdrawal.withdraw({
        tool,
        plugin: entry,
        projectRoot,
        registrations,
      });
      await this.deletePluginFiles(entry.plugin, tool, { projectRoot, home });
      const ref = withdrawal.recordedRef(registrations, entry);
      await this.deps.integration.remove.execute({
        plugin: entry,
        tool,
        projectRoot,
        manifest,
        hostRef: ref,
      });
      if (
        ref !== undefined &&
        registrations !== undefined &&
        (await mayLetRefGo({ toolId, tool, confirmed, ref }, withdrawal))
      ) {
        registered.set(toolId, withdrawal.withoutRef(registrations, ref));
      }
      manifest.removePlugin(toolId, pluginName);
      removed = true;
    }
    return removed;
  }

  /** The base dir is resolved first, so a tool with no user directory refuses a user-scope plugin.
   * A user-scope plugin's files are the machine's, released by its claim, never deleted here. */
  private async deletePluginFiles(
    plugin: InstalledPlugin,
    tool: PluginPlacement,
    where: { projectRoot: string; home: string }
  ): Promise<void> {
    const baseDir = scopeBaseOf(tool, {
      scope: plugin.scope,
      projectRoot: where.projectRoot,
      homedir: () => where.home,
    });
    if (plugin.scope === "user") return;
    await deleteOldFiles(plugin.files, baseDir, this.deps.fs);
  }
}
