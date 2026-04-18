import { join } from "node:path";
import { FrameworkResolutionError } from "../../domain/errors.js";
import { filterGeneratedFilesByIdeContext } from "../../domain/models/config-ref-filter.js";
import type { ConflictDecision } from "../../domain/models/conflict-decision.js";
import {
  generateConfigDistribution,
  generateDistribution,
} from "../../domain/models/distribution.js";
import { buildDocsDistribution } from "../../domain/models/docs.js";
import type { FileDiff } from "../../domain/models/file-diff.js";
import type { FileHash } from "../../domain/models/file-hash.js";
import type { ConfigRef } from "../../domain/models/framework-descriptor.js";
import { GeneratedFile } from "../../domain/models/generated-file.js";
import type { Manifest } from "../../domain/models/manifest.js";
import { detectNewMcpEntries, filterMcpExclusions } from "../../domain/models/mcp.js";
import type { McpExclusion } from "../../domain/models/mcp-exclusion.js";
import {
  buildConfigNameLookup,
  buildMergeFileEntries,
  extractMergeEntries,
  type MergeFileEntry,
  removeEntriesFromJson,
} from "../../domain/models/merge-entry.js";
import {
  type ConfigHandler,
  getToolConfig,
  IDE_TOOL_IDS,
  type IdeToolId,
  isAiToolConfig,
  type ToolId,
} from "../../domain/models/tool-config.js";
import { formatToolScopeValue, parseUpdateScope } from "../../domain/models/update-scope.js";
import type { FileSystem } from "../../domain/ports/file-system.js";
import type { FrameworkLoader } from "../../domain/ports/framework-loader.js";
import type { Git } from "../../domain/ports/git.js";
import type { Hasher } from "../../domain/ports/hasher.js";
import type { Logger } from "../../domain/ports/logger.js";
import type { ManifestRepository } from "../../domain/ports/manifest-repository.js";
import type { Platform } from "../../domain/ports/platform.js";
import type { Prompter } from "../../domain/ports/prompter.js";
import { InputRequiredError, NoManifestError } from "../errors.js";
import { ConflictResolutionUseCase } from "./conflict-resolution-use-case.js";
import { PostInstallPipelineUseCase } from "./shared/post-install-pipeline-use-case.js";

interface UpdateOptions {
  frameworkPath: string;
  version: string;
  docsDir?: string;
  projectRoot: string;
  toolIds?: ToolId[];
  docsOnly?: boolean;
  force?: boolean;
  dryRun?: boolean;
  repo?: string;
  interactive?: boolean;
}

interface UpdateSectionResult {
  alreadyUpToDate: boolean;
  dryRun: boolean;
  diff: FileDiff[];
  kept: string[];
  written: string[];
  deleted: string[];
  backedUp: string[];
  userFileConflicts: string[];
}

interface UpdateToolResult extends UpdateSectionResult {
  toolId: ToolId;
}

type DocsUpdateResult = UpdateSectionResult;

export interface UpdateResult {
  alreadyUpToDate: boolean;
  dryRun: boolean;
  tools: UpdateToolResult[];
  docs: DocsUpdateResult | null;
  totalWritten: number;
  totalDeleted: number;
  toolCount: number;
  diffSummary: { added: number; changed: number; removed: number };
  cancelled?: boolean;
  version?: string;
}

interface ApplyDiffResult {
  kept: string[];
  written: string[];
  deleted: string[];
  backedUp: string[];
  userFileConflicts: string[];
}

interface MergeEntryDiff {
  relativePath: string;
  sectionKey: string | null;
  dropped: Array<{ key: string; conflict: boolean }>;
}

interface InternalUpdateOptions {
  dryRun: boolean;
  force: boolean;
  interactive: boolean;
  conflictResolution: ConflictResolutionUseCase;
}

/** Resolved interactive scope — null means user cancelled */
type InteractiveScopeOutcome =
  | { kind: "scope"; toolIds: ToolId[] | undefined; docsOnly: boolean }
  | { kind: "already-applied"; result: UpdateResult }
  | { kind: "cancelled" };

export class UpdateUseCase {
  constructor(
    private readonly fs: FileSystem,
    private readonly manifestRepo: ManifestRepository,
    private readonly loader: FrameworkLoader,
    private readonly hasher: Hasher,
    private readonly logger: Logger,
    private readonly git: Git,
    private readonly platform: Platform,
    private readonly prompter: Prompter
  ) {}

