import { join } from "node:path";
import { generateForConfig } from "../../domain/models/distribution.js";
import type { ConfigRef, FrameworkDescriptor } from "../../domain/models/framework-descriptor.js";
import type { GeneratedFile } from "../../domain/models/generated-file.js";
import { filterByIdeRequirements } from "../../domain/models/ide-requirement-filter.js";
import type { Manifest } from "../../domain/models/manifest.js";
import {
  computeMcpExclusions,
  extractMcpKeys,
  filterMcpExclusions,
} from "../../domain/models/mcp.js";
import type { McpExclusion } from "../../domain/models/mcp-exclusion.js";
import type { MergeFileEntry } from "../../domain/models/merge-entry.js";
import {
  buildConfigNameLookup,
  buildMergeFileEntries,
  removeEntriesFromJson,
} from "../../domain/models/merge-entry.js";
import {
  AI_TOOL_IDS,
  type AiToolId,
  type ConfigHandler,
  getToolConfig,
  IDE_TOOL_IDS,
  type IdeToolId,
  isAiToolConfig,
  isIdeToolId,
  type ToolCategory,
  type ToolId,
  VALID_TOOL_IDS,
} from "../../domain/models/tool-config.js";
import type { FileSystem } from "../../domain/ports/file-system.js";
import type { FrameworkLoader } from "../../domain/ports/framework-loader.js";
import type { Git } from "../../domain/ports/git.js";
import type { Hasher } from "../../domain/ports/hasher.js";
import type { Logger } from "../../domain/ports/logger.js";
import type { ManifestRepository } from "../../domain/ports/manifest-repository.js";
import type { Platform } from "../../domain/ports/platform.js";
import type { Prompter } from "../../domain/ports/prompter.js";
import { InputRequiredError, NoManifestError } from "../errors.js";
import { McpUseCase } from "./shared/mcp-use-case.js";
import { PostInstallPipelineUseCase } from "./shared/post-install-pipeline-use-case.js";

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
}

export interface InstallToolResult {
  toolId: ToolId;
  fileCount: number;
  files: GeneratedFile[];
  skipped: boolean;
  warnings: string[];
}

interface ToolInstallData {
  readonly toolId: ToolId;
  readonly generated: GeneratedFile[];
  readonly config: ReturnType<typeof getToolConfig>;
  readonly configHandler: ConfigHandler;
  readonly configRefs: readonly ConfigRef[];
}

export class InstallUseCase {
  constructor(
    private readonly fs: FileSystem,
    private readonly manifestRepo: ManifestRepository,
    private readonly loader: FrameworkLoader,
    private readonly hasher: Hasher,
    private readonly logger: Logger,
    private readonly git: Git,
    private readonly platform: Platform,
    private readonly prompter?: Prompter
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

    const { descriptor, contentFiles } = await this.loader.loadFromDirectory(
      frameworkPath,
      version
    );
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

    await new PostInstallPipelineUseCase(
      this.fs,
      this.manifestRepo,
      this.hasher,
      this.git,
      this.prompter
    ).execute({ projectRoot, version, descriptor, contentFiles, manifest, docsDir });

    return results;
  }

  private async installAllTools(
    toolIds: ToolId[],
    manifest: Manifest,
    descriptor: Awaited<ReturnType<FrameworkLoader["loadFromDirectory"]>>["descriptor"],
    contentFiles: Awaited<ReturnType<FrameworkLoader["loadFromDirectory"]>>["contentFiles"],
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

  private async prepareAllTools(
    toolIds: ToolId[],
    descriptor: Awaited<ReturnType<FrameworkLoader["loadFromDirectory"]>>["descriptor"],
    contentFiles: Awaited<ReturnType<FrameworkLoader["loadFromDirectory"]>>["contentFiles"],
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
    descriptor: Awaited<ReturnType<FrameworkLoader["loadFromDirectory"]>>["descriptor"],
    contentFiles: Awaited<ReturnType<FrameworkLoader["loadFromDirectory"]>>["contentFiles"],
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
      configHandler: config.config(),
      configRefs: descriptor.configRefs,
    };
  }

