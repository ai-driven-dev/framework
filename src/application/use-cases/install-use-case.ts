import { join } from "node:path";
import { generateDistribution } from "../../domain/models/distribution.js";
import type { ConfigRef } from "../../domain/models/framework-descriptor.js";
import { GeneratedFile } from "../../domain/models/generated-file.js";
import type { Manifest } from "../../domain/models/manifest.js";
import type { McpExclusion } from "../../domain/models/mcp-exclusion.js";
import {
  buildConfigNameLookup,
  buildMergeFileEntries,
  type MergeFileEntry,
  parseEntryKeys,
} from "../../domain/models/merge-entry.js";
import {
  assertValidToolIds,
  type ConfigHandler,
  getToolConfig,
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
import { PostInstallPipelineUseCase } from "./shared/post-install-pipeline-use-case.js";

interface InstallOptions {
  toolIds?: ToolId[];
  all?: boolean;
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
    const toolIds = await this.resolveToolIds(options, manifest);
    assertValidToolIds(toolIds);

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
      options.mcpFilter
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
    mcpFilter?: string[]
  ): Promise<InstallToolResult[]> {
    const results: InstallToolResult[] = [];
    for (const toolId of toolIds) {
      const result = await this.installOneTool(
        toolId,
        manifest,
        descriptor,
        contentFiles,
        docsDir,
        projectRoot,
        force,
        interactive,
        mcpFilter
      );
      results.push(result);
    }
    return results;
  }

  /** Resolves which tool IDs to install from the 4-branch selection logic. */
  private async resolveToolIds(options: InstallOptions, manifest: Manifest): Promise<ToolId[]> {
    const interactive = options.interactive ?? false;

    if (options.all) return [...VALID_TOOL_IDS];
    if (options.toolIds !== undefined && options.toolIds.length > 0) return options.toolIds;
    if (interactive && this.prompter !== undefined) return this.promptToolIds(manifest);

    throw new InputRequiredError(
      `At least one tool ID is required. Valid tools: ${VALID_TOOL_IDS.join(", ")}`
    );
  }

  private async promptToolIds(manifest: Manifest): Promise<ToolId[]> {
    if (this.prompter === undefined)
      throw new InputRequiredError("Prompter is required for interactive mode.");
    const installedIds = manifest.getInstalledToolIds();
    const choices = VALID_TOOL_IDS.map((id) =>
      installedIds.includes(id)
        ? { name: id, value: id, checked: true, disabled: "(already installed)" }
        : { name: id, value: id, checked: false }
    );
    const selected = await this.prompter.checkbox("Which tools do you want to install?", choices);
    if (selected.length === 0) throw new InputRequiredError("No tools selected.");
    return selected as ToolId[];
  }

  /** Installs a single tool and updates the manifest in place. */
  private async installOneTool(
    toolId: ToolId,
    manifest: Manifest,
    descriptor: Awaited<ReturnType<FrameworkLoader["loadFromDirectory"]>>["descriptor"],
    contentFiles: Awaited<ReturnType<FrameworkLoader["loadFromDirectory"]>>["contentFiles"],
    docsDir: string,
    projectRoot: string,
    force: boolean,
    interactive: boolean,
    mcpFilter?: string[]
  ): Promise<InstallToolResult> {
    if (manifest.hasTool(toolId) && !force) {
      return { toolId, fileCount: 0, files: [], skipped: true, warnings: [] };
    }

    const config = getToolConfig(toolId);
    const warnings = await this.checkForceWarning(toolId, config, manifest, projectRoot, force);

    this.logger.info(`Generating ${toolId} distribution...`);

    const generated = await generateDistribution(
      descriptor,
      config,
      docsDir,
      contentFiles,
      this.hasher,
      this.platform,
      projectRoot,
      this.fs
    );

    await this.removeStaleFiles(toolId, manifest, generated, projectRoot);

    const configHandler = config.config();
    const configNameLookup = buildConfigNameLookup(descriptor.configRefs);
    const availableMcp = this.extractAvailableMcpKeys(generated, configHandler, configNameLookup);
    const selectedMcp = await this.resolveMcpSelection(availableMcp, interactive, mcpFilter);
    const filtered = this.applyMcpFilter(generated, configHandler, configNameLookup, selectedMcp);

    const writeResult = await this.writeToolFiles(filtered, projectRoot, manifest);
    for (const relativePath of writeResult.userFileConflicts) {
      warnings.push(
        `\`${relativePath}\` already exists and was not installed by AIDD — skipped to preserve user file`
      );
    }
    const mergeFiles = this.buildMergeEntries(filtered, configHandler, descriptor.configRefs);
    const exclusions = this.computeExclusions(
      generated,
      configHandler,
      configNameLookup,
      selectedMcp
    );
    manifest.addTool(toolId, descriptor.version, writeResult.files, mergeFiles, exclusions);

    return { toolId, fileCount: filtered.length, files: filtered, skipped: false, warnings };
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

  private forEachMcpMergeFile(
    generated: GeneratedFile[],
    configHandler: ConfigHandler,
    configNameLookup: Map<string, string>,
    callback: (file: GeneratedFile, sectionKey: string) => void
  ): void {
    for (const file of generated) {
      if (file.mergeStrategy === "none") continue;
      const configName = file.frameworkPath ? configNameLookup.get(file.frameworkPath) : undefined;
      if (!configName) continue;
      const sectionKey = configHandler.entrySection(configName);
      if (sectionKey === null) continue;
      callback(file, sectionKey);
    }
  }

  private extractAvailableMcpKeys(
    generated: GeneratedFile[],
    configHandler: ConfigHandler,
    configNameLookup: Map<string, string>
  ): Map<string, string[]> {
    const result = new Map<string, string[]>();
    this.forEachMcpMergeFile(generated, configHandler, configNameLookup, (file, sectionKey) => {
      const keys = parseEntryKeys(file.content, sectionKey);
      if (keys.length > 0) result.set(file.relativePath, keys);
    });
    return result;
  }

  private async resolveMcpSelection(
    availableMcp: Map<string, string[]>,
    interactive: boolean,
    mcpFilter?: string[]
  ): Promise<Set<string>> {
    const allKeys = this.collectAllMcpKeys(availableMcp);
    if (allKeys.size === 0) return allKeys;
    if (mcpFilter !== undefined) return this.validateMcpFilter(mcpFilter, allKeys);
    if (interactive && this.prompter !== undefined) return this.promptMcpSelection(allKeys);
    return allKeys;
  }

  private collectAllMcpKeys(availableMcp: Map<string, string[]>): Set<string> {
    const allKeys = new Set<string>();
    for (const keys of availableMcp.values()) {
      for (const key of keys) allKeys.add(key);
    }
    return allKeys;
  }

  private validateMcpFilter(mcpFilter: string[], allKeys: Set<string>): Set<string> {
    const invalid = mcpFilter.filter((k) => !allKeys.has(k));
    if (invalid.length > 0) {
      throw new InputRequiredError(
        `Unknown MCP server(s): ${invalid.join(", ")}. Available: ${[...allKeys].join(", ")}`
      );
    }
    return new Set(mcpFilter);
  }

  private async promptMcpSelection(allKeys: Set<string>): Promise<Set<string>> {
    if (this.prompter === undefined) return allKeys;
    const choices = [...allKeys].map((key) => ({ name: key, value: key, checked: true }));
    const selected = await this.prompter.checkbox(
      "Which MCP servers do you want to install?",
      choices
    );
    return new Set(selected);
  }

  private applyMcpFilter(
    generated: GeneratedFile[],
    configHandler: ConfigHandler,
    configNameLookup: Map<string, string>,
    selectedKeys: Set<string>
  ): GeneratedFile[] {
    const filtered = [...generated];
    this.forEachMcpMergeFile(generated, configHandler, configNameLookup, (file, sectionKey) => {
      const idx = filtered.indexOf(file);
      if (idx !== -1) filtered[idx] = this.filterMergeFileContent(file, sectionKey, selectedKeys);
    });
    return filtered;
  }

  private filterMergeFileContent(
    file: GeneratedFile,
    sectionKey: string,
    selectedKeys: Set<string>
  ): GeneratedFile {
    try {
      const parsed = JSON.parse(file.content) as Record<string, unknown>;
      const section = parsed[sectionKey] as Record<string, unknown> | undefined;
      if (!section || typeof section !== "object") return file;
      const filtered: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(section)) {
        if (selectedKeys.has(key)) filtered[key] = value;
      }
      parsed[sectionKey] = filtered;
      const content = JSON.stringify(parsed, null, 2);
      return new GeneratedFile({
        relativePath: file.relativePath,
        content,
        hash: this.hasher.hash(content),
        mergeStrategy: file.mergeStrategy,
        frameworkPath: file.frameworkPath,
      });
    } catch {
      return file;
    }
  }

  private computeExclusions(
    generated: GeneratedFile[],
    configHandler: ConfigHandler,
    configNameLookup: Map<string, string>,
    selectedKeys: Set<string>
  ): McpExclusion[] {
    const exclusions: McpExclusion[] = [];
    this.forEachMcpMergeFile(generated, configHandler, configNameLookup, (file, sectionKey) => {
      for (const key of parseEntryKeys(file.content, sectionKey)) {
        if (!selectedKeys.has(key)) {
          exclusions.push({ configPath: file.relativePath, entryKey: key });
        }
      }
    });
    return exclusions;
  }
}