  async execute(options: UpdateOptions): Promise<UpdateResult> {
    const { force = false, dryRun = false } = options;
    const conflictResolution = new ConflictResolutionUseCase(this.prompter);
    const isInteractive = this.resolveInteractiveFlag(options, force, dryRun);

    if (!isInteractive) {
      return this.executeInternal(options, {
        dryRun,
        force,
        interactive: options.interactive ?? false,
        conflictResolution,
      }).then((r) => ({
        ...r,
        version: options.version,
      }));
    }

    return this.executeInteractive(options, conflictResolution);
  }

  private resolveInteractiveFlag(options: UpdateOptions, force: boolean, dryRun: boolean): boolean {
    return (
      (options.interactive ?? false) &&
      !force &&
      !dryRun &&
      options.toolIds === undefined &&
      !(options.docsOnly ?? false)
    );
  }

  private async executeInteractive(
    options: UpdateOptions,
    conflictResolution: ConflictResolutionUseCase
  ): Promise<UpdateResult> {
    const dryRunResult = await this.executeInternal(options, {
      dryRun: true,
      force: false,
      interactive: true,
      conflictResolution,
    });

    const outcome = await this.buildInteractiveScope(dryRunResult, options, conflictResolution);

    if (outcome.kind === "already-applied") {
      return { ...outcome.result, version: options.version };
    }

    if (outcome.kind === "cancelled") {
      return { ...dryRunResult, cancelled: true, version: options.version };
    }

    return this.executeInternal(
      { ...options, toolIds: outcome.toolIds, docsOnly: outcome.docsOnly, force: true },
      { dryRun: false, force: true, interactive: true, conflictResolution }
    ).then((r) => ({ ...r, cancelled: false, version: options.version }));
  }

  /** Resolves the interactive update scope after a dry-run. */
  private async buildInteractiveScope(
    dryRunResult: UpdateResult,
    options: UpdateOptions,
    conflictResolution: ConflictResolutionUseCase
  ): Promise<InteractiveScopeOutcome> {
    const changedTools = dryRunResult.tools.filter((t) =>
      t.diff.some((d) => d.kind !== "unchanged")
    );
    const docsChanged = dryRunResult.docs?.diff.some((d) => d.kind !== "unchanged") ?? false;

    if (changedTools.length === 0 && !docsChanged) {
      // Nothing changed — run to bump manifest version so the update banner
      // doesn't keep reporting this version as outdated.
      const result = await this.executeInternal(
        { ...options, force: true },
        { dryRun: false, force: true, interactive: true, conflictResolution }
      );
      return { kind: "already-applied", result };
    }

    const scopeChoices = [
      { name: "All", value: "all" },
      ...changedTools.map((t) => ({
        name: `${t.toolId} only`,
        value: formatToolScopeValue(t.toolId),
      })),
      ...(docsChanged ? [{ name: "docs only", value: "docs" }] : []),
    ];

    const scopeSelection = await this.prompter.select("What to update?", scopeChoices);
    const confirmed = await this.prompter.confirm("Apply update?");

    if (!confirmed) return { kind: "cancelled" };

    const scope = parseUpdateScope(scopeSelection);
    let toolIds: ToolId[] | undefined;
    let docsOnly = false;
    if (scope.kind === "docs") {
      docsOnly = true;
    } else if (scope.kind === "tool") {
      toolIds = [scope.toolId];
    }

    return { kind: "scope", toolIds, docsOnly };
  }

  private resolveIdeContext(manifest: Manifest): IdeToolId[] {
    return manifest
      .getInstalledToolIds()
      .filter((id): id is IdeToolId => (IDE_TOOL_IDS as readonly string[]).includes(id));
  }

