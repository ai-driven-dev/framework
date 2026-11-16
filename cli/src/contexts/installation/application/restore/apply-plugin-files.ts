import { join } from "node:path";
import type { PluginDistribution } from "../../../../shared/domain/plugin/plugin-distribution.js";
import type { AiToolId } from "../../../../shared/domain/tool.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { Hasher } from "../../../../shared/ports/hasher.js";
import type { AiToolProfile } from "../../../tools/contract/tool-profile.js";
import type { Manifest } from "../../domain/manifest.js";
import type { InstalledPlugin } from "../../domain/plugins/installed-plugin.js";
import type { PluginFetcher } from "../../ports/marketplace-sources.js";
import type { PluginDistributionReader } from "../../ports/plugin/plugin-distribution-reader.js";
import type { PluginTranslator } from "../materialize/plugin-translator.js";
import { resolvePluginTranslator } from "../materialize/resolve-plugin-translator.js";
import {
  deleteOldFiles,
  isPluginFileAtDesiredState,
  materializeViaTranslator,
} from "../plugin/plugin-helpers.js";
import { resolveBaseDirFromRecord } from "../plugin/plugin-target-resolution.js";
import type { BuiltMaterializationDeps } from "../shared/built-materialization-deps.js";
import { hashOutputFiles } from "../shared/hash-output-files.js";

interface ApplyPluginFilesCommand {
  toolId: AiToolId;
  plugin: InstalledPlugin;
  tool: AiToolProfile;
  projectRoot: string;
  cacheDir: string;
  manifest: Manifest;
  fileFilter?: ((relativePath: string) => boolean) | null;
  /** Overwrite a project hook the user edited after install instead of refusing. */
  force?: boolean;
}

function deliversHooksToProject(tool: AiToolProfile): boolean {
  return tool.plugins()?.deliversHooksToProject() ?? false;
}

export class ApplyPluginFiles {
  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly hasher: Hasher,
    private readonly pluginFetcher: PluginFetcher,
    private readonly pluginDistributionReader: PluginDistributionReader,
    private readonly builtDeps: BuiltMaterializationDeps
  ) {}

  async execute(options: ApplyPluginFilesCommand): Promise<number> {
    if (options.plugin.scope === "user") return 0;
    const localPath = await this.pluginFetcher.fetch(options.plugin.source, options.cacheDir);
    const dist = await this.pluginDistributionReader.read(localPath);
    const translator = this.resolveTranslator(options.tool);
    if (
      translator !== null &&
      (options.plugin.marketplace !== undefined ||
        (!options.fileFilter && deliversHooksToProject(options.tool)))
    ) {
      return this.restoreViaTranslator(translator, dist, options);
    }
    return this.restoreViaTranslate(dist, options);
  }

  // Materializing tools (cursor/opencode) must re-materialize from the BUILT tree so
  // restored content + hashes match what install wrote, and Mode A marketplace tools
  // (claude/codex/copilot) must re-register without writing files — not the raw source
  // transform in either case.
  private resolveTranslator(tool: AiToolProfile): PluginTranslator | null {
    return resolvePluginTranslator(tool, {
      fs: this.fs,
      hasher: this.hasher,
      built: this.builtDeps,
    });
  }

  private async restoreViaTranslator(
    translator: PluginTranslator,
    dist: PluginDistribution,
    options: ApplyPluginFilesCommand
  ): Promise<number> {
    const { tool, plugin, projectRoot, manifest, force = false } = options;
    // Mode A never materializes files, so any manifest-tracked path here is a leftover from a run
    // before that was true. Scoped to the manifest's own keys under the plugin's base dir — never a
    // directory scan — so it cannot touch files the plugin never wrote.
    if (translator.mode === "marketplace") {
      const baseDir = resolveBaseDirFromRecord(
        plugin.scope,
        tool,
        projectRoot,
        this.builtDeps.homedir
      );
      await deleteOldFiles(plugin.files, baseDir, this.fs);
    }
    return materializeViaTranslator(translator, dist, tool, plugin, projectRoot, manifest, {
      overwriteEdited: force,
    });
  }

  private async restoreViaTranslate(
    dist: PluginDistribution,
    options: ApplyPluginFilesCommand
  ): Promise<number> {
    const { toolId, plugin, tool, projectRoot, manifest, fileFilter } = options;
    const files = hashOutputFiles(
      this.builtDeps.translate.execute({ distribution: dist, tool }).files,
      this.hasher
    );
    let restored = 0;
    for (const f of files) {
      if (fileFilter !== null && fileFilter !== undefined && !fileFilter(f.relativePath)) continue;
      const outputPath = join(projectRoot, f.relativePath);
      if (!(await isPluginFileAtDesiredState(this.fs, this.hasher, outputPath, f.hash.value))) {
        await this.fs.writeFile(outputPath, f.content);
        restored++;
      }
    }
    manifest.updatePlugin(
      toolId,
      plugin.withFiles(new Map(files.map((f) => [f.relativePath, f.hash.value])))
    );
    return restored;
  }
}
