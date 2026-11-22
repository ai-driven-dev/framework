import { dirname, join } from "node:path";
import type { ToolId } from "../../../../../shared/domain/tool.js";
import type { FileReader } from "../../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../../shared/ports/file-writer.js";
import type { ToolCatalog } from "../../../../tools/contract/tool-catalog.js";
import type { Manifest } from "../../../domain/manifest.js";
import type { ProjectHooksGuard } from "../../shared/assert-project-hooks-unchanged.js";
import { removeProjectHooks } from "../../shared/remove-project-hooks.js";

/** The files a tool writes that `plugins[].files` never tracks: a machine-local settings file
 * (`.claude/settings.local.json`) and, for a tool merging a plugin's hooks into its own project
 * file (`.cursor/hooks.json`), the same unmerge `plugin remove` drives one plugin at a time. */
export class RemoveMachineLocalFiles {
  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly tools: ToolCatalog
  ) {}

  private pathsOf(toolId: ToolId): readonly string[] {
    return this.tools.profile(toolId).machineLocalFiles();
  }

  /** Removes them from every installed tool and returns how many that was. */
  async execute(
    manifest: Manifest,
    projectRoot: string,
    hooksGuard: ProjectHooksGuard
  ): Promise<number> {
    let count = 0;
    for (const toolId of manifest.getInstalledToolIds()) {
      count += await this.deleteSettingsFiles(toolId, projectRoot);
      count += await this.removeProjectHooksForTool(manifest, toolId, {
        projectRoot,
        hooksGuard,
      });
    }
    return count;
  }

  private async deleteSettingsFiles(toolId: ToolId, projectRoot: string): Promise<number> {
    let count = 0;
    for (const relativePath of this.pathsOf(toolId)) {
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
    for (const plugin of manifest.getRecordedPlugins(toolId)) {
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
}