  private async executeInternal(
    options: UpdateOptions,
    internal: InternalUpdateOptions
  ): Promise<UpdateResult> {
    const { frameworkPath, version, projectRoot, repo } = options;
    const { dryRun, force, conflictResolution } = internal;
    const docsOnly = options.docsOnly ?? false;

    const manifest = await this.manifestRepo.load();
    if (manifest === null) throw new NoManifestError(repo);

    const docsDir = options.docsDir ?? manifest.docsDir;

    const { descriptor, contentFiles, docsFiles } = await this.loader.loadFromDirectory(
      frameworkPath,
      version
    );

    this.validateToolIds(options.toolIds, manifest);

    const ideContext = this.resolveIdeContext(manifest);
    const effectiveToolIds = this.resolveEffectiveToolIds(options, docsOnly, manifest);
    const toolResults = await this.updateAllTools(
      effectiveToolIds,
      manifest,
      descriptor,
      contentFiles,
      docsDir,
      projectRoot,
      version,
      internal,
      ideContext
    );

    const hasExplicitToolFilter =
      !docsOnly && options.toolIds !== undefined && options.toolIds.length > 0;
    const docsResult = hasExplicitToolFilter
      ? null
      : await this.updateDocs(
          manifest,
          docsFiles,
          docsDir,
          projectRoot,
          version,
          force,
          dryRun,
          conflictResolution
        );

    if (!dryRun) {
      await new PostInstallPipelineUseCase(
        this.fs,
        this.manifestRepo,
        this.hasher,
        this.git,
        this.prompter
      ).execute({
        projectRoot,
        version,
        descriptor,
        contentFiles,
        manifest,
        docsDir,
      });
    }

    return this.buildTotals(toolResults, docsResult, dryRun);
  }

  private validateToolIds(toolIds: ToolId[] | undefined, manifest: Manifest): void {
    if (!toolIds || toolIds.length === 0) return;
    const installedIds = new Set(manifest.getInstalledToolIds());
    const notInstalled = toolIds.filter((id) => !installedIds.has(id));
    if (notInstalled.length > 0) {
      throw new InputRequiredError(
        `${notInstalled.join(", ")} ${notInstalled.length === 1 ? "is" : "are"} not installed. Use \`aidd install ${notInstalled.join(" ")}\` first.`
      );
    }
  }

  private resolveEffectiveToolIds(
    options: UpdateOptions,
    docsOnly: boolean,
    manifest: Manifest
  ): ToolId[] {
    if (docsOnly) return [];
    if (options.toolIds && options.toolIds.length > 0) return options.toolIds;
    return manifest.getInstalledToolIds();
  }

  private async updateAllTools(
    toolIds: ToolId[],
    manifest: Manifest,
    descriptor: Awaited<ReturnType<FrameworkLoader["loadFromDirectory"]>>["descriptor"],
    contentFiles: Awaited<ReturnType<FrameworkLoader["loadFromDirectory"]>>["contentFiles"],
    docsDir: string,
    projectRoot: string,
    version: string,
    internal: InternalUpdateOptions,
    ideContext: IdeToolId[]
  ): Promise<UpdateToolResult[]> {
    const toolResults: UpdateToolResult[] = [];
    for (const toolId of toolIds) {
      this.logger.debug(`Checking ${toolId} for updates...`);
      const result = await this.updateToolSection(
        toolId,
        manifest,
        descriptor,
        contentFiles,
        docsDir,
        projectRoot,
        version,
        internal,
        ideContext
      );
      toolResults.push(result);
    }
    return toolResults;
  }

  private async updateToolSection(
    toolId: ToolId,
    manifest: Manifest,
    descriptor: Awaited<ReturnType<FrameworkLoader["loadFromDirectory"]>>["descriptor"],
    contentFiles: Awaited<ReturnType<FrameworkLoader["loadFromDirectory"]>>["contentFiles"],
    docsDir: string,
    projectRoot: string,
    version: string,
    internal: InternalUpdateOptions,
    ideContext: IdeToolId[]
  ): Promise<UpdateToolResult> {
    const { dryRun } = internal;
    const config = getToolConfig(toolId);
    const manifestFiles = manifest.getToolFiles(toolId);
    const manifestMap = new Map(manifestFiles.map((f) => [f.relativePath, f.hash]));
    const rawDistribution = isAiToolConfig(config)
      ? await generateDistribution(
          descriptor,
          config,
          docsDir,
          contentFiles,
          this.hasher,
          this.platform,
          projectRoot,
          this.fs
        )
      : await generateConfigDistribution(
          descriptor,
          config,
          contentFiles,
          this.hasher,
          this.platform,
          projectRoot,
          this.fs
        );
    const newDistribution = filterGeneratedFilesByIdeContext(
      rawDistribution,
      descriptor.configRefs,
      ideContext
    );
    const newDistMap = new Map(newDistribution.map((f) => [f.relativePath, f]));
    const diff = await this.computeDiff(newDistribution, newDistMap, manifestMap, projectRoot);

    const configHandler = config.config();
    const entryDiffs = await this.computeMergeEntryDiff(
      toolId,
      newDistribution,
      manifest,
      configHandler,
      descriptor.configRefs,
      projectRoot
    );

    const result = dryRun
      ? this.emptyApplyDiffResult()
      : await this.applyToolUpdate(
          toolId,
          version,
          manifest,
          newDistribution,
          newDistMap,
          manifestFiles,
          diff,
          entryDiffs,
          configHandler,
          descriptor.configRefs,
          projectRoot,
          internal
        );

    this.appendEntryDiffs(diff, entryDiffs);

    return {
      toolId,
      alreadyUpToDate: !diff.some((d) => d.kind !== "unchanged"),
      dryRun,
      diff,
      ...result,
    };
  }

