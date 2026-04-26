import { join } from "node:path";
import { InstallationFile } from "../../../domain/models/file.js";
import type { Manifest } from "../../../domain/models/manifest.js";
import type { FileSystem } from "../../../domain/ports/file-system.js";
import type { FrameworkLoader } from "../../../domain/ports/framework-loader.js";
import type { Hasher } from "../../../domain/ports/hasher.js";
import type { Logger } from "../../../domain/ports/logger.js";
import type { Platform } from "../../../domain/ports/platform.js";
import { getToolConfig, type ToolId } from "../../../domain/tools/registry.js";
import { GenerateToolDistributionUseCase } from "../shared/generate-tool-distribution-use-case.js";

type FrameworkData = Awaited<ReturnType<FrameworkLoader["loadFromDirectory"]>>;

interface AdoptToolsOptions {
  toolIds: ToolId[];
  manifest: Manifest;
  descriptor: FrameworkData["descriptor"];
  contentFiles: FrameworkData["contentFiles"];
  docsDir: string;
  projectRoot: string;
  version: string;
}

export interface AdoptToolResult {
  toolId: ToolId;
  registered: string[];
}

export class AdoptToolsUseCase {
  constructor(
    private readonly fs: FileSystem,
    private readonly hasher: Hasher,
    private readonly logger: Logger,
    private readonly platform: Platform
  ) {}

  async execute(options: AdoptToolsOptions): Promise<AdoptToolResult[]> {
    const { toolIds, manifest, descriptor, contentFiles, docsDir, projectRoot, version } = options;
    const toolResults: AdoptToolResult[] = [];
    for (const toolId of toolIds) {
      this.logger.info(`Adopting ${toolId}...`);
      const config = getToolConfig(toolId);
      const toolDir = join(projectRoot, config.directory);

      if (!(await this.fs.fileExists(toolDir))) {
        this.logger.warn(
          `Directory '${config.directory}' not found for tool '${toolId}'. ` +
            `Run \`aidd install ${toolId}\` to install the tool from scratch.`
        );
        continue;
      }

      const distribution = await new GenerateToolDistributionUseCase(
        this.fs,
        this.hasher,
        this.platform
      ).execute({ config, descriptor, contentFiles, docsDir, projectRoot });
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

  private async matchDistributionToDisk(
    distribution: InstallationFile[],
    projectRoot: string
  ): Promise<InstallationFile[]> {
    const result: InstallationFile[] = [];
    for (const distFile of distribution) {
      const absolutePath = join(projectRoot, distFile.relativePath);
      if (!(await this.fs.fileExists(absolutePath))) continue;
      const hash = await this.fs.readFileHash(absolutePath);
      result.push(
        new InstallationFile({
          relativePath: distFile.relativePath,
          content: "",
          hash,
          frameworkPath: distFile.frameworkPath,
        })
      );
    }
    return result;
  }
}
