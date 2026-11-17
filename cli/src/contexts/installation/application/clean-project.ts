import { dirname, join } from "node:path";
import { AIDD_DIR, AIDD_MARKETPLACES_FILENAME } from "../../../shared/domain/layout/aidd-layout.js";
import {
  isMergeContentEmpty,
  type MergeFileEntry,
  removeEntriesFromJson,
} from "../../../shared/domain/merge.js";
import type { MarketplaceScope } from "../../../shared/domain/scope.js";
import type { AiToolId, ToolId } from "../../../shared/domain/tool.js";
import type { FileReader } from "../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../shared/ports/file-writer.js";
import type { Logger } from "../../../shared/ports/logger.js";
import type { ToolCatalog } from "../../tools/contract/tool-catalog.js";
import type { AiToolProfile } from "../../tools/contract/tool-profile.js";
import type { Manifest } from "../domain/manifest.js";
import { aiddGitignoreEntries } from "../domain/manifest-gitignore-entries.js";
import type { InstalledPlugin } from "../domain/plugins/installed-plugin.js";
import { AIDD_CONFIG_FILENAME, PLUGIN_CACHE_SUBDIR } from "../domain/project-layout.js";
import type { ManifestRepository } from "../ports/manifest-repository.js";
import type { ProjectRegistrationWithdrawal } from "../ports/native-host.js";
import { deletePluginFilesForTool } from "./plugin/plugin-helpers.js";
import {
  assertProjectHooksRemovable,
  type ProjectHooksGuard,
  removeProjectHooks,
} from "./shared/remove-project-hooks.js";
import type { UpdateGitignore } from "./update-gitignore.js";

/** What a project clean asks of the machine, answered where each one lives. */
export interface ProjectCleanGuards {
  /** The one resolver for the OS home directory a clean ever calls. */
  readonly homeDir: () => string;
  /** Read-only proof that a plugin's MCP entries can be removed from the project. */
  readonly assertMcpRemovable: (
    plugin: InstalledPlugin,
    tool: AiToolProfile,
    projectRoot: string
  ) => Promise<void>;
}

export interface CleanNativeRegistrationPreview {
  toolId: ToolId;
  binary: string;
  marketplaceCount: number;
  pluginRefCount: number;
  /** Absolute cache paths a `--force` run will attempt to purge — empty for a tool whose
   * profile declares no `NativeActivation.pluginCacheDir`. An announcement, not a guarantee:
   * whether a path is still there, and safe to purge, is known only once the host's CLI ran. */
  cachePaths: readonly string[];
}

/** What a project clean would do, read before anything is touched. */
export interface ProjectCleanPlan {
  tools: Array<{ toolId: ToolId; fileCount: number }>;
  totalFileCount: number;
  /** What a `--force` run will ask each tool's own CLI to undo — that step drives an external
   * binary, the one part of `clean` a file count cannot express. */
  nativeRegistrations: CleanNativeRegistrationPreview[];
  /** The AI tools whose host holds registrations this project made. A non-AI tool never does;
   * were one recorded, it is left out rather than guessed at. */
  withdrawals: ProjectRegistrationWithdrawal[];
  /** The native plugin refs this project recorded, by tool. */
  nativeRefs: ReadonlyMap<ToolId, readonly string[]>;
  /** The plugins installed at user scope, whose machine claim this project releases. */
  userPlugins: Array<{ toolId: AiToolId; name: string }>;
}

function machineLocalFilesOf(tools: ToolCatalog, toolId: ToolId): readonly string[] {
  return tools.profile(toolId).machineLocalFiles();
}

/**
 * The project-local half of `aidd clean`: reads what this project installed, proves each part
 * removable, then deletes the files, the merged keys and AIDD's own state. Undoing the host's
 * registration and releasing the machine claims sit around those and are the caller's.
 */
