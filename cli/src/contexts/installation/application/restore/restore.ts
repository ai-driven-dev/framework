import { join } from "node:path";
import type { AiToolId } from "../../../../shared/domain/tool.js";
import type { AssetProvider } from "../../../../shared/ports/asset-provider.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { Hasher } from "../../../../shared/ports/hasher.js";
import type { Logger } from "../../../../shared/ports/logger.js";
import type { Prompter } from "../../../../shared/ports/prompter.js";
import type { ConfigRef } from "../../../tools/contract/config-refs.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import { FrameworkDescriptor } from "../../domain/canon.js";
import type { Manifest } from "../../domain/manifest.js";
import type { FileMerger } from "../../ports/file-merger.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";
import type { PluginFetcher } from "../../ports/marketplace-sources.js";
import type { Platform } from "../../ports/platform.js";
import type { PluginDistributionReader } from "../../ports/plugin-distribution-reader.js";
import type { BuiltMaterializationDeps } from "../shared/built-materialization-deps.js";
import { requireManifest } from "../shared/require-manifest.js";
import { RestoreAllPlugins, type RestoreAllPluginsResult } from "./restore-all-plugins.js";
import { RestoreToolFiles, type RestoreToolFilesResult } from "./restore-tool-files.js";

/**
 * Where each config artifact sits in the canonical source, asked of every registered profile
 * through the artifacts its capabilities consume, so restoring knows artifacts, not tools.
 * An artifact several tools consume is named once.
 */
function configRefsOf(tools: ToolCatalog): readonly ConfigRef[] {
  const byName = new Map<string, ConfigRef>();
  for (const profile of tools.sortedById()) {
    for (const write of profile.configWrites()) {
      if (write.kind === "hooks") continue;
      for (const ref of write.capability.consumedRefs()) byName.set(ref.name, ref);
    }
  }
  return [...byName.values()];
}

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
  tools: ToolCatalog;
}

interface RestoreCtx {
  manifest: Manifest;
  descriptor: FrameworkDescriptor;
  contentFiles: Map<string, string>;
  projectRoot: string;
  version: string;
  force: boolean;
  interactive: boolean;
  fileFilter: ((p: string) => boolean) | null;
  toolIds: string[];
  pluginName?: string;
  tools: ToolCatalog;
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

export class Restore {
  constructor(
    private readonly fs: FileReader & FileWriter & FileMerger,
    private readonly manifestRepo: ManifestRepository,
    private readonly hasher: Hasher,
    private readonly logger: Logger,
    private readonly platform: Platform,
    private readonly prompter: Prompter,
    private readonly pluginFetcher?: PluginFetcher,
    private readonly pluginDistributionReader?: PluginDistributionReader,
    private readonly assetProvider?: AssetProvider,
    private readonly builtDeps?: BuiltMaterializationDeps
  ) {}

  async execute(options: RestoreCommand): Promise<RestoreResult> {
    const manifest = options.manifest ?? (await requireManifest(this.manifestRepo));
    const ctx = await this.buildRestoreContext(options, manifest);
    return this.executeRestore(ctx);
  }

  private async buildRestoreContext(
    options: RestoreCommand,
    manifest: Manifest
  ): Promise<RestoreCtx> {
    const resolvedVersion = options.version ?? "unknown";
    const configRefs = configRefsOf(options.tools);
    return {
      manifest,
      descriptor: this.buildStaticDescriptor(resolvedVersion, configRefs),
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
      tools: options.tools,
    };
  }

  private async executeRestore(ctx: RestoreCtx): Promise<RestoreResult> {
    const previousManifest = JSON.stringify(ctx.manifest.toJSON());
    const toolResults = await this.runToolRestores(ctx);
    const pluginResult = await this.runPluginRestore(ctx);
    await this.saveIfChanged(toolResults, pluginResult.totalFiles, ctx.manifest, previousManifest);
    return this.buildTotals(toolResults, pluginResult);
  }

  private async runToolRestores(ctx: RestoreCtx): Promise<RestoreToolFilesResult[]> {
    const restoreToolFiles = new RestoreToolFiles(
      this.fs,
      this.hasher,
      this.logger,
      this.platform,
      this.prompter,
      this.assetProvider
    );
    const results: RestoreToolFilesResult[] = [];
    for (const toolId of ctx.toolIds) {
      results.push(await restoreToolFiles.execute({ toolId, ...ctx }));
    }
    return results;
  }

  private async runPluginRestore(ctx: RestoreCtx): Promise<RestoreAllPluginsResult> {
    if (
      this.pluginFetcher === undefined ||
      this.pluginDistributionReader === undefined ||
      this.builtDeps === undefined
    ) {
      return { totalFiles: 0, pluginNames: [], nativeOnlyToolIds: [] };
    }
    return new RestoreAllPlugins(
      this.fs,
      this.hasher,
      this.pluginFetcher,
      this.pluginDistributionReader,
      this.builtDeps
    ).execute({
      projectRoot: ctx.projectRoot,
      manifest: ctx.manifest,
      fileFilter: ctx.fileFilter,
      pluginName: ctx.pluginName,
      toolIds: ctx.toolIds,
      force: ctx.force,
      tools: ctx.tools,
    });
  }

  private async saveIfChanged(
    toolResults: RestoreToolFilesResult[],
    totalPluginFilesRestored: number,
    manifest: Manifest,
    previousManifest: string
  ): Promise<void> {
    const hasChanges =
      toolResults.some((t) => t.restored.length > 0) ||
      totalPluginFilesRestored > 0 ||
      JSON.stringify(manifest.toJSON()) !== previousManifest;
    if (hasChanges) await this.manifestRepo.save(manifest);
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

  private buildStaticDescriptor(
    version: string,
    configRefs: readonly ConfigRef[]
  ): FrameworkDescriptor {
    return new FrameworkDescriptor({
      version,
      contentSections: [],
      templateRefs: [],
      configRefs: [...configRefs],
    });
  }

  private async buildContentFiles(
    frameworkPath: string,
    configRefs: readonly ConfigRef[]
  ): Promise<Map<string, string>> {
    const contentFiles = new Map<string, string>();
    for (const ref of configRefs) {
      const absPath = join(frameworkPath, ref.path);
      if (await this.fs.fileExists(absPath)) {
        contentFiles.set(ref.path, await this.fs.readFile(absPath));
      }
    }
    return contentFiles;
  }
}

function buildFileFilter(files: string[] | undefined): ((p: string) => boolean) | null {
  if (!files || files.length === 0) return null;
  return (relativePath: string) =>
    files.some((entry) => {
      const basename = entry.split("/").at(-1) ?? entry;
      const isDirectoryPrefix = entry.endsWith("/") || !basename.includes(".");
      if (isDirectoryPrefix) {
        const prefix = entry.endsWith("/") ? entry : `${entry}/`;
        return relativePath.startsWith(prefix);
      }
      return relativePath === entry;
    });
}