  private async applyToolUpdate(
    toolId: ToolId,
    version: string,
    manifest: Manifest,
    newDistribution: GeneratedFile[],
    newDistMap: Map<string, GeneratedFile>,
    manifestFiles: ReadonlyArray<{ relativePath: string; hash: FileHash }>,
    diff: FileDiff[],
    entryDiffs: MergeEntryDiff[],
    configHandler: ConfigHandler,
    configRefs: readonly ConfigRef[],
    projectRoot: string,
    internal: InternalUpdateOptions
  ): Promise<ApplyDiffResult> {
    const { force, interactive, conflictResolution } = internal;
    const { filtered, exclusions } = await this.applyMcpExclusions(
      toolId,
      manifest,
      newDistribution,
      configHandler,
      configRefs,
      projectRoot,
      force,
      interactive
    );
    const conflictDecisions = await this.resolveConflicts(diff, force, conflictResolution);
    const result = await this.applyDiff(diff, newDistMap, projectRoot, conflictDecisions, manifest);
    this.warnUserFileConflicts(result.userFileConflicts);
    await this.applySurgicalRemovals(entryDiffs, projectRoot, force, conflictResolution);
    const mergeFiles = this.buildUpdatedMergeEntries(filtered, configHandler, configRefs);
    this.registerToolFiles(
      toolId,
      version,
      manifest,
      newDistribution,
      manifestFiles,
      result,
      mergeFiles,
      exclusions
    );
    return result;
  }

  private async applyMcpExclusions(
    toolId: ToolId,
    manifest: Manifest,
    newDistribution: GeneratedFile[],
    configHandler: ConfigHandler,
    configRefs: readonly ConfigRef[],
    projectRoot: string,
    force: boolean,
    interactive: boolean
  ): Promise<{ filtered: GeneratedFile[]; exclusions: McpExclusion[] }> {
    if (force) manifest.clearExcludedMcp(toolId);
    const lookup = buildConfigNameLookup(configRefs);
    const exclusions = await this.resolveNewExclusions(
      toolId,
      manifest,
      newDistribution,
      configHandler,
      lookup,
      interactive
    );
    const filtered = filterMcpExclusions(
      newDistribution,
      configHandler,
      lookup,
      exclusions,
      this.hasher
    );
    await this.applyMergeFiles(filtered, projectRoot);
    await this.removeExcludedKeysFromDisk(exclusions, configHandler, lookup, filtered, projectRoot);
    return { filtered, exclusions };
  }

  private async resolveNewExclusions(
    toolId: ToolId,
    manifest: Manifest,
    newDistribution: GeneratedFile[],
    configHandler: ConfigHandler,
    lookup: Map<string, string>,
    interactive: boolean
  ): Promise<McpExclusion[]> {
    const newEntries = detectNewMcpEntries(
      newDistribution,
      configHandler,
      lookup,
      manifest.getMergeFiles(toolId),
      manifest.getExcludedMcp(toolId)
    );
    const declined = await this.promptNewMcpEntries(newEntries, interactive);
    return [...manifest.getExcludedMcp(toolId), ...declined];
  }

