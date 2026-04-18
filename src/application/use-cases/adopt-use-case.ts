import { join } from "node:path";
import { FrameworkResolutionError, ToolValidationError } from "../../domain/errors.js";
import {
  generateConfigDistribution,
  generateDistribution,
} from "../../domain/models/distribution.js";
import { buildDocsDistribution } from "../../domain/models/docs.js";
import { GeneratedFile } from "../../domain/models/generated-file.js";
import { Manifest } from "../../domain/models/manifest.js";
import {
  getToolConfig,
  isAiToolConfig,
  type ToolId,
  VALID_TOOL_IDS,
} from "../../domain/models/tool-config.js";
import type { FileSystem } from "../../domain/ports/file-system.js";
import type { FrameworkLoader } from "../../domain/ports/framework-loader.js";
import type { Hasher } from "../../domain/ports/hasher.js";
import type { Logger } from "../../domain/ports/logger.js";
import type { ManifestRepository } from "../../domain/ports/manifest-repository.js";
import type { Platform } from "../../domain/ports/platform.js";
import { AlreadyInitializedError, InputRequiredError } from "../errors.js";
import { CatalogUseCase } from "./catalog-use-case.js";
import { GitignoreUseCase } from "./gitignore-use-case.js";

interface AdoptOptions {
  toolIds: ToolId[];
  frameworkPath: string;
  docsDir: string;
  projectRoot: string;
  version: string;
}

interface AdoptToolResult {
  toolId: ToolId;
  registered: string[];
}

interface AdoptResult {
  tools: AdoptToolResult[];
  totalRegistered: number;
  docsRegistered: number;
}

export class AdoptUseCase {
  constructor(
    private readonly fs: FileSystem,
    private readonly manifestRepo: ManifestRepository,
    private readonly loader: FrameworkLoader,
    private readonly hasher: Hasher,
    private readonly logger: Logger,
    private readonly platform: Platform
  ) {}

  async execute(options: AdoptOptions): Promise<AdoptResult> {
    const { toolIds, frameworkPath, docsDir, projectRoot, version } = options;

    this.validateToolIds(toolIds);
    const existing = await this.manifestRepo.load();
    if (existing !== null) throw new AlreadyInitializedError();
    await this.deleteLegacyConfig(projectRoot);

    const { descriptor, contentFiles, docsFiles } = await this.loader.loadFromDirectory(
      frameworkPath,
      version
    );
    const manifest = Manifest.create(docsDir);
    const toolResults = await this.registerAllTools(
      toolIds,
      manifest,
      descriptor,
      contentFiles,
      docsDir,
      projectRoot,
      version
    );
    const docsRegistered = await this.registerDocs(
      manifest,
      docsFiles,
      docsDir,
      projectRoot,
      version
    );
    await this.persistAdopt(manifest, docsDir, projectRoot, version);
    return {
      tools: toolResults,
      totalRegistered: toolResults.reduce((sum, r) => sum + r.registered.length, 0),
      docsRegistered,
    };
  }

  /** Finalizes catalog, saves manifest, and writes gitignore entry. */
  private async persistAdopt(
    manifest: Manifest,
    docsDir: string,
    projectRoot: string,
    version: string
  ): Promise<void> {
    await this.finalizeCatalog(manifest, docsDir, projectRoot, version);
    await this.manifestRepo.save(manifest);
    // AdoptUseCase calls gitignore directly (not via PostInstallPipelineUseCase).
    // MemoryScriptUseCase is intentionally absent: adopt only registers existing files,
    // no tool content is generated so there is no memory bank to write.
    await new GitignoreUseCase(this.fs).execute(projectRoot, [".aidd/cache/"]);
  }

  private validateToolIds(toolIds: ToolId[]): void {
    const invalid = toolIds.filter((t) => !VALID_TOOL_IDS.includes(t));
    if (invalid.length > 0) {
      throw new ToolValidationError(
        `Unknown tool(s): ${invalid.join(", ")}. Valid tools: ${VALID_TOOL_IDS.join(", ")}`
      );
    }
    if (toolIds.length === 0) {
      throw new InputRequiredError("No tools specified. Use --tools to specify at least one tool.");
    }
  }

