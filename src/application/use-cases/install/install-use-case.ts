import { join } from "node:path";
import { HooksCapability } from "../../../domain/capabilities/hooks-capability.js";
import { McpCapability } from "../../../domain/capabilities/mcp-capability.js";
import { type InstallationFile, removeRedundantGitkeeps } from "../../../domain/models/file.js";
import type { ConfigRef, ContentSection, TemplateRef } from "../../../domain/models/framework.js";
import { FRAMEWORK_CONFIG_PREFIX, FrameworkDescriptor } from "../../../domain/models/framework.js";
import type { Manifest } from "../../../domain/models/manifest.js";
import type { McpExclusion } from "../../../domain/models/mcp-exclusion.js";
import {
  computeMcpExclusions,
  extractMcpKeys,
  filterMcpExclusions,
} from "../../../domain/models/mcp-exclusion.js";
import {
  buildConfigNameLookup,
  buildMergeFileEntries,
  type MergeFileEntry,
  removeEntriesFromJson,
} from "../../../domain/models/merge.js";
import type { PluginCatalogEntry } from "../../../domain/models/plugin-catalog.js";
import type { PluginSource } from "../../../domain/models/plugin-source.js";
import type { AiToolId } from "../../../domain/models/tool-ids.js";
import type { FileSystem } from "../../../domain/ports/file-system.js";
import type { Hasher } from "../../../domain/ports/hasher.js";
import type { Logger } from "../../../domain/ports/logger.js";
import type { ManifestRepository } from "../../../domain/ports/manifest-repository.js";
import type { Platform } from "../../../domain/ports/platform.js";
import type { PluginCatalogRepository } from "../../../domain/ports/plugin-catalog-repository.js";
import type { PluginDistributionReader } from "../../../domain/ports/plugin-distribution-reader.js";
import type { PluginFetcher } from "../../../domain/ports/plugin-fetcher.js";
import type { Prompter } from "../../../domain/ports/prompter.js";
import type {
  AiTool,
  HasAgents,
  HasCommands,
  HasRules,
  HasSkills,
} from "../../../domain/tools/contracts.js";
import {
  AI_TOOL_IDS,
  getToolConfig,
  IDE_TOOL_IDS,
  type IdeToolId,
  isAiTool,
  isIdeToolId,
  type ToolCategory,
  type ToolId,
  VALID_TOOL_IDS,
} from "../../../domain/tools/registry.js";
import { InputRequiredError, NoManifestError } from "../../errors.js";
import { filterByIdeRequirements } from "../shared/ide-requirement-filter.js";
import { McpUseCase } from "../shared/mcp-use-case.js";
import { PostInstallPipelineUseCase } from "../shared/post-install-pipeline-use-case.js";
import { InstallAgentsUseCase } from "./install-agents-use-case.js";
import { InstallCommandsUseCase } from "./install-commands-use-case.js";
import {
  type ConfigCapability,
  extractConfigCapabilities,
  InstallConfigUseCase,
} from "./install-config-use-case.js";
import { InstallPluginsUseCase } from "./install-plugins-use-case.js";
import { InstallRulesUseCase } from "./install-rules-use-case.js";
import { InstallSkillsUseCase } from "./install-skills-use-case.js";

const CONFIG_REFS: readonly ConfigRef[] = [
  { name: "mcp", path: `${FRAMEWORK_CONFIG_PREFIX}mcp.json` },
  { name: "vscodeExtensions", path: `${FRAMEWORK_CONFIG_PREFIX}vscode/extensions.json` },
  { name: "vscodeKeybindings", path: `${FRAMEWORK_CONFIG_PREFIX}vscode/keybindings.json` },
  { name: "vscodeSettings", path: `${FRAMEWORK_CONFIG_PREFIX}vscode/settings.json` },
  {
    name: "copilotVscodeSettings",
    path: `${FRAMEWORK_CONFIG_PREFIX}copilot/settings.json`,
    requiredIdeId: "vscode",
  },
  { name: "opencode", path: `${FRAMEWORK_CONFIG_PREFIX}.opencode/opencode.json` },
];

// No content sections — agents/commands/rules/skills come from plugins.
const EMPTY_CONTENT_SECTIONS: readonly ContentSection[] = [];