export class CleanProject {
  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly manifestRepo: ManifestRepository,
    private readonly logger: Logger,
    private readonly updateGitignore: UpdateGitignore,
    private readonly guards: ProjectCleanGuards
  ) {}

  /** `null` when this project installed nothing. */
  async plan(tools: ToolCatalog): Promise<ProjectCleanPlan | null> {
    const manifest = await this.manifestRepo.load();
    if (manifest === null) return null;
    const home = this.guards.homeDir();
    const toolFiles = manifest.getInstalledToolIds().map((toolId) => ({
      toolId,
      fileCount: manifest.getToolFiles(toolId).length + manifest.getMergeFiles(toolId).length,
    }));
    return {
      tools: toolFiles,
      totalFileCount: toolFiles.reduce((sum, t) => sum + t.fileCount, 0),
      nativeRegistrations: this.previewNativeRegistrations(manifest, home, tools),
      withdrawals: this.projectWithdrawals(manifest, home, tools),
      nativeRefs: this.nativeRefs(manifest),
      userPlugins: this.userPlugins(manifest, tools),
    };
  }

  /** Refuses while a hook or an MCP entry of a tracked plugin could not be removed cleanly. */
  async assertRemovable(tools: ToolCatalog, projectRoot: string, force: boolean): Promise<void> {
    const manifest = await this.manifestRepo.load();
    if (manifest === null) return;
    for (const toolId of manifest.getInstalledToolIds()) {
      if (!tools.isAiTool(toolId)) continue;
      for (const plugin of manifest.getPlugins(toolId)) {
        const tool = tools.aiProfile(toolId);
        if (tool.projectHooksDelivery() !== null) {
          await assertProjectHooksRemovable(this.fs, plugin, tool, projectRoot, {
            overwriteEdited: force,
          });
        }
        await this.guards.assertMcpRemovable(plugin, tool, projectRoot);
      }
    }
  }

  /** Deletes what this project installed and returns how many files that was. */
  async remove(tools: ToolCatalog, projectRoot: string, force: boolean): Promise<number> {
    const manifest = await this.manifestRepo.load();
    if (manifest === null) return 0;
    let deleted = await this.deleteAllToolFiles(manifest, tools, projectRoot);
    deleted += await this.deleteMachineLocalFiles(manifest, projectRoot, tools, {
      overwriteEdited: force,
    });
    await this.removeAiddState(projectRoot);
    // Exactly what the pipeline added on install, never a subset of it.
    await this.updateGitignore.remove(
      projectRoot,
      aiddGitignoreEntries(manifest, (toolId) => machineLocalFilesOf(tools, toolId))
    );
    return deleted;
  }

  private nativeRefs(manifest: Manifest): ReadonlyMap<ToolId, readonly string[]> {
    const nativeRefs = new Map<ToolId, readonly string[]>();
    for (const toolId of manifest.getInstalledToolIds()) {
      const refs = manifest.getNativeRegistrations(toolId)?.pluginRefs;
      if (refs !== undefined && refs.length > 0) nativeRefs.set(toolId, refs);
    }
    return nativeRefs;
  }

  private userPlugins(
    manifest: Manifest,
    tools: ToolCatalog
  ): Array<{ toolId: AiToolId; name: string }> {
    const plugins: Array<{ toolId: AiToolId; name: string }> = [];
    for (const toolId of manifest.getInstalledToolIds()) {
      if (!tools.isAiTool(toolId)) continue;
      for (const plugin of manifest.getPlugins(toolId)) {
        if (plugin.scope === "user") plugins.push({ toolId, name: plugin.name });
      }
    }
    return plugins;
  }

  // `config.json` is a committed file clean did not write, so clean never
  // removes it. Everything AIDD did write must go before the emptiness check, or its own presence
  // blocks a removal that should happen — the registry `marketplace add` writes included.
  private async removeAiddState(projectRoot: string): Promise<void> {
    const aiddDir = join(projectRoot, AIDD_DIR);
    const configKept = await this.fs.fileExists(join(aiddDir, AIDD_CONFIG_FILENAME));

    await this.fs.deleteDirectory(join(aiddDir, "cache"));
    await this.fs.deleteDirectory(join(projectRoot, PLUGIN_CACHE_SUBDIR));
    await this.fs.deleteFile(join(aiddDir, AIDD_MARKETPLACES_FILENAME));
    await this.manifestRepo.delete();

    if (!(await this.fs.fileExists(aiddDir))) return;
    const remaining = await this.fs.listDirectory(aiddDir);
    if (remaining.length === 0) {
      await this.fs.deleteDirectory(aiddDir);
      return;
    }
    if (configKept) this.logger.info(`Kept ${AIDD_DIR}/${AIDD_CONFIG_FILENAME}`);
  }

  private projectWithdrawals(
    manifest: Manifest,
    home: string,
    tools: ToolCatalog
  ): ProjectRegistrationWithdrawal[] {
    const withdrawals: ProjectRegistrationWithdrawal[] = [];
    for (const toolId of manifest.getInstalledToolIds()) {
      const registrations = manifest.getNativeRegistrations(toolId);
      if (registrations === undefined || !tools.isAiTool(toolId)) continue;
      const tool = tools.aiProfile(toolId);
      const refScopes = new Map<string, MarketplaceScope>();
      for (const plugin of manifest.getPlugins(toolId)) {
        const hostName = registrations.marketplaces.find(
          (m) => m.alias === plugin.marketplace
        )?.hostName;
        if (hostName !== undefined) refScopes.set(`${plugin.name}@${hostName}`, plugin.scope);
      }
      withdrawals.push({
        tool,
        registrations,
        cacheRoot: tool.nativeActivation()?.pluginCacheRoot(home),
        refScopes,
      });
    }
    return withdrawals;
  }

  /** The files a tool writes that `plugins[].files` never tracks: a machine-local settings file
   * (`.claude/settings.local.json`) and, for a tool merging a plugin's hooks into its own project
   * file (`.cursor/hooks.json`), the same unmerge `plugin remove` drives one plugin at a time. */
  private async deleteMachineLocalFiles(
    manifest: Manifest,
    projectRoot: string,
    tools: ToolCatalog,
    hooksGuard: ProjectHooksGuard
  ): Promise<number> {
    let count = 0;
    for (const toolId of manifest.getInstalledToolIds()) {
      count += await this.deleteMachineLocalSettingsFiles(toolId, projectRoot, tools);
      count += await this.removeProjectHooksForTool(
        manifest,
        toolId,
        tools,
        projectRoot,
        hooksGuard
      );
    }
    return count;
  }

  private async deleteMachineLocalSettingsFiles(
    toolId: ToolId,
    projectRoot: string,
    tools: ToolCatalog
  ): Promise<number> {
    let count = 0;
    for (const relativePath of machineLocalFilesOf(tools, toolId)) {
      const fullPath = join(projectRoot, relativePath);
      if (!(await this.fs.fileExists(fullPath))) continue;
      await this.fs.deleteFile(fullPath);
      await this.fs.deleteEmptyDirectories(dirname(fullPath));
      count++;
    }
    return count;
  }

  private async removeProjectHooksForTool(
    manifest: Manifest,
    toolId: ToolId,
    tools: ToolCatalog,
    projectRoot: string,
    hooksGuard: ProjectHooksGuard
  ): Promise<number> {
    if (!tools.isAiTool(toolId) || tools.aiProfile(toolId).projectHooksDelivery() === null)
      return 0;
    let count = 0;
    for (const plugin of manifest.getPlugins(toolId)) {
      if (
        await removeProjectHooks(this.fs, plugin, tools.aiProfile(toolId), projectRoot, hooksGuard)
      )
        count++;
    }
    return count;
  }

  private previewNativeRegistrations(
    manifest: Manifest,
    home: string,
    tools: ToolCatalog
  ): CleanNativeRegistrationPreview[] {
    const preview: CleanNativeRegistrationPreview[] = [];
    for (const toolId of manifest.getInstalledToolIds()) {
      const registrations = manifest.getNativeRegistrations(toolId);
      if (registrations === undefined) continue;
      const cacheRoot = tools.isAiTool(toolId)
        ? tools.aiProfile(toolId).nativeActivation()?.pluginCacheRoot(home)
        : undefined;
      preview.push({
        toolId,
        binary: registrations.binary,
        marketplaceCount: registrations.marketplaces.length,
        pluginRefCount: registrations.pluginRefs.length,
        cachePaths:
          cacheRoot === undefined
            ? []
            : registrations.marketplaces.map((m) => join(cacheRoot, m.hostName)),
      });
    }
    return preview;
  }

  private async deleteAllToolFiles(
    manifest: Manifest,
    tools: ToolCatalog,
    projectRoot: string
  ): Promise<number> {
    let deleted = 0;
    for (const toolId of manifest.getInstalledToolIds()) {
      this.logger.info(`Removing ${toolId} files...`);
      deleted += await this.deleteFiles(manifest.getToolFiles(toolId), projectRoot);
      deleted += await this.cleanMergeFileKeys(manifest.getMergeFiles(toolId), projectRoot);
      if (tools.isAiTool(toolId)) {
        deleted += await this.deleteToolPluginFiles(manifest, tools.aiProfile(toolId), projectRoot);
      }
    }
    return deleted;
  }

  /** A user-scope plugin lives under the OS home, never under `projectRoot`: only the machine
   * clean removes it, behind its containment check. */
  private async deleteToolPluginFiles(
    manifest: Manifest,
    tool: AiToolProfile,
    projectRoot: string
  ): Promise<number> {
    let count = 0;
    for (const plugin of manifest.getPlugins(tool.toolId)) {
      if (plugin.scope === "user") continue;
      const deleted = await deletePluginFilesForTool(
        plugin.files,
        plugin.scope,
        tool,
        projectRoot,
        this.fs
      );
      count += deleted.length;
    }
    return count;
  }

  private async cleanMergeFileKeys(
    mergeFiles: readonly MergeFileEntry[],
    projectRoot: string
  ): Promise<number> {
    let count = 0;
    for (const mergeFile of mergeFiles) {
      const fullPath = join(projectRoot, mergeFile.relativePath);
      if (!(await this.fs.fileExists(fullPath))) continue;
      await this.applyMergeFileCleaning(fullPath, mergeFile);
      count++;
    }
    return count;
  }

  private async applyMergeFileCleaning(fullPath: string, mergeFile: MergeFileEntry): Promise<void> {
    const keys = Object.keys(mergeFile.entries);
    if (keys.length === 0) {
      await this.fs.deleteFile(fullPath);
      await this.fs.deleteEmptyDirectories(dirname(fullPath));
      return;
    }
    const content = await this.fs.readFile(fullPath);
    const cleaned = removeEntriesFromJson(content, mergeFile.sectionKey, keys);
    if (isMergeContentEmpty(cleaned, mergeFile.sectionKey)) {
      await this.fs.deleteFile(fullPath);
      await this.fs.deleteEmptyDirectories(dirname(fullPath));
    } else {
      await this.fs.writeFile(fullPath, cleaned);
    }
  }

  private async deleteFiles(
    files: ReadonlyArray<{ relativePath: string }>,
    projectRoot: string
  ): Promise<number> {
    let count = 0;
    for (const file of files) {
      const fullPath = join(projectRoot, file.relativePath);
      await this.fs.deleteFile(fullPath);
      await this.fs.deleteEmptyDirectories(dirname(fullPath));
      count++;
    }
    return count;
  }
}
