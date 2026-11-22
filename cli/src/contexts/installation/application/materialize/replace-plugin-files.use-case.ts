import type { PluginDistribution } from "../../../../shared/domain/plugin/plugin-distribution.js";
import type { AiToolId } from "../../../../shared/domain/tool.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import type { Manifest } from "../../domain/manifest.js";
import { RecordedPlugin } from "../../domain/plugins/recorded-plugin.js";
import { deleteOldFiles } from "../plugin/delete-plugin-files.js";
import { scopeBaseOf } from "../plugin/plugin-target-resolution.js";
import { writePluginFiles } from "../plugin/write-plugin-files.js";
import type { BuiltMaterializationDeps } from "../shared/built-materialization-deps.js";
import { hashOutputFiles } from "../shared/hash-output-files.js";
import { placementModeOf } from "./plugin-placement.js";
import { rematerializePlugin } from "./rematerialize-plugin.js";

export interface ReplacePluginFilesRequest {
  readonly plugin: RecordedPlugin;
  readonly dist: PluginDistribution;
  readonly toolId: AiToolId;
  readonly projectRoot: string;
  readonly manifest: Manifest;
}

/** Replaces an installed plugin's files with the ones a newer distribution brings: the old files
 * go first, then the plugin is written the way install would have written it for that tool. */
export class ReplacePluginFiles {
  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly builtDeps: BuiltMaterializationDeps,
    private readonly tools: ToolCatalog
  ) {}

  async execute(command: ReplacePluginFilesRequest): Promise<void> {
    const { dist, toolId, projectRoot, manifest } = command;
    const { plugin } = command.plugin;
    const tool = this.tools.aiProfile(toolId);
    const baseDir = scopeBaseOf(tool, {
      scope: plugin.scope,
      projectRoot: projectRoot,
      homedir: this.builtDeps.homedir,
    });
    await deleteOldFiles(plugin.files, baseDir, this.fs);
    const mode = placementModeOf(tool);
    if (mode !== null && command.plugin.marketplace !== undefined) {
      await rematerializePlugin(
        { dist, tool, mode, plugin: command.plugin, projectRoot, manifest },
        { fs: this.fs, built: this.builtDeps }
      );
      return;
    }
    const translated = this.builtDeps.translate.execute({ distribution: dist, tool });
    const newFiles = hashOutputFiles(translated.files);
    await writePluginFiles(newFiles, baseDir, this.fs);
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
