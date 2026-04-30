import { dirname, join } from "node:path";
import { HooksCapability } from "../../../domain/capabilities/hooks-capability.js";
import { McpCapability } from "../../../domain/capabilities/mcp-capability.js";
import { FrameworkResolutionError } from "../../../domain/errors.js";
import {
  type FileDiff,
  type FileHash,
  InstallationFile,
  removeRedundantGitkeeps,
} from "../../../domain/models/file.js";
import type { ConfigRef } from "../../../domain/models/framework.js";
import type { Manifest } from "../../../domain/models/manifest.js";
import {
  detectNewMcpEntries,
  filterMcpExclusions,
  type McpExclusion,
} from "../../../domain/models/mcp-exclusion.js";
import {
  buildConfigNameLookup,
  buildMergeFileEntries,
  type ConflictDecision,
  extractMergeEntries,
  isMergeContentEmpty,
  type MergeFileEntry,
  removeEntriesFromJson,
} from "../../../domain/models/merge.js";
import { formatToolScopeValue, parseUpdateScope } from "../../../domain/models/tool-scope.js";
import type { FileSystem } from "../../../domain/ports/file-system.js";
import type { FrameworkLoader } from "../../../domain/ports/framework-loader.js";
import type { Hasher } from "../../../domain/ports/hasher.js";
import type { Logger } from "../../../domain/ports/logger.js";
import type { ManifestRepository } from "../../../domain/ports/manifest-repository.js";
import type { Platform } from "../../../domain/ports/platform.js";
import type { Prompter } from "../../../domain/ports/prompter.js";
import type {
  AiTool,
  HasAgents,
  HasCommands,
  HasMemory,
  HasRules,
  HasSkills,
} from "../../../domain/tools/contracts.js";
import {
  getToolConfig,
  type IdeToolId,
  isAiTool,
  isIdeToolId,
  type ToolId,
} from "../../../domain/tools/registry.js";
import { InputRequiredError, NoManifestError } from "../../errors.js";
import {
  type ConfigCapability,
  extractConfigCapabilities,
} from "../install/install-config-use-case.js";
import { filterByIdeRequirements } from "../shared/ide-requirement-filter.js";
import { McpUseCase } from "../shared/mcp-use-case.js";
import { PostInstallPipelineUseCase } from "../shared/post-install-pipeline-use-case.js";
import { ConflictResolutionUseCase } from "../sync/conflict-resolution-use-case.js";
import { UpdateAgentsUseCase } from "./update-agents-use-case.js";
import { UpdateCommandsUseCase } from "./update-commands-use-case.js";
import { UpdateConfigUseCase } from "./update-config-use-case.js";
import { UpdateMemoryBankUseCase } from "./update-memory-bank-use-case.js";
import { UpdateRulesUseCase } from "./update-rules-use-case.js";
import { UpdateSkillsUseCase } from "./update-skills-use-case.js";

interface UpdateOptions {
  frameworkPath: string;
  version: string;
  docsDir?: string;
  projectRoot: string;
  toolIds?: ToolId[];
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

export interface UpdateResult {
  alreadyUpToDate: boolean;
  dryRun: boolean;
  tools: UpdateToolResult[];
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

interface ToolUpdatePrepared {
  readonly toolId: ToolId;
  readonly version: string;
  readonly newDistribution: InstallationFile[];
  readonly newDistMap: Map<string, InstallationFile>;
  readonly diff: FileDiff[];
  readonly entryDiffs: MergeEntryDiff[];
  readonly capabilities: readonly ConfigCapability[];
  readonly configRefs: readonly ConfigRef[];
  readonly newMcpEntries: McpExclusion[];
  readonly manifestFiles: ReadonlyArray<{ relativePath: string; hash: FileHash }>;
}

/** Resolved interactive scope — null means user cancelled */
type InteractiveScopeOutcome =
  | { kind: "scope"; toolIds: ToolId[] | undefined }
  | { kind: "already-applied"; result: UpdateResult }
  | { kind: "cancelled" };

export class UpdateUseCase {
  constructor(
    private readonly fs: FileSystem,
    private readonly manifestRepo: ManifestRepository,
    private readonly loader: FrameworkLoader,
    private readonly hasher: Hasher,
    private readonly logger: Logger,
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
    return (options.interactive ?? false) && !force && !dryRun && options.toolIds === undefined;
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
      { ...options, toolIds: outcome.toolIds, force: true },
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

    if (changedTools.length === 0) {
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
    ];

    const scopeSelection = await this.prompter.select("What to update?", scopeChoices);
    const confirmed = await this.prompter.confirm("Apply update?");

    if (!confirmed) return { kind: "cancelled" };

    const scope = parseUpdateScope(scopeSelection);
    const toolIds = scope.kind === "tool" ? [scope.toolId] : undefined;

    return { kind: "scope", toolIds };
  }