const EMPTY_TEMPLATE_REFS: readonly TemplateRef[] = [];

export type PluginMode = "all" | "recommended" | "named" | "none";

interface InstallOptions {
  toolIds?: ToolId[];
  category?: ToolCategory;
  frameworkPath: string;
  version: string;
  docsDir?: string;
  projectRoot: string;
  force?: boolean;
  repo?: string;
  interactive?: boolean;
  mcpFilter?: string[];
  plugins?: PluginSource[];
  pluginMode?: PluginMode;
  pluginNames?: string[];
}

export interface InstallToolResult {
  toolId: ToolId;
  fileCount: number;
  files: InstallationFile[];
  skipped: boolean;
  warnings: string[];
}

interface ToolInstallData {
  readonly toolId: ToolId;
  readonly generated: InstallationFile[];
  readonly config: ReturnType<typeof getToolConfig>;
  readonly capabilities: readonly ConfigCapability[];
  readonly configRefs: readonly ConfigRef[];
}

export class InstallUseCase {
  constructor(
    private readonly fs: FileSystem,
    private readonly manifestRepo: ManifestRepository,
    private readonly hasher: Hasher,
    private readonly logger: Logger,
    private readonly platform: Platform,
    private readonly prompter?: Prompter,
    private readonly pluginFetcher?: PluginFetcher,
    private readonly pluginDistributionReader?: PluginDistributionReader,
    private readonly pluginCatalogRepository?: PluginCatalogRepository
  ) {}

  async execute(options: InstallOptions): Promise<InstallToolResult[]> {
    const { frameworkPath, version, projectRoot, force = false, repo } = options;

    const manifest = await this.manifestRepo.load();
    if (manifest === null) throw new NoManifestError(repo);

    const docsDir = options.docsDir ?? manifest.docsDir;
    let toolIds = await this.resolveToolIds(options, manifest);
    if (toolIds.length === 0) return [];

    toolIds = await this.maybeSuggestRequiredIde(
      toolIds,
      options.interactive ?? false,
      options.category,
      manifest
    );
    const ideContext = this.resolveIdeContext(toolIds, manifest);

    const descriptor = this.buildStaticDescriptor(version);
    const contentFiles = await this.buildContentFiles(frameworkPath);

    const results = await this.installAllTools(
      toolIds,
      manifest,
      descriptor,
      contentFiles,
      docsDir,
      projectRoot,
      force,
      options.interactive ?? false,
      options.mcpFilter ?? [],
      ideContext
    );

    const resolvedPlugins = await this.resolvePluginsForInstall(options, frameworkPath);
    const pluginWarnings = await this.maybeInstallPlugins(
      resolvedPlugins,
      toolIds,
      projectRoot,
      manifest,
      docsDir,
      force
    );
    this.mergePluginWarnings(results, pluginWarnings);

    await new PostInstallPipelineUseCase(this.fs, this.manifestRepo).execute({
      projectRoot,
      manifest,
      docsDir,
    });

    return results;
  }

  private buildStaticDescriptor(version: string): FrameworkDescriptor {
    return new FrameworkDescriptor({
      version,
      contentSections: [...EMPTY_CONTENT_SECTIONS],
      templateRefs: [...EMPTY_TEMPLATE_REFS],
      configRefs: [...CONFIG_REFS],
    });
  }

  private async buildContentFiles(frameworkPath: string): Promise<Map<string, string>> {
    const contentFiles = new Map<string, string>();
    for (const ref of CONFIG_REFS) {
      const filePath = join(frameworkPath, ref.path);
      try {
        const content = await this.fs.readFile(filePath);
        contentFiles.set(ref.path, content);
      } catch {
        // skip missing optional refs
      }
    }
    return contentFiles;
  }

  private mergePluginWarnings(
    results: InstallToolResult[],
    pluginWarnings: Map<ToolId, string[]>
  ): void {
    for (const [toolId, warnings] of pluginWarnings) {
      const result = results.find((r) => r.toolId === toolId);
      if (result) result.warnings.push(...warnings);
    }
  }