  private emptyApplyDiffResult(): ApplyDiffResult {
    return { kept: [], written: [], deleted: [], backedUp: [], userFileConflicts: [] };
  }

  private appendEntryDiffs(diff: FileDiff[], entryDiffs: MergeEntryDiff[]): void {
    for (const entry of entryDiffs) {
      for (const { key, conflict } of entry.dropped) {
        diff.push({
          relativePath: `${entry.relativePath} > ${key}`,
          kind: "removed",
          conflict,
        });
      }
    }
  }

  private warnUserFileConflicts(conflicts: string[]): void {
    for (const relativePath of conflicts) {
      this.logger.warn(
        `\`${relativePath}\` already exists and was not installed by AIDD — skipped to preserve user file`
      );
    }
  }

  private async applyMergeFiles(
    newDistribution: GeneratedFile[],
    projectRoot: string
  ): Promise<void> {
    for (const newFile of newDistribution) {
      if (newFile.mergeStrategy === "none") continue;
      const outputPath = join(projectRoot, newFile.relativePath);
      await this.fs.mergeJsonFile(outputPath, newFile.content, newFile.mergeStrategy);
    }
  }

  private registerToolFiles(
    toolId: ToolId,
    version: string,
    manifest: Manifest,
    newDistribution: GeneratedFile[],
    manifestFiles: ReadonlyArray<{ relativePath: string; hash: FileHash }>,
    result: ApplyDiffResult,
    mergeFiles: MergeFileEntry[],
    exclusions: McpExclusion[]
  ): void {
    const nonMergedFinal = newDistribution
      .filter((f) => f.mergeStrategy === "none")
      .filter(
        (f) =>
          !result.deleted.includes(f.relativePath) &&
          !result.kept.includes(f.relativePath) &&
          !result.userFileConflicts.includes(f.relativePath)
      );
    const keptFiles = manifestFiles
      .filter((f) => result.kept.includes(f.relativePath))
      .map((f) => new GeneratedFile({ relativePath: f.relativePath, content: "", hash: f.hash }));
    manifest.addTool(toolId, version, [...nonMergedFinal, ...keptFiles], mergeFiles, exclusions);
  }

  private async computeMergeEntryDiff(
    toolId: ToolId,
    newDistribution: GeneratedFile[],
    manifest: Manifest,
    configHandler: ConfigHandler,
    configRefs: readonly ConfigRef[],
    projectRoot: string
  ): Promise<MergeEntryDiff[]> {
    const configNameLookup = buildConfigNameLookup(configRefs);
    const diffs: MergeEntryDiff[] = [];
    for (const manifestEntry of manifest.getMergeFiles(toolId)) {
      const diff = await this.diffOneMergeFile(
        manifestEntry,
        newDistribution,
        configHandler,
        configNameLookup,
        projectRoot
      );
      if (diff.dropped.length > 0) diffs.push(diff);
    }
    return diffs;
  }

  private async diffOneMergeFile(
    manifestEntry: MergeFileEntry,
    newDistribution: GeneratedFile[],
    configHandler: ConfigHandler,
    pathToConfigName: Map<string, string>,
    projectRoot: string
  ): Promise<MergeEntryDiff> {
    const newFile = newDistribution.find(
      (f) => f.relativePath === manifestEntry.relativePath && f.mergeStrategy !== "none"
    );
    const newEntries = this.extractNewEntries(newFile, configHandler, pathToConfigName);
    const dropped = await this.findDroppedEntries(manifestEntry, newEntries, projectRoot);
    return {
      relativePath: manifestEntry.relativePath,
      sectionKey: manifestEntry.sectionKey,
      dropped,
    };
  }

  private extractNewEntries(
    newFile: GeneratedFile | undefined,
    configHandler: ConfigHandler,
    pathToConfigName: Map<string, string>
  ): Set<string> {
    if (!newFile) return new Set();
    const configName = newFile.frameworkPath
      ? pathToConfigName.get(newFile.frameworkPath)
      : undefined;
    const sectionKey = configName ? configHandler.entrySection(configName) : null;
    const entries = extractMergeEntries(newFile.content, sectionKey, this.hasher);
    return new Set(Object.keys(entries));
  }

