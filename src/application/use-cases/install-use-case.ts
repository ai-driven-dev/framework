import { join } from "node:path";
import { generateDistribution } from "../../domain/models/distribution.js";
import { GeneratedFile } from "../../domain/models/generated-file.js";
import type { Manifest } from "../../domain/models/manifest.js";
import {
  assertValidToolIds,
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
import { NoManifestError } from "../errors.js";
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
      force
    );

    await new PostInstallPipelineUseCase(this.fs, this.manifestRepo, this.hasher, this.git).execute(
      { projectRoot, version, descriptor, contentFiles, manifest, docsDir }
    );

    return results;
  }

  private async installAllTools(
    toolIds: ToolId[],
    manifest: Manifest,
    descriptor: Awaited<ReturnType<FrameworkLoader["loadFromDirectory"]>>["descriptor"],
    contentFiles: Awaited<ReturnType<FrameworkLoader["loadFromDirectory"]>>["contentFiles"],
    docsDir: string,
    projectRoot: string,
    force: boolean
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
        force
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

    throw new Error(`At least one tool ID is required. Valid tools: ${VALID_TOOL_IDS.join(", ")}`);
  }

  private async promptToolIds(manifest: Manifest): Promise<ToolId[]> {
    if (this.prompter === undefined) throw new Error("Prompter is required for interactive mode.");
    const installedIds = manifest.getInstalledToolIds();
    const choices = VALID_TOOL_IDS.map((id) =>
      installedIds.includes(id)
        ? { name: id, value: id, checked: true, disabled: "(already installed)" }
        : { name: id, value: id, checked: false }
    );
    const selected = await this.prompter.checkbox("Which tools do you want to install?", choices);
    if (selected.length === 0) throw new Error("No tools selected.");
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
    force: boolean
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

    const { files: finalFiles, userFileConflicts } = await this.writeToolFiles(
      generated,
      projectRoot,
      manifest
    );
    for (const relativePath of userFileConflicts) {
      warnings.push(
        `\`${relativePath}\` already exists and was not installed by AIDD — skipped to preserve user file`
      );
    }
    manifest.addTool(toolId, descriptor.version, finalFiles);

    return { toolId, fileCount: generated.length, files: generated, skipped: false, warnings };
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
  }

  private async writeToolFiles(
    generated: GeneratedFile[],
    projectRoot: string,
    manifest: Manifest
  ): Promise<{ files: GeneratedFile[]; userFileConflicts: string[] }> {
    const filesByPath = new Map<string, GeneratedFile>();
    const userFileConflicts: string[] = [];
    for (const file of generated) {
      const outputPath = join(projectRoot, file.relativePath);
      if (file.merge) {
        await this.fs.mergeJsonFile(outputPath, file.content);
        const diskHash = await this.fs.readFileHash(outputPath);
        manifest.syncFileHashAcrossTools(file.relativePath, diskHash);
        filesByPath.set(
          file.relativePath,
          new GeneratedFile({
            relativePath: file.relativePath,
            content: file.content,
            hash: diskHash,
            merge: true,
          })
        );
      } else {
        if ((await this.fs.fileExists(outputPath)) && !manifest.isFileTracked(file.relativePath)) {
          userFileConflicts.push(file.relativePath);
          continue;
        }
        await this.fs.writeFile(outputPath, file.content);
        filesByPath.set(file.relativePath, file);
      }
    }
    return { files: [...filesByPath.values()], userFileConflicts };
  }
}