  private resolveIdeContext(manifest: Manifest): IdeToolId[] {
    return manifest.getInstalledToolIds().filter((id): id is IdeToolId => isIdeToolId(id));
  }

  private async executeInternal(
    options: UpdateOptions,
    internal: InternalUpdateOptions
  ): Promise<UpdateResult> {
    const { projectRoot } = options;
    const { dryRun } = internal;

    const { manifest, descriptor, contentFiles, docsDir } = await this.loadFrameworkData(options);

    this.validateToolIds(options.toolIds, manifest);

    const ideContext = this.resolveIdeContext(manifest);
    const effectiveToolIds = this.resolveEffectiveToolIds(options, manifest);
    const toolResults = await this.updateAllTools(
      effectiveToolIds,
      manifest,
      descriptor,
      contentFiles,
      docsDir,
      projectRoot,
      options.version,
      internal,
      ideContext
    );

    if (!dryRun) await this.runPostInstall(options, manifest);

    return this.buildTotals(toolResults, dryRun);
  }

  private async loadFrameworkData(options: UpdateOptions) {
    const { frameworkPath, version, repo } = options;
    const manifest = await this.manifestRepo.load();
    if (manifest === null) throw new NoManifestError(repo);
    const docsDir = options.docsDir ?? manifest.docsDir;
    const { descriptor, contentFiles } = await this.loader.loadFromDirectory(
      frameworkPath,
      version
    );
    return { manifest, descriptor, contentFiles, docsDir };
  }

