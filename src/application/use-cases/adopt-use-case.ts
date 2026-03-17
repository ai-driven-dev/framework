import { join } from "node:path";
import { generateDistribution } from "../../domain/models/distribution.js";
import { buildDocsDistribution } from "../../domain/models/docs.js";
import { GeneratedFile } from "../../domain/models/generated-file.js";
import { Manifest } from "../../domain/models/manifest.js";
import { getToolConfig, type ToolId, VALID_TOOL_IDS } from "../../domain/models/tool-config.js";
import type { FileSystem } from "../../domain/ports/file-system.js";
import type { FrameworkLoader } from "../../domain/ports/framework-loader.js";
import type { Hasher } from "../../domain/ports/hasher.js";
import type { Logger } from "../../domain/ports/logger.js";
import type { ManifestRepository } from "../../domain/ports/manifest-repository.js";
import type { Platform } from "../../domain/ports/platform.js";
import { CatalogUseCase } from "./catalog-use-case.js";

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

    const invalid = toolIds.filter((t) => !VALID_TOOL_IDS.includes(t));
    if (invalid.length > 0) {
      throw new Error(
        `Unknown tool(s): ${invalid.join(", ")}. Valid tools: ${VALID_TOOL_IDS.join(", ")}`
      );
    }

    if (toolIds.length === 0) {
      throw new Error("No tools specified. Use --tools to specify at least one tool.");
    }

    const existing = await this.manifestRepo.load();
    if (existing !== null) {
      throw new Error("Already initialized. Use `aidd update` to upgrade.");
    }

    await this.deleteLegacyConfig(projectRoot);

    const { descriptor, contentFiles, docsFiles } = await this.loader.loadFromDirectory(
      frameworkPath,
      version
    );

    const manifest = Manifest.create(docsDir);
    const toolResults: AdoptToolResult[] = [];

    for (const toolId of toolIds) {
      this.logger.info(`Adopting ${toolId}...`);
      const config = getToolConfig(toolId);
      const toolDir = join(projectRoot, config.directory);

      if (!(await this.fs.fileExists(toolDir))) {
        throw new Error(`Directory '${config.directory}' not found for tool '${toolId}'.`);
      }

      const distribution = generateDistribution(
        descriptor,
        config,
        docsDir,
        contentFiles,
        this.hasher,
        this.platform
      );
      const registeredFiles = await this.matchDistributionToDisk(distribution, projectRoot);
      manifest.addTool(toolId, version, registeredFiles);
      toolResults.push({ toolId, registered: registeredFiles.map((f) => f.relativePath) });
    }

    let docsRegistered = 0;
    const docsAbsDir = join(projectRoot, docsDir);
    if (await this.fs.fileExists(docsAbsDir)) {
      this.logger.info("Adopting docs...");
      const docsDistribution = buildDocsDistribution(docsFiles, docsDir, this.hasher);
      const registeredFiles = await this.matchDistributionToDisk(docsDistribution, projectRoot);
      manifest.addDocs(version, registeredFiles);
      docsRegistered = registeredFiles.length;
    }

    await new CatalogUseCase(this.fs).execute({ manifest, docsDir, projectRoot });

    const catalogRelPath = `${docsDir}/CATALOG.md`;
    const catalogAbsPath = join(projectRoot, catalogRelPath);
    if (await this.fs.fileExists(catalogAbsPath)) {
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

    await this.manifestRepo.save(manifest);

    return {
      tools: toolResults,
      totalRegistered: toolResults.reduce((sum, r) => sum + r.registered.length, 0),
      docsRegistered,
    };
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