  private async registerAllTools(
    toolIds: ToolId[],
    manifest: Manifest,
    descriptor: Awaited<ReturnType<FrameworkLoader["loadFromDirectory"]>>["descriptor"],
    contentFiles: Awaited<ReturnType<FrameworkLoader["loadFromDirectory"]>>["contentFiles"],
    docsDir: string,
    projectRoot: string,
    version: string
  ): Promise<AdoptToolResult[]> {
    const toolResults: AdoptToolResult[] = [];
    for (const toolId of toolIds) {
      this.logger.info(`Adopting ${toolId}...`);
      const config = getToolConfig(toolId);
      const toolDir = join(projectRoot, config.directory);

      if (!(await this.fs.fileExists(toolDir))) {
        throw new FrameworkResolutionError(
          `Directory '${config.directory}' not found for tool '${toolId}'.`
        );
      }

      const distribution = isAiToolConfig(config)
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
      const registeredFiles = await this.matchDistributionToDisk(distribution, projectRoot);
      if (registeredFiles.length === 0) {
        this.logger.warn(
          `No recognized framework files found for '${toolId}' in '${config.directory}'. ` +
            `Run \`aidd install ${toolId}\` to install the tool from scratch.`
        );
      }
      manifest.addTool(toolId, version, registeredFiles);
      toolResults.push({ toolId, registered: registeredFiles.map((f) => f.relativePath) });
    }
    return toolResults;
  }

  private async registerDocs(
    manifest: Manifest,
    docsFiles: Map<string, string>,
    docsDir: string,
    projectRoot: string,
    version: string
  ): Promise<number> {
    const docsAbsDir = join(projectRoot, docsDir);
    if (!(await this.fs.fileExists(docsAbsDir))) return 0;

    this.logger.info("Adopting docs...");
    const docsDistribution = buildDocsDistribution(docsFiles, docsDir, this.hasher);
    const registeredFiles = await this.matchDistributionToDisk(docsDistribution, projectRoot);
    manifest.addDocs(version, registeredFiles);
    return registeredFiles.length;
  }

  private async finalizeCatalog(
    manifest: Manifest,
    docsDir: string,
    projectRoot: string,
    version: string
  ): Promise<void> {
    await new CatalogUseCase(this.fs).execute({ manifest, docsDir, projectRoot });

    const catalogRelPath = `${docsDir}/CATALOG.md`;
    const catalogAbsPath = join(projectRoot, catalogRelPath);
    if (!(await this.fs.fileExists(catalogAbsPath))) return;

    const catalogHash = await this.fs.readFileHash(catalogAbsPath);
    const currentDocsFiles = manifest.getDocsFiles();
    const updatedDocsFiles = currentDocsFiles.map((f) =>
      f.relativePath === catalogRelPath
        ? new GeneratedFile({ relativePath: f.relativePath, content: "", hash: catalogHash })
        : new GeneratedFile({ relativePath: f.relativePath, content: "", hash: f.hash })
    );
    if (!currentDocsFiles.some((f) => f.relativePath === catalogRelPath)) {
      updatedDocsFiles.push(
        new GeneratedFile({ relativePath: catalogRelPath, content: "", hash: catalogHash })
      );
    }
    manifest.addDocs(manifest.getDocsVersion() ?? version, updatedDocsFiles);
  }

  private async matchDistributionToDisk(
    distribution: GeneratedFile[],
    projectRoot: string
  ): Promise<GeneratedFile[]> {
    const result: GeneratedFile[] = [];
    for (const distFile of distribution) {
      const absolutePath = join(projectRoot, distFile.relativePath);
      if (!(await this.fs.fileExists(absolutePath))) continue;
      const hash = await this.fs.readFileHash(absolutePath);
      result.push(
        new GeneratedFile({
          relativePath: distFile.relativePath,
          content: "",
          hash,
          frameworkPath: distFile.frameworkPath,
        })
      );
    }
    return result;
  }

  private async deleteLegacyConfig(projectRoot: string): Promise<void> {
    const configPath = join(projectRoot, ".aidd", "config.json");
    if (await this.fs.fileExists(configPath)) {
      await this.fs.deleteFile(configPath);
    }
  }
}