  private async runPostInstall(options: UpdateOptions, manifest: Manifest): Promise<void> {
    const { projectRoot, docsDir: optDocsDir } = options;
    const docsDir = optDocsDir ?? manifest.docsDir;
    await new PostInstallPipelineUseCase(this.fs, this.manifestRepo).execute({
      projectRoot,
      manifest,
      docsDir,
    });
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

  private resolveEffectiveToolIds(options: UpdateOptions, manifest: Manifest): ToolId[] {
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
    const prepared: ToolUpdatePrepared[] = [];
    for (const toolId of toolIds) {
      this.logger.debug(`Checking ${toolId} for updates...`);
      prepared.push(
        await this.prepareToolUpdate(
          toolId,
          version,
          manifest,
          descriptor,
          contentFiles,
          docsDir,
          projectRoot,
          ideContext
        )
      );
    }

    const allNewEntries = this.aggregateNewMcpEntries(prepared);
    const declinedKeys = internal.dryRun
      ? new Set<string>()
      : await this.promptDeclinedMcp(allNewEntries, internal.interactive);

    const toolResults: UpdateToolResult[] = [];
    for (const data of prepared) {
      toolResults.push(
        await this.finalizeToolResult(data, manifest, projectRoot, internal, declinedKeys)
      );
    }
    return toolResults;
  }

  private async generateDistributionForTool(
    toolId: ToolId,
    descriptor: Awaited<ReturnType<FrameworkLoader["loadFromDirectory"]>>["descriptor"],
    contentFiles: Map<string, string>,
    docsDir: string,
    projectRoot: string
  ): Promise<InstallationFile[]> {
    const config = getToolConfig(toolId);
    if (!isAiTool(config)) {
      const configFiles = await new UpdateConfigUseCase(this.fs, this.hasher).execute({
        capabilities: extractConfigCapabilities(config),
        configRefs: descriptor.configRefs,
        contentFiles,
        projectRoot,
        platform: this.platform,
      });
      return removeRedundantGitkeeps(configFiles);
    }
    return this.generateAiToolDistribution(config, descriptor, contentFiles, docsDir, projectRoot);
  }

  private async generateAiToolDistribution(
    config: AiTool<unknown>,
    descriptor: Awaited<ReturnType<FrameworkLoader["loadFromDirectory"]>>["descriptor"],
    contentFiles: Map<string, string>,
    docsDir: string,
    projectRoot: string
  ): Promise<InstallationFile[]> {
    const sectionFiles = this.generateCapabilitySectionFiles(
      config,
      descriptor,
      contentFiles,
      docsDir
    );
    const configFiles = await new UpdateConfigUseCase(this.fs, this.hasher).execute({
      capabilities: extractConfigCapabilities(config),
      configRefs: descriptor.configRefs,
      contentFiles,
      projectRoot,
      platform: this.platform,
    });
    const memoryFiles = new UpdateMemoryBankUseCase(this.hasher).execute({
      toolConfig: config as AiTool<HasMemory>,
      templateRefs: descriptor.templateRefs,
      contentFiles,
      docsDir,
    });
    return removeRedundantGitkeeps([...sectionFiles, ...configFiles, ...memoryFiles]);
  }

  private generateCapabilitySectionFiles(
    config: AiTool<unknown>,
    descriptor: Awaited<ReturnType<FrameworkLoader["loadFromDirectory"]>>["descriptor"],
    contentFiles: Map<string, string>,
    docsDir: string
  ): InstallationFile[] {
    const results: InstallationFile[] = [];
    const caps = config.capabilities as Record<string, unknown>;
    for (const section of descriptor.contentSections) {
      if (!(section.name in caps)) continue;
      results.push(...this.generateSectionFiles(config, section, contentFiles, docsDir));
    }
    return results;
  }

  private generateSectionFiles(
    config: AiTool<unknown>,
    section: Awaited<
      ReturnType<FrameworkLoader["loadFromDirectory"]>
    >["descriptor"]["contentSections"][number],
    contentFiles: Map<string, string>,
    docsDir: string
  ): InstallationFile[] {
    const base = { section, contentFiles, docsDir };
    switch (section.name) {
      case "agents":
        return new UpdateAgentsUseCase(this.hasher).execute({
          ...base,
          toolConfig: config as AiTool<HasAgents>,
        });
      case "commands":
        return new UpdateCommandsUseCase(this.hasher).execute({
          ...base,
          toolConfig: config as AiTool<HasCommands>,
        });
      case "rules":
        return new UpdateRulesUseCase(this.hasher).execute({
          ...base,
          toolConfig: config as AiTool<HasRules>,
        });
      case "skills":
        return new UpdateSkillsUseCase(this.hasher).execute({
          ...base,
          toolConfig: config as AiTool<HasSkills>,
        });
      default:
        return [];
    }
  }

  private async prepareToolUpdate(
    toolId: ToolId,
    version: string,
    manifest: Manifest,
    descriptor: Awaited<ReturnType<FrameworkLoader["loadFromDirectory"]>>["descriptor"],
    contentFiles: Awaited<ReturnType<FrameworkLoader["loadFromDirectory"]>>["contentFiles"],
    docsDir: string,
    projectRoot: string,
    ideContext: IdeToolId[]
  ): Promise<ToolUpdatePrepared> {
    const config = getToolConfig(toolId);
    const manifestFiles = manifest.getToolFiles(toolId);
    const manifestMap = new Map(manifestFiles.map((f) => [f.relativePath, f.hash]));
    const rawDistribution = await this.generateDistributionForTool(
      toolId,
      descriptor,
      contentFiles,
      docsDir,
      projectRoot
    );
    const newDistribution = filterByIdeRequirements(
      rawDistribution,
      descriptor.configRefs,
      ideContext
    );
    const newDistMap = new Map(newDistribution.map((f) => [f.relativePath, f]));
    const diff = await this.computeDiff(newDistribution, newDistMap, manifestMap, projectRoot);
    const capabilities = extractConfigCapabilities(config);
    const configRefs = descriptor.configRefs;
    const entryDiffs = await this.computeMergeEntryDiff(
      toolId,
      newDistribution,
      manifest,
      capabilities,
      configRefs,
      projectRoot
    );
    const lookup = buildConfigNameLookup(configRefs);
    const getEntrySection = this.buildGetEntrySection(capabilities, lookup);
    const newMcpEntries = detectNewMcpEntries(
      newDistribution,
      getEntrySection,
      manifest.getMergeFiles(toolId),
      manifest.getExcludedMcp(toolId)
    );
    return {
      toolId,
      version,
      newDistribution,
      newDistMap,
      diff,
      entryDiffs,
      capabilities,
      configRefs,
      newMcpEntries,
      manifestFiles,
    };
  }

  private aggregateNewMcpEntries(prepared: ToolUpdatePrepared[]): McpExclusion[] {
    const seen = new Set<string>();
    const result: McpExclusion[] = [];
    for (const p of prepared) {
      for (const entry of p.newMcpEntries) {
        if (!seen.has(entry.entryKey)) {
          seen.add(entry.entryKey);
          result.push(entry);
        }
      }
    }
    return result;
  }

  private async promptDeclinedMcp(
    entries: McpExclusion[],
    interactive: boolean
  ): Promise<Set<string>> {
    const keys = entries.map((e) => e.entryKey);
    const selected = await new McpUseCase(this.prompter).execute({
      keys,
      defaultChecked: true,
      message: "These MCP servers are not yet installed — select which ones to add:",
      interactive,
    });
    return new Set(keys.filter((k) => !selected.has(k)));
  }

  private computeToolExclusions(
    toolId: ToolId,
    manifest: Manifest,
    newMcpEntries: McpExclusion[],
    declinedKeys: Set<string>
  ): McpExclusion[] {
    const declined = newMcpEntries.filter((e) => declinedKeys.has(e.entryKey));
    return [...manifest.getExcludedMcp(toolId), ...declined];
  }

  private async finalizeToolResult(
    data: ToolUpdatePrepared,
    manifest: Manifest,
    projectRoot: string,
    internal: InternalUpdateOptions,
    declinedKeys: Set<string>
  ): Promise<UpdateToolResult> {
    const { dryRun } = internal;
    const applyResult = dryRun
      ? this.emptyApplyDiffResult()
      : await this.applyToolUpdateFromData(data, manifest, projectRoot, internal, declinedKeys);
    const diff = [...data.diff];
    this.appendEntryDiffs(diff, data.entryDiffs);
    return {
      toolId: data.toolId,
      alreadyUpToDate: !diff.some((d) => d.kind !== "unchanged"),
      dryRun,
      diff,
      ...applyResult,
    };
  }

  private async applyToolUpdateFromData(
    data: ToolUpdatePrepared,
    manifest: Manifest,
    projectRoot: string,
    internal: InternalUpdateOptions,
    declinedKeys: Set<string>
  ): Promise<ApplyDiffResult> {
    return this.applyToolUpdate(
      data.toolId,
      data.version,
      manifest,
      data.newDistribution,
      data.newDistMap,
      data.manifestFiles,
      data.diff,
      data.entryDiffs,
      data.capabilities,
      data.configRefs,
      data.newMcpEntries,
      projectRoot,
      internal,
      declinedKeys
    );
  }

  private async applyToolUpdate(
    toolId: ToolId,
    version: string,
    manifest: Manifest,
    newDistribution: InstallationFile[],
    newDistMap: Map<string, InstallationFile>,
    manifestFiles: ReadonlyArray<{ relativePath: string; hash: FileHash }>,
    diff: FileDiff[],
    entryDiffs: MergeEntryDiff[],
    capabilities: readonly ConfigCapability[],
    configRefs: readonly ConfigRef[],
    newMcpEntries: McpExclusion[],
    projectRoot: string,
    internal: InternalUpdateOptions,
    declinedKeys: Set<string>
  ): Promise<ApplyDiffResult> {
    const { force, conflictResolution } = internal;
    const { filtered, exclusions } = await this.applyMcpExclusions(
      toolId,
      manifest,
      newDistribution,
      capabilities,
      configRefs,
      newMcpEntries,
      projectRoot,
      force,
      declinedKeys
    );
    const conflictDecisions = await this.resolveConflicts(diff, force, conflictResolution);
    const result = await this.applyDiff(diff, newDistMap, projectRoot, conflictDecisions, manifest);
    this.warnUserFileConflicts(result.userFileConflicts);
    await this.applySurgicalRemovals(entryDiffs, projectRoot, force, conflictResolution);
    await this.deleteDroppedMergeFiles(
      toolId,
      manifest,
      filtered,
      capabilities,
      configRefs,
      projectRoot
    );
    const mergeFiles = this.buildUpdatedMergeEntries(filtered, capabilities, configRefs);
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
    newDistribution: InstallationFile[],
    capabilities: readonly ConfigCapability[],
    configRefs: readonly ConfigRef[],
    newMcpEntries: McpExclusion[],
    projectRoot: string,
    force: boolean,
    declinedKeys: Set<string>
  ): Promise<{ filtered: InstallationFile[]; exclusions: McpExclusion[] }> {
    if (force) manifest.clearExcludedMcp(toolId);
    const lookup = buildConfigNameLookup(configRefs);
    const getEntrySection = this.buildGetEntrySection(capabilities, lookup);
    const exclusions = this.computeToolExclusions(toolId, manifest, newMcpEntries, declinedKeys);
    const filtered = filterMcpExclusions(newDistribution, getEntrySection, exclusions, this.hasher);
    await this.applyMergeFiles(filtered, projectRoot, capabilities, lookup);
    await this.removeExcludedKeysFromDisk(exclusions, capabilities, lookup, filtered, projectRoot);
    return { filtered, exclusions };
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
    newDistribution: InstallationFile[],
    projectRoot: string,
    capabilities: readonly ConfigCapability[],
    lookup: Map<string, string>
  ): Promise<void> {
    for (const newFile of newDistribution) {
      if (newFile.mergeStrategy === "none") continue;
      await this.applyOneMergeFile(newFile, projectRoot, capabilities, lookup);
    }
  }

  private async applyOneMergeFile(
    newFile: InstallationFile,
    projectRoot: string,
    capabilities: readonly ConfigCapability[],
    lookup: Map<string, string>
  ): Promise<void> {
    const outputPath = join(projectRoot, newFile.relativePath);
    const configName = newFile.frameworkPath ? lookup.get(newFile.frameworkPath) : undefined;
    const capability = configName
      ? capabilities.find((c) => c.consumes.includes(configName))
      : undefined;
    if (
      capability &&
      (capability instanceof McpCapability || capability instanceof HooksCapability)
    ) {
      const existing = (await this.fs.fileExists(outputPath))
        ? await this.fs.readFile(outputPath)
        : "";
      await this.fs.writeFile(outputPath, capability.merge(existing, newFile.content));
      return;
    }
    await this.fs.mergeJsonFile(outputPath, newFile.content, newFile.mergeStrategy);
  }

  private registerToolFiles(
    toolId: ToolId,
    version: string,
    manifest: Manifest,
    newDistribution: InstallationFile[],
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
      .map(
        (f) => new InstallationFile({ relativePath: f.relativePath, content: "", hash: f.hash })
      );
    manifest.addTool(toolId, version, [...nonMergedFinal, ...keptFiles], mergeFiles, exclusions);
  }

  private async computeMergeEntryDiff(
    toolId: ToolId,
    newDistribution: InstallationFile[],
    manifest: Manifest,
    capabilities: readonly ConfigCapability[],
    configRefs: readonly ConfigRef[],
    projectRoot: string
  ): Promise<MergeEntryDiff[]> {
    const configNameLookup = buildConfigNameLookup(configRefs);
    const getEntrySection = this.buildGetEntrySection(capabilities, configNameLookup);
    const diffs: MergeEntryDiff[] = [];
    for (const manifestEntry of manifest.getMergeFiles(toolId)) {
      const diff = await this.diffOneMergeFile(
        manifestEntry,
        newDistribution,
        getEntrySection,
        projectRoot
      );
      if (diff.dropped.length > 0) diffs.push(diff);
    }
    return diffs;
  }

  private async diffOneMergeFile(
    manifestEntry: MergeFileEntry,
    newDistribution: InstallationFile[],
    getEntrySection: (frameworkPath: string) => string | null,
    projectRoot: string
  ): Promise<MergeEntryDiff> {
    const newFile = newDistribution.find(
      (f) => f.relativePath === manifestEntry.relativePath && f.mergeStrategy !== "none"
    );
    const newEntries = this.extractNewEntries(newFile, getEntrySection);
    const dropped = await this.findDroppedEntries(manifestEntry, newEntries, projectRoot);
    return {
      relativePath: manifestEntry.relativePath,
      sectionKey: manifestEntry.sectionKey,
      dropped,
    };
  }

  private extractNewEntries(
    newFile: InstallationFile | undefined,
    getEntrySection: (frameworkPath: string) => string | null
  ): Set<string> {
    if (!newFile) return new Set();
    const sectionKey = newFile.frameworkPath ? getEntrySection(newFile.frameworkPath) : null;
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
    const cleaned = removeEntriesFromJson(content, sectionKey, keysToRemove);
    if (isMergeContentEmpty(cleaned, sectionKey)) {
      await this.fs.deleteFile(fullPath);
      await this.fs.deleteEmptyDirectories(dirname(fullPath));
      return;
    }
    await this.fs.writeFile(fullPath, cleaned);
  }

  private async removeExcludedKeysFromDisk(
    exclusions: readonly McpExclusion[],
    capabilities: readonly ConfigCapability[],
    configNameLookup: Map<string, string>,
    filtered: InstallationFile[],
    projectRoot: string
  ): Promise<void> {
    if (exclusions.length === 0) return;
    const getEntrySection = this.buildGetEntrySection(capabilities, configNameLookup);
    for (const file of filtered) {
      await this.removeExcludedKeysForFile(file, exclusions, getEntrySection, projectRoot);
    }
  }

  private async removeExcludedKeysForFile(
    file: InstallationFile,
    exclusions: readonly McpExclusion[],
    getEntrySection: (frameworkPath: string) => string | null,
    projectRoot: string
  ): Promise<void> {
    if (file.mergeStrategy === "none") return;
    const fileExclusions = exclusions.filter((e) => e.configPath === file.relativePath);
    if (fileExclusions.length === 0) return;
    const sectionKey = file.frameworkPath ? getEntrySection(file.frameworkPath) : null;
    if (sectionKey === null) return;
    await this.removeKeysFromJsonFile(
      join(projectRoot, file.relativePath),
      sectionKey,
      fileExclusions.map((e) => e.entryKey)
    );
  }

  private async deleteDroppedMergeFiles(
    toolId: ToolId,
    manifest: Manifest,
    newDistribution: InstallationFile[],
    capabilities: readonly ConfigCapability[],
    configRefs: readonly ConfigRef[],
    projectRoot: string
  ): Promise<void> {
    const lookup = buildConfigNameLookup(configRefs);
    const getEntrySection = this.buildGetEntrySection(capabilities, lookup);
    const newPaths = new Set(
      buildMergeFileEntries(newDistribution, getEntrySection, this.hasher).map(
        (e) => e.relativePath
      )
    );
    for (const old of manifest.getMergeFiles(toolId)) {
      if (newPaths.has(old.relativePath)) continue;
      const fullPath = join(projectRoot, old.relativePath);
      if (!(await this.fs.fileExists(fullPath))) continue;
      await this.fs.deleteFile(fullPath);
      await this.fs.deleteEmptyDirectories(dirname(fullPath));
    }
  }

  private buildUpdatedMergeEntries(
    newDistribution: InstallationFile[],
    capabilities: readonly ConfigCapability[],
    configRefs: readonly ConfigRef[]
  ): MergeFileEntry[] {
    const lookup = buildConfigNameLookup(configRefs);
    const getEntrySection = this.buildGetEntrySection(capabilities, lookup);
    return buildMergeFileEntries(newDistribution, getEntrySection, this.hasher);
  }

  private buildTotals(toolResults: UpdateToolResult[], dryRun: boolean): UpdateResult {
    const totalWritten = toolResults.reduce((s, t) => s + t.written.length, 0);
    const totalDeleted = toolResults.reduce((s, t) => s + t.deleted.length, 0);
    const toolCount = toolResults.filter((t) => !t.alreadyUpToDate).length;

    const countDiffKind = (kind: string) =>
      toolResults.reduce((s, t) => s + t.diff.filter((d) => d.kind === kind).length, 0);
    const diffSummary = {
      added: countDiffKind("added"),
      changed: countDiffKind("changed"),
      removed: countDiffKind("removed"),
    };

    return {
      alreadyUpToDate: toolResults.every((r) => r.alreadyUpToDate),
      dryRun,
      tools: toolResults,
      totalWritten,
      totalDeleted,
      toolCount,
      diffSummary,
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
    distMap: Map<string, InstallationFile>,
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
        await this.applyAddedEntry(
          entry,
          distMap,
          projectRoot,
          manifest,
          written,
          userFileConflicts
        );
      } else if (entry.kind === "removed") {
        await this.applyRemovedEntry(entry, projectRoot, conflictDecisions, deleted, backedUp);
      } else if (entry.kind === "changed") {
        await this.applyChangedEntry(
          entry,
          distMap,
          projectRoot,
          conflictDecisions,
          kept,
          written,
          backedUp
        );
      }
    }

    return { kept, written, deleted, backedUp, userFileConflicts };
  }