  private async findDroppedEntries(
    manifestEntry: MergeFileEntry,
    newEntryKeys: Set<string>,
    projectRoot: string
  ): Promise<Array<{ key: string; conflict: boolean }>> {
    const diskEntries = await this.readDiskEntries(manifestEntry, projectRoot);
    const dropped: Array<{ key: string; conflict: boolean }> = [];
    for (const [key, manifestHash] of Object.entries(manifestEntry.entries)) {
      if (newEntryKeys.has(key)) continue;
      const diskHash = diskEntries[key];
      const conflict = diskHash !== undefined && !diskHash.equals(manifestHash);
      dropped.push({ key, conflict });
    }
    return dropped;
  }

  private async readDiskEntries(
    mergeFile: MergeFileEntry,
    projectRoot: string
  ): Promise<Record<string, FileHash>> {
    const fullPath = join(projectRoot, mergeFile.relativePath);
    if (!(await this.fs.fileExists(fullPath))) return {};
    const diskContent = await this.fs.readFile(fullPath);
    return extractMergeEntries(diskContent, mergeFile.sectionKey, this.hasher);
  }

  private async applySurgicalRemovals(
    entryDiffs: MergeEntryDiff[],
    projectRoot: string,
    force: boolean,
    conflictResolution: ConflictResolutionUseCase
  ): Promise<void> {
    for (const diff of entryDiffs) {
      await this.removeMergeEntries(diff, projectRoot, force, conflictResolution);
    }
  }

  private async removeMergeEntries(
    diff: MergeEntryDiff,
    projectRoot: string,
    force: boolean,
    conflictResolution: ConflictResolutionUseCase
  ): Promise<void> {
    const fullPath = join(projectRoot, diff.relativePath);
    if (!(await this.fs.fileExists(fullPath))) return;
    const hasConflicts = diff.dropped.some((d) => d.conflict);
    const keysToRemove = await this.resolveEntryRemovals(
      diff.dropped,
      diff.relativePath,
      force,
      conflictResolution
    );
    if (keysToRemove.length === 0) return;
    if (hasConflicts && force) await this.fs.backup(fullPath);
    await this.removeKeysFromJsonFile(fullPath, diff.sectionKey, keysToRemove);
  }

  private async resolveEntryRemovals(
    dropped: Array<{ key: string; conflict: boolean }>,
    relativePath: string,
    force: boolean,
    conflictResolution: ConflictResolutionUseCase
  ): Promise<string[]> {
    const keysToRemove: string[] = [];
    for (const { key, conflict } of dropped) {
      if (!conflict) {
        keysToRemove.push(key);
        continue;
      }
      if (force) {
        keysToRemove.push(key);
        continue;
      }
      const entryPath = `${relativePath} > ${key}`;
      const decisions = await conflictResolution.execute([entryPath]);
      const decision = decisions.get(entryPath) ?? "skip";
      if (decision !== "skip") keysToRemove.push(key);
    }
    return keysToRemove;
  }

  private async removeKeysFromJsonFile(
    fullPath: string,
    sectionKey: string | null,
    keysToRemove: string[]
  ): Promise<void> {
    const content = await this.fs.readFile(fullPath);
    await this.fs.writeFile(fullPath, removeEntriesFromJson(content, sectionKey, keysToRemove));
  }

  private async promptNewMcpEntries(
    newEntries: McpExclusion[],
    interactive: boolean
  ): Promise<McpExclusion[]> {
    if (!interactive) return [];
    const choices = newEntries.map((e) => ({
      name: e.entryKey,
      value: e,
      checked: true,
    }));
    const accepted = await this.prompter.checkbox(
      "New MCP servers found. Which do you want to install?",
      choices
    );
    const acceptedSet = new Set(accepted);
    return newEntries.filter((e) => !acceptedSet.has(e));
  }

  private async removeExcludedKeysFromDisk(
    exclusions: readonly McpExclusion[],
    configHandler: ConfigHandler,
    configNameLookup: Map<string, string>,
    filtered: GeneratedFile[],
    projectRoot: string
  ): Promise<void> {
    if (exclusions.length === 0) return;
    for (const file of filtered) {
      if (file.mergeStrategy === "none") continue;
      const fileExclusions = exclusions.filter((e) => e.configPath === file.relativePath);
      if (fileExclusions.length === 0) continue;
      const configName = file.frameworkPath ? configNameLookup.get(file.frameworkPath) : undefined;
      if (!configName) continue;
      const sectionKey = configHandler.entrySection(configName);
      if (sectionKey === null) continue;
      await this.removeKeysFromJsonFile(
        join(projectRoot, file.relativePath),
        sectionKey,
        fileExclusions.map((e) => e.entryKey)
      );
    }
  }

