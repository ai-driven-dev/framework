import { join } from "node:path";
import type { AiToolId } from "../../../../shared/domain/tool.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { ConfigRef } from "../../../tools/contract/config-refs.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import type { Manifest } from "../../domain/manifest.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";
import { requireManifest } from "../shared/require-manifest.js";
import type { RestoreAllPlugins, RestoreAllPluginsResult } from "./restore-all-plugins.use-case.js";
import { buildFileFilter, configRefsOf } from "./restore-inputs.js";
import type { RestoreToolFiles, RestoreToolFilesResult } from "./restore-tool-files.use-case.js";

interface RestoreCommand {
  frameworkPath?: string;
  version?: string;
  projectRoot: string;
  toolIds?: string[];
  files?: string[];
  force?: boolean;
  interactive?: boolean;
  manifest?: Manifest;
  pluginName?: string;
}

interface RestoreCtx {
  manifest: Manifest;
  configRefs: readonly ConfigRef[];
  contentFiles: Map<string, string>;
  projectRoot: string;
  version: string;
  force: boolean;
  interactive: boolean;
  fileFilter: ((p: string) => boolean) | null;
  toolIds: string[];
  pluginName?: string;
}

interface RestoreResult {
  tools: RestoreToolFilesResult[];
  totalRestored: number;
  totalKept: number;
  totalPluginFilesRestored: number;
  restoredPluginNames: string[];
  unrestorable: string[];
  /** AI tools this pass could not restore any plugin file for, because their registration is
   * native. */
  nativeOnlyToolIds: AiToolId[];
}

/** What Restore is built from. */
export interface RestoreDeps {
  readonly fs: FileReader;
  readonly manifestRepo: ManifestRepository;
  readonly restoreToolFiles: RestoreToolFiles;
  readonly restoreAllPlugins: RestoreAllPlugins;
}

export class Restore {
  constructor(
    private readonly deps: RestoreDeps,
    private readonly tools: ToolCatalog
  ) {}

  async execute(options: RestoreCommand): Promise<RestoreResult> {
    const manifest = options.manifest ?? (await requireManifest(this.deps.manifestRepo));
    const ctx = await this.buildRestoreContext(options, manifest);
    return this.executeRestore(ctx);
  }

  private async buildRestoreContext(
    options: RestoreCommand,
    manifest: Manifest
  ): Promise<RestoreCtx> {
    const resolvedVersion = options.version ?? "unknown";
    const configRefs = configRefsOf(this.tools);
    return {
      manifest,
      configRefs,
      contentFiles: options.frameworkPath
        ? await this.buildContentFiles(options.frameworkPath, configRefs)
        : new Map(),
      projectRoot: options.projectRoot,
      version: resolvedVersion,
      force: options.force ?? false,
      interactive: options.interactive ?? false,
      fileFilter: buildFileFilter(options.files),
      toolIds: options.toolIds?.length ? options.toolIds : manifest.getInstalledToolIds(),
      pluginName: options.pluginName,
    };
  }

  private async executeRestore(ctx: RestoreCtx): Promise<RestoreResult> {
    const previousManifest = JSON.stringify(ctx.manifest.toJSON());
    const toolResults = await this.runToolRestores(ctx);
    const pluginResult = await this.runPluginRestore(ctx);
    await this.saveIfChanged({
      toolResults,
      totalPluginFilesRestored: pluginResult.totalFiles,
      manifest: ctx.manifest,
      previousManifest,
    });
    return this.buildTotals(toolResults, pluginResult);
  }

  private async runToolRestores(ctx: RestoreCtx): Promise<RestoreToolFilesResult[]> {
    const results: RestoreToolFilesResult[] = [];
    for (const toolId of ctx.toolIds) {
      results.push(await this.deps.restoreToolFiles.execute({ toolId, ...ctx }));
    }
    return results;
  }

  private async runPluginRestore(ctx: RestoreCtx): Promise<RestoreAllPluginsResult> {
    return this.deps.restoreAllPlugins.execute({
      projectRoot: ctx.projectRoot,
      manifest: ctx.manifest,
      fileFilter: ctx.fileFilter,
      pluginName: ctx.pluginName,
      toolIds: ctx.toolIds,
      force: ctx.force,
    });
  }

  private async saveIfChanged(outcome: {
    toolResults: RestoreToolFilesResult[];
    totalPluginFilesRestored: number;
    manifest: Manifest;
    previousManifest: string;
  }): Promise<void> {
    const { toolResults, totalPluginFilesRestored, manifest, previousManifest } = outcome;
    const hasChanges =
      toolResults.some((t) => t.restored.length > 0) ||
      totalPluginFilesRestored > 0 ||
      JSON.stringify(manifest.toJSON()) !== previousManifest;
    if (hasChanges) await this.deps.manifestRepo.save(manifest);
  }

  private buildTotals(
    toolResults: RestoreToolFilesResult[],
    pluginResult: RestoreAllPluginsResult
  ): RestoreResult {
    return {
      tools: toolResults,
      totalRestored: toolResults.reduce((s, t) => s + t.restored.length, 0),
      totalKept: toolResults.reduce((s, t) => s + t.kept.length, 0),
      totalPluginFilesRestored: pluginResult.totalFiles,
      restoredPluginNames: pluginResult.pluginNames,
      unrestorable: toolResults.flatMap((t) => t.unrestorable),
      nativeOnlyToolIds: pluginResult.nativeOnlyToolIds,
    };
  }

  private async buildContentFiles(
    frameworkPath: string,
    configRefs: readonly ConfigRef[]
  ): Promise<Map<string, string>> {
    const contentFiles = new Map<string, string>();
    for (const ref of configRefs) {
      const absPath = join(frameworkPath, ref.path);
      if (await this.deps.fs.fileExists(absPath)) {
        contentFiles.set(ref.path, await this.deps.fs.readFile(absPath));
      }
    }
    return contentFiles;
  }
}
