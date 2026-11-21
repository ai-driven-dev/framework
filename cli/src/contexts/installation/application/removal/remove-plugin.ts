import { homedir as nodeHomedir } from "node:os";
import { dirname, join } from "node:path";
import type { AiToolId, ToolId } from "../../../../shared/domain/tool.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import { PluginNotFoundError } from "../../domain/installation.error.js";
import type { Manifest } from "../../domain/manifest.js";
import type { InstalledPlugin } from "../../domain/plugins/installed-plugin.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";
import type { RegistrationRecordRules } from "../../ports/native-host.js";
import type { ProjectPluginWithdrawalSteps } from "../../ports/project-plugin-withdrawal.js";
import { resolvePluginToolIds, scopeBaseOf } from "../plugin/plugin-target-resolution.js";
import { assertProjectHooksRemovable, removeProjectHooks } from "../shared/remove-project-hooks.js";
import { requireManifest } from "../shared/require-manifest.js";
import { removeFlatMcpEntries } from "./remove-flat-mcp-entries.js";
import { assertProjectMcpEntriesRemovable } from "./remove-project-plugin.js";

export interface PluginRemoveOptions {
  pluginName: string;
  toolIds: AiToolId[] | "all";
  projectRoot: string;
}

/** What RemovePlugin is built from. */
export interface RemovePluginDeps {
  readonly fs: FileWriter & FileReader;
  readonly projectRepo: ManifestRepository;
  readonly withdrawal: ProjectPluginWithdrawalSteps;
  readonly records: RegistrationRecordRules;
}

export class RemovePlugin {
  constructor(
    private readonly deps: RemovePluginDeps,
    private readonly tools: ToolCatalog
  ) {}

  async execute(options: PluginRemoveOptions): Promise<void> {
    const { pluginName, toolIds, projectRoot } = options;
    const manifest = await requireManifest(this.deps.projectRepo);
    const resolvedToolIds = resolvePluginToolIds(toolIds, manifest, this.tools);
    const named = resolvedToolIds.flatMap((toolId) => {
      const plugin = manifest.getPlugins(toolId).find((p) => p.name === pluginName);
      return plugin === undefined ? [] : [{ toolId, plugin }];
    });
    await this.assertRemovable(manifest, named, projectRoot);
    const userTools = resolvedToolIds.filter((toolId) =>
      manifest.getPlugins(toolId).some((p) => p.name === pluginName && p.scope === "user")
    );
    const nativeRefs = new Map<ToolId, readonly string[]>();
    for (const { toolId, plugin } of named) {
      const registrations = manifest.getNativeRegistrations(toolId);
      const ref = this.deps.records.refOf(registrations, pluginName, plugin.marketplace);
      if (ref !== undefined) nativeRefs.set(toolId, [ref]);
    }
    const removed = await this.removeFromTools(manifest, {
      pluginName,
      toolIds: resolvedToolIds,
      projectRoot,
    });
    if (!removed) throw new PluginNotFoundError(pluginName);
    await this.deps.projectRepo.save(manifest);
    await this.deps.withdrawal.detachNativeRefs(projectRoot, nativeRefs);
    for (const toolId of userTools) {
      await this.deps.withdrawal.detachUserPlugin(toolId, pluginName, projectRoot);
    }
  }

  private async assertRemovable(
    manifest: Manifest,
    named: readonly { toolId: AiToolId; plugin: InstalledPlugin }[],
    projectRoot: string
  ): Promise<void> {
    for (const { toolId, plugin } of named) {
      const tool = this.tools.aiProfile(toolId);
      await assertProjectMcpEntriesRemovable(this.deps.fs, { plugin, tool, projectRoot });
      await assertProjectHooksRemovable({ fs: this.deps.fs, plugin, tool, projectRoot });
      await this.deps.withdrawal.assertSource({
        toolId,
        tool,
        plugin,
        projectRoot,
        registrations: manifest.getNativeRegistrations(toolId),
      });
    }
  }

  private async removeFromTools(
    manifest: Manifest,
    removal: { pluginName: string; toolIds: AiToolId[]; projectRoot: string }
  ): Promise<boolean> {
    const { pluginName, toolIds, projectRoot } = removal;
    let removed = false;
    for (const toolId of toolIds) {
      const tool = this.tools.aiProfile(toolId);
      const plugins = manifest.getPlugins(toolId);
      const plugin = plugins.find((p) => p.name === pluginName);
      if (plugin === undefined) continue;
      const registrations = manifest.getNativeRegistrations(toolId);
      const baseDir = scopeBaseOf(tool, {
        scope: plugin.scope,
        projectRoot: projectRoot,
        homedir: nodeHomedir,
      });
      const confirmed = await this.deps.withdrawal.withdraw({
        tool,
        plugin,
        projectRoot,
        registrations,
      });
      if (plugin.scope !== "user") await this.deletePluginFiles(plugin.files, baseDir);
      await removeFlatMcpEntries(this.deps.fs, { plugin, tool, projectRoot });
      await removeProjectHooks({ fs: this.deps.fs, plugin, tool, projectRoot });
      const ref = this.deps.records.refOf(registrations, plugin.name, plugin.marketplace);
      if (
        ref !== undefined &&
        registrations !== undefined &&
        (await this.deps.withdrawal.canDetachRef({ toolId, tool, confirmed, ref }))
      ) {
        manifest.setNativeRegistrations(toolId, this.deps.records.withoutRef(registrations, ref));
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