  private buildUpdatedMergeEntries(
    newDistribution: GeneratedFile[],
    configHandler: ConfigHandler,
    configRefs: readonly ConfigRef[]
  ): MergeFileEntry[] {
    return buildMergeFileEntries(
      newDistribution,
      configHandler,
      buildConfigNameLookup(configRefs),
      this.hasher
    );
  }

  private buildTotals(
    toolResults: UpdateToolResult[],
    docsResult: DocsUpdateResult | null,
    dryRun: boolean
  ): UpdateResult {
    const totalWritten =
      toolResults.reduce((s, t) => s + t.written.length, 0) + (docsResult?.written.length ?? 0);
    const totalDeleted =
      toolResults.reduce((s, t) => s + t.deleted.length, 0) + (docsResult?.deleted.length ?? 0);
    const toolCount = toolResults.filter((t) => !t.alreadyUpToDate).length;

    const countDiffKind = (kind: string) =>
      toolResults.reduce((s, t) => s + t.diff.filter((d) => d.kind === kind).length, 0) +
      (docsResult?.diff.filter((d) => d.kind === kind).length ?? 0);
    const diffSummary = {
      added: countDiffKind("added"),
      changed: countDiffKind("changed"),
      removed: countDiffKind("removed"),
    };

    return {
      alreadyUpToDate:
        toolResults.every((r) => r.alreadyUpToDate) &&
        (docsResult === null || docsResult.alreadyUpToDate),
      dryRun,
      tools: toolResults,
      docs: docsResult,
      totalWritten,
      totalDeleted,
      toolCount,
      diffSummary,
    };
  }

  private async updateDocs(
    manifest: Manifest,
    docsFiles: Map<string, string>,
    docsDir: string,
    projectRoot: string,
    version: string,
    force: boolean,
    dryRun: boolean,
    conflictResolution: ConflictResolutionUseCase
  ): Promise<DocsUpdateResult | null> {
    if (!manifest.hasDocs()) return null;

    this.logger.debug("Checking docs for updates...");

    const newDistribution = buildDocsDistribution(docsFiles, docsDir, this.hasher);
    const newDistMap = new Map(newDistribution.map((f) => [f.relativePath, f]));
    const manifestFiles = manifest.getDocsFiles();
    const manifestMap = new Map(manifestFiles.map((f) => [f.relativePath, f.hash]));
    const diff = await this.computeDiff(newDistribution, newDistMap, manifestMap, projectRoot);

    let result: ApplyDiffResult = this.emptyApplyDiffResult();

    if (!dryRun) {
      const conflictDecisions = await this.resolveConflicts(diff, force, conflictResolution);
      result = await this.applyDiff(diff, newDistMap, projectRoot, conflictDecisions, manifest);
      this.warnUserFileConflicts(result.userFileConflicts);

      const finalFiles = newDistribution.filter(
        (f) =>
          !result.deleted.includes(f.relativePath) &&
          !result.kept.includes(f.relativePath) &&
          !result.userFileConflicts.includes(f.relativePath)
      );
      const keptFiles = manifestFiles
        .filter((f) => result.kept.includes(f.relativePath))
        .map((f) => new GeneratedFile({ relativePath: f.relativePath, content: "", hash: f.hash }));
      manifest.addDocs(version, [...finalFiles, ...keptFiles]);
    }

    return {
      alreadyUpToDate: !diff.some((d) => d.kind !== "unchanged"),
      dryRun,
      diff,
      ...result,
    };
  }

  private async resolveConflicts(
    diff: FileDiff[],
    force: boolean,
    conflictResolution: ConflictResolutionUseCase
  ): Promise<Map<string, ConflictDecision>> {
    const conflictPaths = diff
      .filter((e) => (e.kind === "changed" || e.kind === "removed") && e.conflict)
      .map((e) => e.relativePath);
    if (conflictPaths.length === 0) return new Map();
    if (force) {
      return new Map(conflictPaths.map((p) => [p, "backup"]));
    }
    return conflictResolution.execute(conflictPaths);
  }