  private async applyAddedEntry(
    entry: FileDiff,
    distMap: Map<string, InstallationFile>,
    projectRoot: string,
    manifest: Manifest,
    written: string[],
    userFileConflicts: string[]
  ): Promise<void> {
    const newFile = distMap.get(entry.relativePath);
    if (!newFile)
      throw new FrameworkResolutionError(`Missing new file in distribution: ${entry.relativePath}`);
    const outputPath = join(projectRoot, entry.relativePath);
    if ((await this.fs.fileExists(outputPath)) && !manifest.isFileTracked(entry.relativePath)) {
      userFileConflicts.push(entry.relativePath);
      return;
    }
    await this.fs.writeFile(outputPath, newFile.content);
    written.push(entry.relativePath);
  }

  private async applyRemovedEntry(
    entry: FileDiff,
    projectRoot: string,
    conflictDecisions: Map<string, ConflictDecision>,
    deleted: string[],
    backedUp: string[]
  ): Promise<void> {
    if (entry.conflict) {
      const decision = conflictDecisions.get(entry.relativePath) ?? "overwrite";
      if (decision === "skip") {
        // User keeps their modified version on disk as an untracked file.
        // Excluded from the new manifest automatically (not in newDistribution).
        return;
      }
      if (decision === "backup") {
        const backupPath = await this.fs.backup(join(projectRoot, entry.relativePath));
        backedUp.push(backupPath.replace(`${projectRoot}/`, ""));
      }
    }
    await this.fs.deleteFile(join(projectRoot, entry.relativePath));
    await this.fs.deleteEmptyDirectories(dirname(join(projectRoot, entry.relativePath)));
    deleted.push(entry.relativePath);
  }

