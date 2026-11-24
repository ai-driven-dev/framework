import { join } from "node:path";
import type { PluginDistribution } from "../../../../shared/domain/plugin/plugin-distribution.js";
import type { AiToolId } from "../../../../shared/domain/tool.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
// biome-ignore lint/plugin: hands the profile to the plugin translation pipeline; it narrows when installation declares its own profile input
import type { AiToolProfile } from "../../../tools/contract/tool-profile.js";
import type { PluginTranslationMode } from "../../../tools/contract/tool-vocabulary.js";
import type { Manifest } from "../../domain/manifest.js";
import type { RecordedPlugin } from "../../domain/plugins/recorded-plugin.js";
import type { LoadDistribution } from "../../ports/plugin/load-plugin-distribution.js";
import type { BuiltPlacement } from "../materialize/add-plugin-request.js";
import { deliversHooksToProject, placementModeOf } from "../materialize/plugin-placement.js";
import { rematerializePlugin } from "../materialize/rematerialize-plugin.js";
import { isPluginFileAtDesiredState } from "../plugin/files/check-plugin-file-state.js";
import { deleteOldFiles } from "../plugin/files/delete-plugin-files.js";
import { scopeBaseOf } from "../plugin/plugin-target-resolution.js";
import { hashOutputFiles } from "../shared/hash-output-files.js";

interface ApplyPluginFilesRequest {
  toolId: AiToolId;
  plugin: RecordedPlugin;
  tool: AiToolProfile;
  projectRoot: string;
  cacheDir: string;
  manifest: Manifest;
  fileFilter?: ((relativePath: string) => boolean) | null;
  /** Overwrite a project hook the user edited after install instead of refusing. */
  force?: boolean;
}

/** What ApplyPluginFiles is built from. */
export interface ApplyPluginFilesDeps extends BuiltPlacement {
  readonly fs: FileReader & FileWriter;
  readonly loadDistribution: LoadDistribution;
}

export class ApplyPluginFiles {
  constructor(private readonly deps: ApplyPluginFilesDeps) {}

  async execute(options: ApplyPluginFilesRequest): Promise<number> {
    if (options.plugin.plugin.scope === "user") return 0;
    const dist = await this.deps.loadDistribution(options.plugin.plugin.source, options.cacheDir);
    const mode = placementModeOf(options.tool);
    if (
      mode !== null &&
      (options.plugin.marketplace !== undefined ||
        (!options.fileFilter && deliversHooksToProject(options.tool)))
    ) {
      return this.restoreViaPlacement(mode, dist, options);
    }
    return this.restoreViaTranslate(dist, options);
  }

  // Materializing tools (cursor/opencode) must re-materialize from the BUILT tree so
  // restored content + hashes match what install wrote, and Mode A marketplace tools
  // (claude/codex/copilot) must re-register without writing files: not the raw source
  // transform in either case.
  private async restoreViaPlacement(
    mode: PluginTranslationMode,
    dist: PluginDistribution,
    options: ApplyPluginFilesRequest
  ): Promise<number> {
    const { tool, plugin, projectRoot, manifest, force = false } = options;
    // Mode A never materializes files, so any manifest-tracked path here is a leftover from a run
    // before that was true. Scoped to the manifest's own keys under the plugin's base dir: never a
    // directory scan: so it cannot touch files the plugin never wrote.
    if (mode === "marketplace") {
      const baseDir = scopeBaseOf(tool, {
        scope: plugin.plugin.scope,
        projectRoot: projectRoot,
        homedir: () => this.deps.homedir(),
      });
      await deleteOldFiles(plugin.plugin.files, baseDir, this.deps.fs);
    }
    return rematerializePlugin(
      { dist, tool, mode, plugin, projectRoot, manifest, hooksGuard: { overwriteEdited: force } },
      this.deps.placeBuiltTree
    );
  }

  private async restoreViaTranslate(
    dist: PluginDistribution,
    options: ApplyPluginFilesRequest
  ): Promise<number> {
    const { toolId, plugin, tool, projectRoot, manifest, fileFilter } = options;
    const files = hashOutputFiles(this.deps.translate.execute({ distribution: dist, tool }).files);
    let restored = 0;
    for (const f of files) {
      if (fileFilter !== null && fileFilter !== undefined && !fileFilter(f.relativePath)) continue;
      const outputPath = join(projectRoot, f.relativePath);
      if (!(await isPluginFileAtDesiredState(this.deps.fs, outputPath, f.hash.value))) {
        await this.deps.fs.writeFile(outputPath, f.content);
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
