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
import { CatalogUseCase } from "./catalog-use-case.js";
import { GitignoreUseCase } from "./gitignore-use-case.js";
import { MemoryScriptUseCase } from "./memory-script-use-case.js";

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
    const interactive = options.interactive ?? false;

    const manifest = await this.manifestRepo.load();
    if (manifest === null) {
      throw new NoManifestError(repo);
    }

    const docsDir = options.docsDir ?? manifest.docsDir;

    let toolIds: ToolId[];

    if (options.all) {
      toolIds = [...VALID_TOOL_IDS];
    } else if (options.toolIds !== undefined && options.toolIds.length > 0) {
      toolIds = options.toolIds;
    } else if (interactive && this.prompter !== undefined) {
      const installedIds = manifest.getInstalledToolIds();
      const choices = VALID_TOOL_IDS.map((id) =>
        installedIds.includes(id)
          ? { name: id, value: id, checked: true, disabled: "(already installed)" }
          : { name: id, value: id, checked: false }
      );
      const selected = await this.prompter.checkbox("Which tools do you want to install?", choices);
      if (selected.length === 0) throw new Error("No tools selected.");
      toolIds = selected as ToolId[];
    } else {
      throw new Error(
        `At least one tool ID is required. Valid tools: ${VALID_TOOL_IDS.join(", ")}`
      );
    }

    assertValidToolIds(toolIds);

    const { descriptor, contentFiles } = await this.loader.loadFromDirectory(
      frameworkPath,
      version
    );

    const results: InstallToolResult[] = [];

    for (const toolId of toolIds) {
      if (manifest.hasTool(toolId) && !force) {
        results.push({ toolId, fileCount: 0, files: [], skipped: true, warnings: [] });
        continue;
      }

      const config = getToolConfig(toolId);
      const warnings: string[] = [];

      if (!manifest.hasTool(toolId) && force) {
        const toolDir = join(projectRoot, config.directory);
        if (await this.fs.fileExists(toolDir)) {
          warnings.push(
            `Directory ${config.directory} exists but tool is not in manifest. Files will be overwritten.`
          );
        }
      }

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

      if (manifest.hasTool(toolId)) {
        const newPaths = new Set(generated.map((f) => f.relativePath));
        for (const oldFile of manifest.getToolFiles(toolId)) {
          if (!newPaths.has(oldFile.relativePath)) {
            await this.fs.deleteFile(join(projectRoot, oldFile.relativePath));
          }
        }
      }

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

      results.push({
        toolId,
        fileCount: generated.length,
        files: generated,
        skipped: false,
        warnings,
      });
    }

    await new MemoryScriptUseCase(this.fs, this.hasher, this.git).execute({
      projectRoot,
      version,
      descriptor,
      contentFiles,
      manifest,
    });

    await this.manifestRepo.save(manifest);
    await new CatalogUseCase(this.fs).execute({ manifest, docsDir, projectRoot });
    await new GitignoreUseCase(this.fs).execute(projectRoot, [".aidd/cache/"]);

    return results;
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
