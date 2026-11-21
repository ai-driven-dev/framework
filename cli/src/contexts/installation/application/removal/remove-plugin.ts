import { homedir as nodeHomedir } from "node:os";
import { dirname, join } from "node:path";
import { isErrnoException } from "../../../../shared/domain/reading/json-file.js";
import type { AiToolId, ToolId } from "../../../../shared/domain/tool.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import { PluginNotFoundError } from "../../domain/installation.error.js";
import type { Manifest } from "../../domain/manifest.js";
import type { InstalledPlugin } from "../../domain/plugins/installed-plugin.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";
import type { RegistrationRecordRules } from "../../ports/native-host.js";
import type { FlatMcpSection } from "../../ports/tool-sections.js";
import { assertProjectPathWithinRoot } from "../ownership/project-path-boundary.js";
import { resolvePluginToolIds, scopeBaseOf } from "../plugin/plugin-target-resolution.js";
import { assertProjectHooksRemovable, removeProjectHooks } from "../shared/remove-project-hooks.js";
import { requireManifest } from "../shared/require-manifest.js";
import type { ProjectPluginWithdrawal } from "./project-plugin-withdrawal.js";
import { assertProjectMcpEntriesRemovable } from "./remove-project-plugin.js";

export interface PluginRemoveOptions {
  pluginName: string;
  toolIds: AiToolId[] | "all";
  projectRoot: string;
}

export class RemovePlugin<Proof> {
  constructor(
    private readonly fs: FileWriter & FileReader,
    private readonly projectRepo: ManifestRepository,
    private readonly withdrawal: ProjectPluginWithdrawal<Proof>,
    private readonly records: RegistrationRecordRules,
    private readonly tools: ToolCatalog
  ) {}

  async execute(options: PluginRemoveOptions): Promise<void> {
    const { pluginName, toolIds, projectRoot } = options;
    const manifest = await requireManifest(this.projectRepo);
    const resolvedToolIds = resolvePluginToolIds(toolIds, manifest, this.tools);
    const named = resolvedToolIds.flatMap((toolId) => {
      const plugin = manifest.getPlugins(toolId).find((p) => p.name === pluginName);
      return plugin === undefined ? [] : [{ toolId, plugin }];
    });
    for (const { toolId, plugin } of named) {
      const tool = this.tools.aiProfile(toolId);
      await assertProjectMcpEntriesRemovable(this.fs, plugin, tool, projectRoot);
      await assertProjectHooksRemovable(this.fs, plugin, tool, projectRoot);
      await this.withdrawal.assertSource(
        toolId,
        tool,
        plugin,
        projectRoot,
        manifest.getNativeRegistrations(toolId)
      );
    }
    const userTools = resolvedToolIds.filter((toolId) =>
      manifest.getPlugins(toolId).some((p) => p.name === pluginName && p.scope === "user")
    );
    const nativeRefs = new Map<ToolId, readonly string[]>();
    for (const { toolId, plugin } of named) {
      const registrations = manifest.getNativeRegistrations(toolId);
      const ref = this.records.refOf(registrations, pluginName, plugin.marketplace);
      if (ref !== undefined) nativeRefs.set(toolId, [ref]);
    }
    const removed = await this.removeFromTools(pluginName, resolvedToolIds, projectRoot, manifest);
    if (!removed) throw new PluginNotFoundError(pluginName);
    await this.projectRepo.save(manifest);
    await this.withdrawal.detachNativeRefs(projectRoot, nativeRefs);
    for (const toolId of userTools) {
      await this.withdrawal.detachUserPlugin(toolId, pluginName, projectRoot);
    }
  }

  private async removeFromTools(
    pluginName: string,
    toolIds: AiToolId[],
    projectRoot: string,
    manifest: Manifest
  ): Promise<boolean> {
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
      const confirmed = await this.withdrawal.withdraw(tool, plugin, projectRoot, registrations);
      if (plugin.scope !== "user") await this.deletePluginFiles(plugin.files, baseDir);
      await this.removeMcpEntries(plugin, tool, projectRoot);
      await removeProjectHooks(this.fs, plugin, tool, projectRoot);
      const ref = this.records.refOf(registrations, plugin.name, plugin.marketplace);
      if (
        ref !== undefined &&
        registrations !== undefined &&
        (await this.withdrawal.canDetachRef(toolId, tool, confirmed, ref))
      ) {
        manifest.setNativeRegistrations(toolId, this.records.withoutRef(registrations, ref));
      }
      manifest.removePlugin(toolId, pluginName);
      removed = true;
    }
    return removed;
  }

  private async removeMcpEntries(
    plugin: InstalledPlugin,
    tool: FlatMcpSection,
    projectRoot: string
  ): Promise<void> {
    if (plugin.mcpEntries.size === 0) return;
    const mcpCap = tool.flatPluginMcp();
    if (mcpCap === null) return;
    const outputRelPath = await mcpCap.resolveOutputPath((relativePath) =>
      this.fs.fileExists(join(projectRoot, relativePath))
    );
    const outputPath = join(projectRoot, outputRelPath);
    const existing = await this.readExistingJson(outputPath);
    if (existing === null) return;
    const updated = mcpCap.removePluginServers(existing, plugin.mcpEntries);
    await assertProjectPathWithinRoot(this.fs, projectRoot, outputPath);
    await this.fs.writeFile(outputPath, updated);
  }

  private async readExistingJson(path: string): Promise<string | null> {
    try {
      return await this.fs.readFile(path);
    } catch (err) {
      if (isErrnoException(err) && err.code === "ENOENT") return null;
      throw err;
    }
  }

  private async deletePluginFiles(
    files: ReadonlyMap<string, string>,
    baseDir: string
  ): Promise<void> {
    for (const relativePath of files.keys()) {
      const fullPath = join(baseDir, relativePath);
      await this.fs.deleteFile(fullPath);
      await this.fs.deleteEmptyDirectories(dirname(fullPath));
    }
  }
}