  private async resolvePluginsForInstall(
    options: InstallOptions,
    frameworkPath: string
  ): Promise<PluginSource[]> {
    if (options.plugins !== undefined && options.plugins.length > 0) return options.plugins;
    if (this.pluginCatalogRepository === undefined) return [];
    const catalog = await this.pluginCatalogRepository.load(frameworkPath);
    if (catalog === null) return [];
    const { pluginMode, pluginNames, interactive } = options;
    if (!interactive || pluginMode !== undefined) {
      return this.selectPluginsByMode(
        catalog.plugins,
        pluginMode ?? "recommended",
        pluginNames ?? []
      );
    }
    return this.promptPluginSelection(catalog.plugins);
  }

  private selectPluginsByMode(
    entries: readonly PluginCatalogEntry[],
    mode: PluginMode,
    names: string[]
  ): PluginSource[] {
    if (mode === "all") return entries.map((e) => e.source);
    if (mode === "recommended") return entries.filter((e) => e.recommended).map((e) => e.source);
    if (mode === "named") return entries.filter((e) => names.includes(e.name)).map((e) => e.source);
    return [];
  }

  private async promptPluginSelection(
    entries: readonly PluginCatalogEntry[]
  ): Promise<PluginSource[]> {
    if (this.prompter === undefined || entries.length === 0) return [];
    const choices = entries.map((e) => ({
      name: e.description !== undefined ? `${e.name} — ${e.description}` : e.name,
      value: e,
      checked: e.recommended,
    }));
    const selected = await this.prompter.checkbox("Which plugins do you want to install?", choices);
    return selected.map((e) => e.source);
  }

  private async maybeInstallPlugins(
    plugins: PluginSource[],
    toolIds: ToolId[],
    projectRoot: string,
    manifest: Manifest,
    docsDir: string,
    force: boolean
  ): Promise<Map<ToolId, string[]>> {
    if (plugins.length === 0 || !this.pluginFetcher || !this.pluginDistributionReader) {
      return new Map();
    }
    const toolConfigs = toolIds.map((id) => getToolConfig(id));
    return new InstallPluginsUseCase(
      this.fs,
      this.pluginFetcher,
      this.pluginDistributionReader,
      this.hasher
    ).execute({ plugins, toolConfigs, projectRoot, manifest, docsDir, force });
  }

  private async installAllTools(
    toolIds: ToolId[],
    manifest: Manifest,
    descriptor: FrameworkDescriptor,
    contentFiles: Map<string, string>,
    docsDir: string,
    projectRoot: string,
    force: boolean,
    interactive: boolean,
    mcpFilter: string[],
    ideContext: IdeToolId[]
  ): Promise<InstallToolResult[]> {
    const prepared = await this.prepareAllTools(
      toolIds,
      descriptor,
      contentFiles,
      docsDir,
      projectRoot,
      ideContext
    );
    const allKeys = this.aggregateAvailableMcpKeys(prepared);
    const selectedKeys = await this.promptMcpSelection(allKeys, mcpFilter, interactive);
    const results = await this.installPreparedTools(
      prepared,
      manifest,
      descriptor,
      projectRoot,
      force,
      selectedKeys,
      ideContext
    );
    await this.patchAlreadyInstalledAiTools(
      toolIds,
      manifest,
      descriptor,
      contentFiles,
      docsDir,
      projectRoot
    );
    return results;
  }

  private async installPreparedTools(
    prepared: ToolInstallData[],
    manifest: Manifest,
    descriptor: FrameworkDescriptor,
    projectRoot: string,
    force: boolean,
    selectedKeys: Set<string>,
    ideContext: IdeToolId[]
  ): Promise<InstallToolResult[]> {
    const results: InstallToolResult[] = [];
    for (const data of prepared) {
      const result = await this.installOneToolFromData(
        data,
        manifest,
        descriptor,
        projectRoot,
        force,
        selectedKeys,
        ideContext
      );
      results.push(result);
    }
    return results;
  }

  private async prepareAllTools(
    toolIds: ToolId[],
    descriptor: FrameworkDescriptor,
    contentFiles: Map<string, string>,
    docsDir: string,
    projectRoot: string,
    ideContext: IdeToolId[]
  ): Promise<ToolInstallData[]> {
    const result: ToolInstallData[] = [];
    for (const toolId of toolIds) {
      result.push(
        await this.prepareToolInstall(
          toolId,
          descriptor,
          contentFiles,
          docsDir,
          projectRoot,
          ideContext
        )
      );
    }
    return result;
  }