  private aggregateAvailableMcpKeys(data: ToolInstallData[]): Set<string> {
    const keys = new Set<string>();
    for (const d of data) {
      const configNameLookup = buildConfigNameLookup(d.configRefs);
      const mcpMap = extractMcpKeys(d.generated, d.configHandler, configNameLookup);
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
    descriptor: Awaited<ReturnType<FrameworkLoader["loadFromDirectory"]>>["descriptor"],
    projectRoot: string,
    force: boolean,
    selectedKeys: Set<string>,
    ideContext: IdeToolId[]
  ): Promise<InstallToolResult> {
    const { toolId, generated, config, configHandler, configRefs } = data;
    if (manifest.hasTool(toolId) && !force) {
      return { toolId, fileCount: 0, files: [], skipped: true, warnings: [] };
    }
    const warnings = await this.checkForceWarning(toolId, config, manifest, projectRoot, force);
    this.appendMissingIdeWarnings(toolId, config, ideContext, warnings);
    this.logger.info(`Generating ${toolId} distribution...`);
    await this.removeStaleFiles(toolId, manifest, generated, projectRoot);
    const { filtered, exclusions } = this.applyMcpFilter(
      generated,
      configHandler,
      configRefs,
      selectedKeys
    );
    if (force && manifest.hasTool(toolId)) {
      await this.clearExcludedMcpKeys(
        exclusions,
        configHandler,
        descriptor.configRefs,
        filtered,
        projectRoot
      );
    }
    const writeResult = await this.writeToolFiles(filtered, projectRoot, manifest);
    return this.recordInstallation(
      toolId,
      filtered,
      configHandler,
      descriptor,
      writeResult,
      exclusions,
      warnings,
      manifest
    );
  }

  private async patchAlreadyInstalledAiTools(
    toolIds: ToolId[],
    manifest: Manifest,
    descriptor: Awaited<ReturnType<FrameworkLoader["loadFromDirectory"]>>["descriptor"],
    contentFiles: Awaited<ReturnType<FrameworkLoader["loadFromDirectory"]>>["contentFiles"],
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
    if (!isAiToolConfig(config)) return;
    if (!config.requiredIdeIds?.some((id) => (newIdeIds as string[]).includes(id))) return;
    const generated = await generateForConfig(
      config,
      descriptor,
      docsDir,
      contentFiles,
      this.hasher,
      this.platform,
      projectRoot,
      this.fs
    );
    await this.writeIdePatchFiles(generated, projectRoot, manifest);
    this.appendIdePatchMergeEntries(
      toolId,
      generated,
      config.config(),
      descriptor.configRefs,
      manifest
    );
  }

  private async writeIdePatchFiles(
    files: GeneratedFile[],
    projectRoot: string,
    manifest: Manifest
  ): Promise<void> {
    for (const file of files) {
      const outputPath = join(projectRoot, file.relativePath);
      if (file.mergeStrategy !== "none") {
        await this.fs.mergeJsonFile(outputPath, file.content, file.mergeStrategy);
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
    files: GeneratedFile[],
    configHandler: ConfigHandler,
    configRefs: FrameworkDescriptor["configRefs"],
    manifest: Manifest
  ): void {
    const newEntries = buildMergeFileEntries(
      files,
      configHandler,
      buildConfigNameLookup(configRefs),
      this.hasher
    );
    const existing = manifest.getMergeFiles(toolId);
    const existingPaths = new Set(existing.map((m) => m.relativePath));
    const toAdd = newEntries.filter((m) => !existingPaths.has(m.relativePath));
    if (toAdd.length > 0) {
      manifest.updateToolMergeFiles(toolId, [...existing, ...toAdd] as MergeFileEntry[]);
    }
  }

  /** Resolves which tool IDs to install. Command layer handles --all expansion; this handles interactive prompt and guard. */
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
      if (!isAiToolConfig(config) || !config.requiredIdeIds) continue;
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
    descriptor: Awaited<ReturnType<FrameworkLoader["loadFromDirectory"]>>["descriptor"],
    contentFiles: Awaited<ReturnType<FrameworkLoader["loadFromDirectory"]>>["contentFiles"],
    docsDir: string,
    projectRoot: string
  ): Promise<GeneratedFile[]> {
    return generateForConfig(
      config,
      descriptor,
      docsDir,
      contentFiles,
      this.hasher,
      this.platform,
      projectRoot,
      this.fs
    );
  }

  private applyMcpFilter(
    generated: GeneratedFile[],
    configHandler: ConfigHandler,
    configRefs: readonly ConfigRef[],
    selectedKeys: Set<string>
  ): { filtered: GeneratedFile[]; exclusions: McpExclusion[] } {
    const configNameLookup = buildConfigNameLookup(configRefs);
    const exclusions = computeMcpExclusions(
      generated,
      configHandler,
      configNameLookup,
      selectedKeys
    );
    const filtered = filterMcpExclusions(
      generated,
      configHandler,
      configNameLookup,
      exclusions,
      this.hasher
    );
    return { filtered, exclusions };
  }

  private recordInstallation(
    toolId: ToolId,
    filtered: GeneratedFile[],
    configHandler: ConfigHandler,
    descriptor: Awaited<ReturnType<FrameworkLoader["loadFromDirectory"]>>["descriptor"],
    writeResult: { files: GeneratedFile[]; userFileConflicts: string[] },
    exclusions: McpExclusion[],
    warnings: string[],
    manifest: Manifest
  ): InstallToolResult {
    for (const relativePath of writeResult.userFileConflicts) {
      warnings.push(
        `\`${relativePath}\` already exists and was not installed by AIDD — skipped to preserve user file`
      );
    }
    const mergeFiles = this.buildMergeEntries(filtered, configHandler, descriptor.configRefs);
    manifest.addTool(toolId, descriptor.version, writeResult.files, mergeFiles, exclusions);
    return { toolId, fileCount: filtered.length, files: filtered, skipped: false, warnings };
  }

  private async clearExcludedMcpKeys(
    exclusions: McpExclusion[],
    configHandler: ConfigHandler,
    configRefs: readonly ConfigRef[],
    filtered: GeneratedFile[],
    projectRoot: string
  ): Promise<void> {
    if (exclusions.length === 0) return;
    const lookup = buildConfigNameLookup(configRefs);
    for (const file of filtered) {
      await this.clearExcludedMcpKeysForFile(file, exclusions, configHandler, lookup, projectRoot);
    }
  }

  private async clearExcludedMcpKeysForFile(
    file: GeneratedFile,
    exclusions: McpExclusion[],
    configHandler: ConfigHandler,
    lookup: Map<string, string>,
    projectRoot: string
  ): Promise<void> {
    if (file.mergeStrategy === "none") return;
    const fileExclusions = exclusions.filter((e) => e.configPath === file.relativePath);
    if (fileExclusions.length === 0) return;
    const configName = file.frameworkPath ? lookup.get(file.frameworkPath) : undefined;
    if (!configName) return;
    const sectionKey = configHandler.entrySection(configName);
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
    if (!isAiToolConfig(config) || !config.requiredIdeIds) return;
    const missing = config.requiredIdeIds.filter((id) => !ideContext.includes(id));
    if (missing.length === 0) return;
    warnings.push(
      `${toolId} IDE settings (MCP servers, Chat, extensions) require ${missing.join(", ")} — run \`aidd install ide ${missing.join(" ")}\` to enable them`
    );
  }

  private async removeStaleFiles(
    toolId: ToolId,
    manifest: Manifest,
    generated: GeneratedFile[],
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
    generated: GeneratedFile[],
    projectRoot: string,
    manifest: Manifest
  ): Promise<{ files: GeneratedFile[]; userFileConflicts: string[] }> {
    const regularFiles: GeneratedFile[] = [];
    const userFileConflicts: string[] = [];
    for (const file of generated) {
      if (file.mergeStrategy !== "none") {
        await this.fs.mergeJsonFile(
          join(projectRoot, file.relativePath),
          file.content,
          file.mergeStrategy
        );
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

  private async detectUserFileConflict(
    file: GeneratedFile,
    projectRoot: string,
    manifest: Manifest
  ): Promise<boolean> {
    const outputPath = join(projectRoot, file.relativePath);
    return (await this.fs.fileExists(outputPath)) && !manifest.isFileTracked(file.relativePath);
  }

  private buildMergeEntries(
    generated: GeneratedFile[],
    configHandler: ConfigHandler,
    configRefs: readonly ConfigRef[]
  ): MergeFileEntry[] {
    return buildMergeFileEntries(
      generated,
      configHandler,
      buildConfigNameLookup(configRefs),
      this.hasher
    );
  }
}