  private async applyDiff(
    diff: FileDiff[],
    distMap: Map<string, GeneratedFile>,
    projectRoot: string,
    conflictDecisions: Map<string, ConflictDecision>,
    manifest: Manifest
  ): Promise<ApplyDiffResult> {
    const kept: string[] = [];
    const written: string[] = [];
    const deleted: string[] = [];
    const backedUp: string[] = [];
    const userFileConflicts: string[] = [];

    for (const entry of diff) {
      if (entry.kind === "added") {
        const newFile = distMap.get(entry.relativePath);
        if (!newFile)
          throw new FrameworkResolutionError(
            `Missing new file in distribution: ${entry.relativePath}`
          );
        const outputPath = join(projectRoot, entry.relativePath);
        if ((await this.fs.fileExists(outputPath)) && !manifest.isFileTracked(entry.relativePath)) {
          userFileConflicts.push(entry.relativePath);
          continue;
        }
        await this.fs.writeFile(outputPath, newFile.content);
        written.push(entry.relativePath);
      } else if (entry.kind === "removed") {
        if (entry.conflict) {
          const decision = conflictDecisions.get(entry.relativePath) ?? "overwrite";
          if (decision === "skip") {
            // User keeps their modified version on disk as an untracked file.
            // Excluded from the new manifest automatically (not in newDistribution).
            continue;
          }
          if (decision === "backup") {
            const backupPath = await this.fs.backup(join(projectRoot, entry.relativePath));
            backedUp.push(backupPath.replace(`${projectRoot}/`, ""));
          }
        }
        await this.fs.deleteFile(join(projectRoot, entry.relativePath));
        deleted.push(entry.relativePath);
      } else if (entry.kind === "changed") {
        if (entry.conflict) {
          const decision = conflictDecisions.get(entry.relativePath) ?? "overwrite";
          if (decision === "skip") {
            kept.push(entry.relativePath);
            continue;
          }
          if (decision === "backup") {
            const backupPath = await this.fs.backup(join(projectRoot, entry.relativePath));
            backedUp.push(backupPath.replace(`${projectRoot}/`, ""));
          }
        }
        const newFile = distMap.get(entry.relativePath);
        if (!newFile)
          throw new FrameworkResolutionError(
            `Missing new file in distribution: ${entry.relativePath}`
          );
        await this.fs.writeFile(join(projectRoot, entry.relativePath), newFile.content);
        written.push(entry.relativePath);
      }
    }

    return { kept, written, deleted, backedUp, userFileConflicts };
  }

  private async computeDiff(
    newDistribution: GeneratedFile[],
    newDistMap: Map<string, GeneratedFile>,
    manifestMap: Map<string, FileHash>,
    projectRoot: string
  ): Promise<FileDiff[]> {
    const diff: FileDiff[] = [];

    for (const newFile of newDistribution) {
      if (newFile.mergeStrategy !== "none") continue;
      const manifestHash = manifestMap.get(newFile.relativePath);
      if (manifestHash === undefined) {
        diff.push({ relativePath: newFile.relativePath, kind: "added" });
      } else if (newFile.hash.value !== manifestHash.value) {
        const conflict = await this.fs.hasLocalChanges(
          join(projectRoot, newFile.relativePath),
          manifestHash
        );
        diff.push({ relativePath: newFile.relativePath, kind: "changed", conflict });
      } else {
        const diskPath = join(projectRoot, newFile.relativePath);
        const diskExists = await this.fs.fileExists(diskPath);
        if (!diskExists) {
          diff.push({ relativePath: newFile.relativePath, kind: "changed", conflict: false });
        } else {
          const conflict = await this.fs.hasLocalChanges(diskPath, manifestHash);
          diff.push({
            relativePath: newFile.relativePath,
            kind: conflict ? "changed" : "unchanged",
            conflict,
          });
        }
      }
    }

    for (const [relativePath, manifestHash] of manifestMap) {
      if (!newDistMap.has(relativePath)) {
        const conflict = await this.fs.hasLocalChanges(
          join(projectRoot, relativePath),
          manifestHash
        );
        diff.push({ relativePath, kind: "removed", conflict });
      }
    }

    return diff;
  }
}
