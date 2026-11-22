import { dirname, join } from "node:path";
import type { FileReader } from "../../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../../shared/ports/file-writer.js";
import type { Logger } from "../../../../../shared/ports/logger.js";
import type { ToolCatalog } from "../../../../tools/contract/tool-catalog.js";
import type { Manifest } from "../../../domain/manifest.js";
import type { ProjectPluginIntegration } from "../../../ports/tool-sections.js";
import { deletePluginFilesForTool } from "../../plugin/files/delete-plugin-files.js";
import { cleanMergeFileKeys } from "./clean-merge-file-keys.js";

/** What DeleteTrackedProjectFiles is built from. */
export interface TrackedProjectFilesDeps {
  readonly fs: FileReader & FileWriter;
  readonly logger: Logger;
  readonly homedir: () => string;
}

/** The files the manifest tracks for each installed tool: its own, its merged keys and its
 * plugins'. */
export class DeleteTrackedProjectFiles {
  constructor(
    private readonly deps: TrackedProjectFilesDeps,
    private readonly tools: ToolCatalog
  ) {}

  /** Deletes them and returns how many files that was. */
  async delete(manifest: Manifest, projectRoot: string): Promise<number> {
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
    const { fs, homedir } = this.deps;
    for (const plugin of manifest.getPlugins(tool.toolId)) {
      const deleted = await deletePluginFilesForTool(
        { files: plugin.files, scope: plugin.scope, tool, projectRoot, homedir },
        fs
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