  private async applyChangedEntry(
    entry: FileDiff,
    distMap: Map<string, InstallationFile>,
    projectRoot: string,
    conflictDecisions: Map<string, ConflictDecision>,
    kept: string[],
    written: string[],
    backedUp: string[]
  ): Promise<void> {
    if (entry.conflict) {
      const decision = conflictDecisions.get(entry.relativePath) ?? "overwrite";
      if (decision === "skip") {
        kept.push(entry.relativePath);
        return;
      }
      if (decision === "backup") {
        const backupPath = await this.fs.backup(join(projectRoot, entry.relativePath));
        backedUp.push(backupPath.replace(`${projectRoot}/`, ""));
      }
    }
    const newFile = distMap.get(entry.relativePath);
    if (!newFile)
      throw new FrameworkResolutionError(`Missing new file in distribution: ${entry.relativePath}`);
    await this.fs.writeFile(join(projectRoot, entry.relativePath), newFile.content);
    written.push(entry.relativePath);
  }

  private async computeDiff(
    newDistribution: InstallationFile[],
    newDistMap: Map<string, InstallationFile>,
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
        await this.appendUnchangedOrMissing(newFile, manifestHash, projectRoot, diff);
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

  private async appendUnchangedOrMissing(
    newFile: InstallationFile,
    manifestHash: FileHash,
    projectRoot: string,
    diff: FileDiff[]
  ): Promise<void> {
    const diskPath = join(projectRoot, newFile.relativePath);
    const diskExists = await this.fs.fileExists(diskPath);
    if (!diskExists) {
      diff.push({ relativePath: newFile.relativePath, kind: "changed", conflict: false });
      return;
    }
    const conflict = await this.fs.hasLocalChanges(diskPath, manifestHash);
    diff.push({
      relativePath: newFile.relativePath,
      kind: conflict ? "changed" : "unchanged",
      conflict,
    });
  }

  private buildGetEntrySection(
    capabilities: readonly ConfigCapability[],
    lookup: Map<string, string>
  ): (frameworkPath: string) => string | null {
    return (frameworkPath) => {
      const configName = lookup.get(frameworkPath);
      if (!configName) return null;
      const cap = capabilities.find((c) => c.consumes.includes(configName));
      if (!cap) return null;
      if (cap instanceof McpCapability) return cap.params.entrySection ?? null;
      if (cap instanceof HooksCapability) return cap.getEntrySection();
      return null;
    };
  }
}