  private async prepareToolInstall(
    toolId: ToolId,
    descriptor: FrameworkDescriptor,
    contentFiles: Map<string, string>,
    docsDir: string,
    projectRoot: string,
    ideContext: IdeToolId[]
  ): Promise<ToolInstallData> {
    const config = getToolConfig(toolId);
    const generated = await this.generateToolFiles(
      config,
      descriptor,
      contentFiles,
      docsDir,
      projectRoot
    );
    const ideFiltered = filterByIdeRequirements(generated, descriptor.configRefs, ideContext);
    return {
      toolId,
      generated: ideFiltered,
      config,
      capabilities: extractConfigCapabilities(config),
      configRefs: descriptor.configRefs,
    };
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

  private aggregateAvailableMcpKeys(data: ToolInstallData[]): Set<string> {
    const keys = new Set<string>();
    for (const d of data) {
      const lookup = buildConfigNameLookup(d.configRefs);
      const getEntrySection = this.buildGetEntrySection(d.capabilities, lookup);
      const mcpMap = extractMcpKeys(d.generated, getEntrySection);
      for (const values of mcpMap.values()) {
        for (const k of values) keys.add(k);
      }
    }
    return keys;
  }

  private async promptMcpSelection(
    allKeys: Set<string>,
    mcpFilter: string[],
    interactive: boolean
  ): Promise<Set<string>> {
    return new McpUseCase(this.prompter).execute({
      keys: [...allKeys],
      defaultChecked: false,
      message: "Which MCP servers do you want to install?",
      mcpFilter: mcpFilter.length > 0 ? mcpFilter : undefined,
      interactive,
    });
  }

  private async installOneToolFromData(
    data: ToolInstallData,
    manifest: Manifest,
    descriptor: FrameworkDescriptor,
    projectRoot: string,
    force: boolean,
    selectedKeys: Set<string>,
    ideContext: IdeToolId[]
  ): Promise<InstallToolResult> {
    const { toolId, generated, config, capabilities, configRefs } = data;
    if (manifest.hasTool(toolId) && !force) {
      return { toolId, fileCount: 0, files: [], skipped: true, warnings: [] };
    }
    const warnings = await this.buildToolWarnings(
      toolId,
      config,
      manifest,
      projectRoot,
      force,
      ideContext
    );
    this.logger.debug(`Generating ${toolId} distribution...`);
    await this.removeStaleFiles(toolId, manifest, generated, projectRoot);
    const { filtered, exclusions } = this.applyMcpFilter(
      generated,
      capabilities,
      configRefs,
      selectedKeys
    );
    await this.maybeClearExcludedMcp(
      force,
      manifest,
      toolId,
      exclusions,
      capabilities,
      descriptor,
      filtered,
      projectRoot
    );
    const lookup = buildConfigNameLookup(configRefs);
    const writeResult = await this.writeToolFiles(
      filtered,
      projectRoot,
      manifest,
      capabilities,
      lookup
    );
    return this.recordInstallation(
      toolId,
      filtered,
      capabilities,
      descriptor,
      writeResult,
      exclusions,
      warnings,
      manifest
    );
  }

  private async buildToolWarnings(
    toolId: ToolId,
    config: ReturnType<typeof getToolConfig>,
    manifest: Manifest,
    projectRoot: string,
    force: boolean,
    ideContext: IdeToolId[]
  ): Promise<string[]> {
    const warnings = await this.checkForceWarning(toolId, config, manifest, projectRoot, force);
    this.appendMissingIdeWarnings(toolId, config, ideContext, warnings);
    this.appendCodexRulesWarning(toolId, warnings);
    return warnings;
  }

  private async maybeClearExcludedMcp(
    force: boolean,
    manifest: Manifest,
    toolId: ToolId,
    exclusions: McpExclusion[],
    capabilities: readonly ConfigCapability[],
    descriptor: FrameworkDescriptor,
    filtered: InstallationFile[],
    projectRoot: string
  ): Promise<void> {
    if (!force || !manifest.hasTool(toolId)) return;
    await this.clearExcludedMcpKeys(
      exclusions,
      capabilities,
      descriptor.configRefs,
      filtered,
      projectRoot
    );
  }

  private async patchAlreadyInstalledAiTools(
    toolIds: ToolId[],
    manifest: Manifest,
    descriptor: FrameworkDescriptor,
    contentFiles: Map<string, string>,
    docsDir: string,
    projectRoot: string
  ): Promise<void> {
    const newIdeIds = toolIds.filter((id): id is IdeToolId => isIdeToolId(id));
    if (newIdeIds.length === 0) return;
    const alreadyInstalledAiIds = manifest
      .getInstalledToolIds()
      .filter(
        (id): id is AiToolId =>
          (AI_TOOL_IDS as readonly string[]).includes(id) && !toolIds.includes(id)
      );
    for (const toolId of alreadyInstalledAiIds) {
      await this.patchIdeAfterInstall(
        toolId,
        newIdeIds,
        manifest,
        descriptor,
        contentFiles,
        docsDir,
        projectRoot
      );
    }
  }

  private async patchIdeAfterInstall(
    toolId: AiToolId,
    newIdeIds: readonly IdeToolId[],
    manifest: Manifest,
    descriptor: FrameworkDescriptor,
    contentFiles: Map<string, string>,
    docsDir: string,
    projectRoot: string
  ): Promise<void> {
    const config = getToolConfig(toolId);
    if (!isAiTool(config)) return;
    if (!config.requiredIdeIds?.some((id) => (newIdeIds as string[]).includes(id))) return;
    const generated = await this.generateAiToolFiles(
      config,
      descriptor,
      contentFiles,
      docsDir,
      projectRoot
    );
    const patchCapabilities = extractConfigCapabilities(config);
    const patchLookup = buildConfigNameLookup(descriptor.configRefs);
    await this.writeIdePatchFiles(generated, projectRoot, manifest, patchCapabilities, patchLookup);
    this.appendIdePatchMergeEntries(
      toolId,
      generated,
      patchCapabilities,
      descriptor.configRefs,
      manifest
    );
  }

  private async writeIdePatchFiles(
    files: InstallationFile[],
    projectRoot: string,
    manifest: Manifest,
    capabilities: readonly ConfigCapability[],
    lookup: Map<string, string>
  ): Promise<void> {
    for (const file of files) {
      const outputPath = join(projectRoot, file.relativePath);
      if (file.mergeStrategy !== "none") {
        await this.writeMergeFile(outputPath, file, capabilities, lookup);
        continue;
      }
      if ((await this.fs.fileExists(outputPath)) && !manifest.isFileTracked(file.relativePath)) {
        continue;
      }
      await this.fs.writeFile(outputPath, file.content);
    }
  }

  private appendIdePatchMergeEntries(
    toolId: AiToolId,
    files: InstallationFile[],
    capabilities: readonly ConfigCapability[],
    configRefs: FrameworkDescriptor["configRefs"],
    manifest: Manifest
  ): void {
    const lookup = buildConfigNameLookup(configRefs);
    const getEntrySection = this.buildGetEntrySection(capabilities, lookup);
    const newEntries = buildMergeFileEntries(files, getEntrySection, this.hasher);
    const existing = manifest.getMergeFiles(toolId);
    const existingPaths = new Set(existing.map((m) => m.relativePath));
    const toAdd = newEntries.filter((m) => !existingPaths.has(m.relativePath));
    if (toAdd.length > 0) {
      manifest.updateToolMergeFiles(toolId, [...existing, ...toAdd] as MergeFileEntry[]);
    }
  }

  private async resolveToolIds(options: InstallOptions, manifest: Manifest): Promise<ToolId[]> {
    const interactive = options.interactive ?? false;

    if (options.toolIds !== undefined && options.toolIds.length > 0) return options.toolIds;
    if (interactive && this.prompter !== undefined)
      return this.promptToolIds(manifest, options.category);

    throw new InputRequiredError(
      `At least one tool ID is required. Valid tools: ${VALID_TOOL_IDS.join(", ")}`
    );
  }

  private async promptToolIds(manifest: Manifest, category?: ToolCategory): Promise<ToolId[]> {
    if (this.prompter === undefined)
      throw new InputRequiredError("Prompter is required for interactive mode.");
    const installedIds = manifest.getInstalledToolIds();
    const aiSelected =
      category === "ide"
        ? []
        : await this.promptCategoryTools(
            "Which AI tools do you want to install?",
            AI_TOOL_IDS,
            installedIds
          );
    const ideSelected =
      category === "ai"
        ? []
        : await this.promptCategoryTools(
            "Which IDE integrations do you want to install?",
            IDE_TOOL_IDS,
            installedIds
          );
    return [...aiSelected, ...ideSelected] as ToolId[];
  }

  private async promptCategoryTools(
    message: string,
    toolIds: readonly string[],
    installedIds: ToolId[]
  ): Promise<string[]> {
    const choices = toolIds.map((id) =>
      installedIds.includes(id as ToolId)
        ? { name: id, value: id, checked: true, disabled: "(already installed)" }
        : { name: id, value: id, checked: false }
    );
    if (!choices.some((c) => !c.disabled)) return [];
    return this.prompter?.checkbox(message, choices) ?? [];
  }

  private resolveIdeContext(toolIds: ToolId[], manifest: Manifest): IdeToolId[] {
    const fromSelected = toolIds.filter((id): id is IdeToolId => isIdeToolId(id));
    const fromManifest = manifest
      .getInstalledToolIds()
      .filter((id): id is IdeToolId => isIdeToolId(id));
    return [...new Set([...fromSelected, ...fromManifest])];
  }

  private async maybeSuggestRequiredIde(
    toolIds: ToolId[],
    interactive: boolean,
    category: ToolCategory | undefined,
    manifest: Manifest
  ): Promise<ToolId[]> {
    if (!interactive || this.prompter === undefined || category === "ai") return toolIds;
    const ideContext = this.resolveIdeContext(toolIds, manifest);
    let result = [...toolIds];
    for (const id of toolIds) {
      const config = getToolConfig(id);
      if (!isAiTool(config) || !config.requiredIdeIds) continue;
      const missing = config.requiredIdeIds.filter(
        (ideId) => !ideContext.includes(ideId) && !result.includes(ideId)
      );
      for (const ideId of missing) {
        const confirmed = await this.prompter.confirm(
          `${id} works best with ${ideId}. Also install the ${ideId} integration?`
        );
        if (confirmed) result = [...result, ideId];
      }
    }
    return result;
  }

  private async generateToolFiles(
    config: ReturnType<typeof getToolConfig>,
    descriptor: FrameworkDescriptor,
    contentFiles: Map<string, string>,
    docsDir: string,
    projectRoot: string
  ): Promise<InstallationFile[]> {
    if (!isAiTool(config)) {
      return new InstallConfigUseCase(this.fs, this.hasher).execute({
        capabilities: extractConfigCapabilities(config),
        configRefs: descriptor.configRefs,
        contentFiles,
        projectRoot,
        platform: this.platform,
      });
    }
    return this.generateAiToolFiles(config, descriptor, contentFiles, docsDir, projectRoot);
  }

  private async generateAiToolFiles(
    config: AiTool<unknown>,
    descriptor: FrameworkDescriptor,
    contentFiles: Map<string, string>,
    docsDir: string,
    projectRoot: string
  ): Promise<InstallationFile[]> {
    const caps = config.capabilities as Record<string, unknown>;
    const sectionFiles = this.generateCapabilitySectionFiles(
      caps,
      config,
      descriptor,
      contentFiles,
      docsDir
    );
    const configFiles = await new InstallConfigUseCase(this.fs, this.hasher).execute({
      capabilities: extractConfigCapabilities(config),
      configRefs: descriptor.configRefs,
      contentFiles,
      projectRoot,
      platform: this.platform,
    });
    return removeRedundantGitkeeps([...sectionFiles, ...configFiles]);
  }

  private generateCapabilitySectionFiles(
    caps: Record<string, unknown>,
    config: AiTool<unknown>,
    descriptor: FrameworkDescriptor,
    contentFiles: Map<string, string>,
    docsDir: string
  ): InstallationFile[] {
    const results: InstallationFile[] = [];
    for (const section of descriptor.contentSections) {
      if (!(section.name in caps)) continue;
      results.push(...this.generateSectionFiles(config, section, contentFiles, docsDir));
    }
    return results;
  }

  private generateSectionFiles(
    config: AiTool<unknown>,
    section: { name: string; directory: string; entryFile: string | null },
    contentFiles: Map<string, string>,
    docsDir: string
  ): InstallationFile[] {
    const base = { section, contentFiles, docsDir };
    switch (section.name) {
      case "agents":
        return new InstallAgentsUseCase(this.hasher).execute({
          ...base,
          toolConfig: config as AiTool<HasAgents>,
        });
      case "commands":
        return new InstallCommandsUseCase(this.hasher).execute({
          ...base,
          toolConfig: config as AiTool<HasCommands>,
        });
      case "rules":
        return new InstallRulesUseCase(this.hasher).execute({
          ...base,
          toolConfig: config as AiTool<HasRules>,
        });
      case "skills":
        return new InstallSkillsUseCase(this.hasher).execute({
          ...base,
          toolConfig: config as AiTool<HasSkills>,
        });
      default:
        return [];
    }
  }

  private applyMcpFilter(
    generated: InstallationFile[],
    capabilities: readonly ConfigCapability[],
    configRefs: readonly ConfigRef[],
    selectedKeys: Set<string>
  ): { filtered: InstallationFile[]; exclusions: McpExclusion[] } {
    const lookup = buildConfigNameLookup(configRefs);
    const getEntrySection = this.buildGetEntrySection(capabilities, lookup);
    const exclusions = computeMcpExclusions(generated, getEntrySection, selectedKeys);
    const filtered = filterMcpExclusions(generated, getEntrySection, exclusions, this.hasher);
    return { filtered, exclusions };
  }

  private recordInstallation(
    toolId: ToolId,
    filtered: InstallationFile[],
    capabilities: readonly ConfigCapability[],
    descriptor: FrameworkDescriptor,
    writeResult: { files: InstallationFile[]; userFileConflicts: string[] },
    exclusions: McpExclusion[],
    warnings: string[],
    manifest: Manifest
  ): InstallToolResult {
    for (const relativePath of writeResult.userFileConflicts) {
      warnings.push(
        `\`${relativePath}\` already exists and was not installed by AIDD — skipped to preserve user file`
      );
    }
    const mergeFiles = this.buildMergeEntries(filtered, capabilities, descriptor.configRefs);
    manifest.addTool(toolId, descriptor.version, writeResult.files, mergeFiles, exclusions);
    return { toolId, fileCount: filtered.length, files: filtered, skipped: false, warnings };
  }

  private async clearExcludedMcpKeys(
    exclusions: McpExclusion[],
    capabilities: readonly ConfigCapability[],
    configRefs: readonly ConfigRef[],
    filtered: InstallationFile[],
    projectRoot: string
  ): Promise<void> {
    if (exclusions.length === 0) return;
    const lookup = buildConfigNameLookup(configRefs);
    for (const file of filtered) {
      await this.clearExcludedMcpKeysForFile(file, exclusions, capabilities, lookup, projectRoot);
    }
  }

  private async clearExcludedMcpKeysForFile(
    file: InstallationFile,
    exclusions: McpExclusion[],
    capabilities: readonly ConfigCapability[],
    lookup: Map<string, string>,
    projectRoot: string
  ): Promise<void> {
    if (file.mergeStrategy === "none") return;
    const fileExclusions = exclusions.filter((e) => e.configPath === file.relativePath);
    if (fileExclusions.length === 0) return;
    const configName = file.frameworkPath ? lookup.get(file.frameworkPath) : undefined;
    if (!configName) return;
    const getEntrySection = this.buildGetEntrySection(capabilities, lookup);
    const sectionKey = file.frameworkPath ? getEntrySection(file.frameworkPath) : null;
    if (sectionKey === null) return;
    const fullPath = join(projectRoot, file.relativePath);
    if (!(await this.fs.fileExists(fullPath))) return;
    const content = await this.fs.readFile(fullPath);
    await this.fs.writeFile(
      fullPath,
      removeEntriesFromJson(
        content,
        sectionKey,
        fileExclusions.map((e) => e.entryKey)
      )
    );
  }

  private async checkForceWarning(
    toolId: ToolId,
    config: ReturnType<typeof getToolConfig>,
    manifest: Manifest,
    projectRoot: string,
    force: boolean
  ): Promise<string[]> {
    const warnings: string[] = [];
    if (!manifest.hasTool(toolId) && force) {
      const toolDir = join(projectRoot, config.directory);
      if (await this.fs.fileExists(toolDir)) {
        warnings.push(
          `Directory ${config.directory} exists but tool is not in manifest. Files will be overwritten.`
        );
      }
    }
    return warnings;
  }

  private appendMissingIdeWarnings(
    toolId: ToolId,
    config: ReturnType<typeof getToolConfig>,
    ideContext: IdeToolId[],
    warnings: string[]
  ): void {
    if (!isAiTool(config) || !config.requiredIdeIds) return;
    const missing = config.requiredIdeIds.filter((id) => !ideContext.includes(id));
    if (missing.length === 0) return;
    warnings.push(
      `${toolId} IDE settings (MCP servers, Chat, extensions) require ${missing.join(", ")} — run \`aidd install ide ${missing.join(" ")}\` to enable them`
    );
  }

  private appendCodexRulesWarning(toolId: ToolId, warnings: string[]): void {
    if (toolId !== "codex") return;
    warnings.push(
      "Codex has no markdown rules equivalent; rules skipped (refs inside commands/skills are expanded with markers at install time)"
    );
  }

  private async removeStaleFiles(
    toolId: ToolId,
    manifest: Manifest,
    generated: InstallationFile[],
    projectRoot: string
  ): Promise<void> {
    if (!manifest.hasTool(toolId)) return;
    const newPaths = new Set(generated.map((f) => f.relativePath));
    for (const oldFile of manifest.getToolFiles(toolId)) {
      if (!newPaths.has(oldFile.relativePath)) {
        await this.fs.deleteFile(join(projectRoot, oldFile.relativePath));
      }
    }
    for (const oldMerge of manifest.getMergeFiles(toolId)) {
      if (!newPaths.has(oldMerge.relativePath)) {
        await this.fs.deleteFile(join(projectRoot, oldMerge.relativePath));
      }
    }
  }

  private async writeToolFiles(
    generated: InstallationFile[],
    projectRoot: string,
    manifest: Manifest,
    capabilities: readonly ConfigCapability[],
    lookup: Map<string, string>
  ): Promise<{ files: InstallationFile[]; userFileConflicts: string[] }> {
    const regularFiles: InstallationFile[] = [];
    const userFileConflicts: string[] = [];
    for (const file of generated) {
      if (file.mergeStrategy !== "none") {
        await this.writeMergeFile(join(projectRoot, file.relativePath), file, capabilities, lookup);
        continue;
      }
      const conflict = await this.detectUserFileConflict(file, projectRoot, manifest);
      if (conflict) {
        userFileConflicts.push(file.relativePath);
        continue;
      }
      await this.fs.writeFile(join(projectRoot, file.relativePath), file.content);
      regularFiles.push(file);
    }
    return { files: regularFiles, userFileConflicts };
  }

  private async writeMergeFile(
    outputPath: string,
    file: InstallationFile,
    capabilities: readonly ConfigCapability[],
    lookup: Map<string, string>
  ): Promise<void> {
    const configName = file.frameworkPath ? lookup.get(file.frameworkPath) : undefined;
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
      await this.fs.writeFile(outputPath, capability.merge(existing, file.content));
      return;
    }
    await this.fs.mergeJsonFile(outputPath, file.content, file.mergeStrategy);
  }

  private async detectUserFileConflict(
    file: InstallationFile,
    projectRoot: string,
    manifest: Manifest
  ): Promise<boolean> {
    const outputPath = join(projectRoot, file.relativePath);
    return (await this.fs.fileExists(outputPath)) && !manifest.isFileTracked(file.relativePath);
  }

  private buildMergeEntries(
    generated: InstallationFile[],
    capabilities: readonly ConfigCapability[],
    configRefs: readonly ConfigRef[]
  ): MergeFileEntry[] {
    const lookup = buildConfigNameLookup(configRefs);
    const getEntrySection = this.buildGetEntrySection(capabilities, lookup);
    return buildMergeFileEntries(generated, getEntrySection, this.hasher);
  }
}
