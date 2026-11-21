import { dirname, join } from "node:path";
import {
  AIDD_DIR,
  AIDD_MARKETPLACES_FILENAME,
} from "../../../../shared/domain/layout/aidd-layout.js";
import {
  isMergeContentEmpty,
  type MergeFileEntry,
  removeEntriesFromJson,
} from "../../../../shared/domain/merge.js";
import type { ToolId } from "../../../../shared/domain/tool.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { Logger } from "../../../../shared/ports/logger.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import type { Manifest } from "../../domain/manifest.js";
import { aiddGitignoreEntries } from "../../domain/manifest-gitignore-entries.js";
import { AIDD_CONFIG_FILENAME, PLUGIN_CACHE_SUBDIR } from "../../domain/project-layout.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";
import type { ProjectPluginIntegration } from "../../ports/tool-sections.js";
import { deletePluginFilesForTool } from "../plugin/plugin-helpers.js";
import { type ProjectHooksGuard, removeProjectHooks } from "../shared/remove-project-hooks.js";
import type { UpdateGitignore } from "../update-gitignore.js";

/**
 * What `aidd clean` deletes from a project: the files each tool installed, the merged keys, the
 * machine-local settings and AIDD's own state, then the gitignore lines the install added.
 */
export class RemoveProjectFiles {
  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly manifestRepo: ManifestRepository,
    private readonly logger: Logger,
    private readonly updateGitignore: UpdateGitignore,
    private readonly tools: ToolCatalog
  ) {}

  /** Deletes what this project installed and returns how many files that was. */
  async remove(projectRoot: string, force: boolean): Promise<number> {
    const manifest = await this.manifestRepo.load();
    if (manifest === null) return 0;
    let deleted = await this.deleteAllToolFiles(manifest, projectRoot);
    deleted += await this.deleteMachineLocalFiles(manifest, projectRoot, {
      overwriteEdited: force,
    });
    await this.removeAiddState(projectRoot);
    // Exactly what the pipeline added on install, never a subset of it.
    await this.updateGitignore.remove(
      projectRoot,
      aiddGitignoreEntries(manifest, (toolId) => this.machineLocalFilesOf(toolId))
    );
    return deleted;
  }

  private machineLocalFilesOf(toolId: ToolId): readonly string[] {
    return this.tools.profile(toolId).machineLocalFiles();
  }

  // `config.json` is a committed file clean did not write, so clean never
  // removes it. Everything AIDD did write must go before the emptiness check, or its own presence
  // blocks a removal that should happen, the registry `marketplace add` writes included.
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

  /** The files a tool writes that `plugins[].files` never tracks: a machine-local settings file
   * (`.claude/settings.local.json`) and, for a tool merging a plugin's hooks into its own project
   * file (`.cursor/hooks.json`), the same unmerge `plugin remove` drives one plugin at a time. */
  private async deleteMachineLocalFiles(
    manifest: Manifest,
    projectRoot: string,
    hooksGuard: ProjectHooksGuard
  ): Promise<number> {
    let count = 0;
    for (const toolId of manifest.getInstalledToolIds()) {
      count += await this.deleteMachineLocalSettingsFiles(toolId, projectRoot);
      count += await this.removeProjectHooksForTool(manifest, toolId, {
        projectRoot,
        hooksGuard,
      });
    }
    return count;
  }

  private async deleteMachineLocalSettingsFiles(
    toolId: ToolId,
    projectRoot: string
  ): Promise<number> {
    let count = 0;
    for (const relativePath of this.machineLocalFilesOf(toolId)) {
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
    project: { projectRoot: string; hooksGuard: ProjectHooksGuard }
  ): Promise<number> {
    const { projectRoot, hooksGuard } = project;
    if (!this.tools.isAiTool(toolId)) return 0;
    let count = 0;
    for (const plugin of manifest.getPlugins(toolId)) {
      if (
        await removeProjectHooks({
          fs: this.fs,
          plugin,
          tool: this.tools.aiProfile(toolId),
          projectRoot,
          guard: hooksGuard,
        })
      )
        count++;
    }
    return count;
  }

  private async deleteAllToolFiles(manifest: Manifest, projectRoot: string): Promise<number> {
    let deleted = 0;
    for (const toolId of manifest.getInstalledToolIds()) {
      this.logger.info(`Removing ${toolId} files...`);
      deleted += await this.deleteFiles(manifest.getToolFiles(toolId), projectRoot);
      deleted += await this.cleanMergeFileKeys(manifest.getMergeFiles(toolId), projectRoot);
      if (this.tools.isAiTool(toolId)) {
        deleted += await this.deleteToolPluginFiles(
          manifest,
          this.tools.aiProfile(toolId),
          projectRoot
        );
      }
    }
    return deleted;
  }

  /** A user-scope plugin lives under the OS home, never under `projectRoot`: only the machine
   * clean removes it, behind its containment check. `deletePluginFilesForTool` deletes nothing for
   * a user-scope plugin it does not own. */
  private async deleteToolPluginFiles(
    manifest: Manifest,
    tool: ProjectPluginIntegration,
    projectRoot: string
  ): Promise<number> {
    let count = 0;
    for (const plugin of manifest.getPlugins(tool.toolId)) {
      const deleted = await deletePluginFilesForTool(
        { files: plugin.files, scope: plugin.scope, tool, projectRoot },
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
