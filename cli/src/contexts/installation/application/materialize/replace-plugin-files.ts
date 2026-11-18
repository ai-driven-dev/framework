import { homedir as nodeHomedir } from "node:os";
import type { PluginDistribution } from "../../../../shared/domain/plugin/plugin-distribution.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { Hasher } from "../../../../shared/ports/hasher.js";
import type { AiToolProfile } from "../../../tools/contract/tool-profile.js";
import type { Manifest } from "../../domain/manifest.js";
import { InstalledPlugin } from "../../domain/plugins/installed-plugin.js";
import {
  deleteOldFiles,
  materializeViaTranslator,
  writePluginFiles,
} from "../plugin/plugin-helpers.js";
import { resolveBaseDirFromRecord } from "../plugin/plugin-target-resolution.js";
import type { BuiltMaterializationDeps } from "../shared/built-materialization-deps.js";
import { hashOutputFiles } from "../shared/hash-output-files.js";
import type { PluginTranslator } from "./plugin-translator.js";
import { resolvePluginTranslator } from "./resolve-plugin-translator.js";

export interface ReplacePluginFilesCommand {
  readonly plugin: InstalledPlugin;
  readonly dist: PluginDistribution;
  readonly tool: AiToolProfile;
  readonly projectRoot: string;
  readonly manifest: Manifest;
}

/** Replaces an installed plugin's files with the ones a newer distribution brings: the old files
 * go first, then the plugin is written the way install would have written it for that tool. */
export class ReplacePluginFiles {
  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly hasher: Hasher,
    private readonly builtDeps: BuiltMaterializationDeps
  ) {}

  async execute(command: ReplacePluginFilesCommand): Promise<void> {
    const { plugin, dist, tool, projectRoot, manifest } = command;
    const baseDir = resolveBaseDirFromRecord(plugin.scope, tool, projectRoot, nodeHomedir);
    await deleteOldFiles(plugin.files, baseDir, this.fs);
    const translator = this.resolveTranslator(tool);
    if (translator !== null && plugin.marketplace !== undefined) {
      await materializeViaTranslator(translator, dist, tool, plugin, projectRoot, manifest);
      return;
    }
    const translated = this.builtDeps.translate.execute({ distribution: dist, tool });
    const newFiles = hashOutputFiles(translated.files, this.hasher);
    await writePluginFiles(newFiles, baseDir, this.fs);
    manifest.updatePlugin(
      tool.toolId,
      InstalledPlugin.fromDistribution(
        dist,
        plugin.source,
        newFiles,
        plugin.scope,
        translated.componentPaths
      )
    );
  }

  // Materializing tools (cursor/opencode) re-materialize from the BUILT tree, and Mode A
  // marketplace tools (claude/codex/copilot) re-register without writing files, so an
  // update matches whatever install would have done for that tool.
  private resolveTranslator(tool: AiToolProfile): PluginTranslator | null {
    return resolvePluginTranslator(tool, {
      fs: this.fs,
      hasher: this.hasher,
      built: this.builtDeps,
    });
  }
}
