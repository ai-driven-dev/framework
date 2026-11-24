import type { PluginDistribution } from "../../../../shared/domain/plugin/plugin-distribution.js";
import type { AiToolId } from "../../../../shared/domain/tool.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import type { Manifest } from "../../domain/manifest.js";
import { RecordedPlugin } from "../../domain/plugins/recorded-plugin.js";
import { deleteOldFiles } from "../plugin/files/delete-plugin-files.js";
import { writePluginFiles } from "../plugin/files/write-plugin-files.js";
import { scopeBaseOf } from "../plugin/plugin-target-resolution.js";
import { hashOutputFiles } from "../shared/hash-output-files.js";
import type { BuiltPlacement } from "./add-plugin-request.js";
import { deliversHooksToProject, placementModeOf } from "./plugin-placement.js";
import { rematerializePlugin } from "./rematerialize-plugin.js";

export interface ReplacePluginFilesRequest {
  readonly plugin: RecordedPlugin;
  readonly dist: PluginDistribution;
  readonly toolId: AiToolId;
  readonly projectRoot: string;
  readonly manifest: Manifest;
}

/** What ReplacePluginFiles is built from. */
export interface ReplacePluginFilesDeps extends BuiltPlacement {
  readonly fs: FileReader & FileWriter;
}

/** Replaces an installed plugin's files with the ones a newer distribution brings: the old files
 * go first, then the plugin is written the way install would have written it for that tool. */
export class ReplacePluginFiles {
  constructor(
    private readonly deps: ReplacePluginFilesDeps,
    private readonly tools: ToolCatalog
  ) {}

  async execute(command: ReplacePluginFilesRequest): Promise<void> {
    const { dist, toolId, projectRoot, manifest } = command;
    const { plugin } = command.plugin;
    const tool = this.tools.aiProfile(toolId);
    const baseDir = scopeBaseOf(tool, {
      scope: plugin.scope,
      projectRoot: projectRoot,
      homedir: this.deps.homedir,
    });
    await deleteOldFiles(plugin.files, baseDir, this.deps.fs);
    const mode = placementModeOf(tool);
    if (
      mode !== null &&
      (command.plugin.marketplace !== undefined || deliversHooksToProject(tool))
    ) {
      await rematerializePlugin(
        { dist, tool, mode, plugin: command.plugin, projectRoot, manifest },
        this.deps.placeBuiltTree
      );
      return;
    }
    const translated = this.deps.translate.execute({ distribution: dist, tool });
    const newFiles = hashOutputFiles(translated.files);
    await writePluginFiles(newFiles, baseDir, this.deps.fs);
    manifest.updatePlugin(
      tool.toolId,
      RecordedPlugin.fromDistribution({
        dist,
        source: plugin.source,
        files: newFiles,
        scope: plugin.scope,
        componentPaths: translated.componentPaths,
      })
    );
  }
}
