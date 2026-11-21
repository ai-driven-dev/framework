import { dirname, join } from "node:path";
import type { ToolId } from "../../../../shared/domain/tool.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { Logger } from "../../../../shared/ports/logger.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import type { Manifest } from "../../domain/manifest.js";
import { aiddGitignoreEntries } from "../../domain/manifest-gitignore-entries.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";
import type { ProjectPluginIntegration } from "../../ports/tool-sections.js";
import { deletePluginFilesForTool } from "../plugin/delete-plugin-files.js";
import type { ProjectHooksGuard } from "../shared/assert-project-hooks-unchanged.js";
import { removeProjectHooks } from "../shared/remove-project-hooks.js";
import type { UpdateGitignore } from "../update-gitignore.js";
import { cleanMergeFileKeys } from "./clean-merge-file-keys.js";
import { removeAiddState } from "./remove-aidd-state.js";

/** What RemoveProjectFiles is built from. */
export interface RemoveProjectFilesDeps {
  readonly fs: FileReader & FileWriter;
  readonly manifestRepo: ManifestRepository;
  readonly logger: Logger;
  readonly updateGitignore: UpdateGitignore;
}

/**
 * What `aidd clean` deletes from a project: the files each tool installed, the merged keys, the
 * machine-local settings and AIDD's own state, then the gitignore lines the install added.
 */
export class RemoveProjectFiles {
  constructor(
    private readonly deps: RemoveProjectFilesDeps,
    private readonly tools: ToolCatalog
  ) {}

  /** Deletes what this project installed and returns how many files that was. */
  async remove(projectRoot: string, force: boolean): Promise<number> {
    const manifest = await this.deps.manifestRepo.load();
    if (manifest === null) return 0;
    let deleted = await this.deleteAllToolFiles(manifest, projectRoot);
    deleted += await this.deleteMachineLocalFiles(manifest, projectRoot, {
      overwriteEdited: force,
    });
    await removeAiddState(this.deps, projectRoot);
    // Exactly what the pipeline added on install, never a subset of it.
    await this.deps.updateGitignore.remove(
      projectRoot,
      aiddGitignoreEntries(manifest, (toolId) => this.machineLocalFilesOf(toolId))
    );
    return deleted;
  }

  private machineLocalFilesOf(toolId: ToolId): readonly string[] {
    return this.tools.profile(toolId).machineLocalFiles();
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
      if (!(await this.deps.fs.fileExists(fullPath))) continue;
      await this.deps.fs.deleteFile(fullPath);
      await this.deps.fs.deleteEmptyDirectories(dirname(fullPath));
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
          fs: this.deps.fs,
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
      this.deps.logger.info(`Removing ${toolId} files...`);
      deleted += await this.deleteFiles(manifest.getToolFiles(toolId), projectRoot);
      deleted += await cleanMergeFileKeys(
        this.deps.fs,
        manifest.getMergeFiles(toolId),
        projectRoot
      );
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
        this.deps.fs
      );
      count += deleted.length;
    }
    return count;
  }

  private async deleteFiles(
    files: ReadonlyArray<{ relativePath: string }>,
    projectRoot: string
  ): Promise<number> {
    let count = 0;
    for (const file of files) {
      const fullPath = join(projectRoot, file.relativePath);
      await this.deps.fs.deleteFile(fullPath);
      await this.deps.fs.deleteEmptyDirectories(dirname(fullPath));
      count++;
    }
    return count;
  }
}
