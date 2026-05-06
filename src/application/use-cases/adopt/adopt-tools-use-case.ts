import { join, relative, sep } from "node:path";
import { InstallationFile } from "../../../domain/models/file.js";
import type { Manifest } from "../../../domain/models/manifest.js";
import type { FileSystem } from "../../../domain/ports/file-system.js";
import type { Logger } from "../../../domain/ports/logger.js";
import { getToolConfig, type ToolId } from "../../../domain/tools/registry.js";

interface AdoptToolsOptions {
  toolIds: ToolId[];
  manifest: Manifest;
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
    private readonly logger: Logger
  ) {}

  async execute(options: AdoptToolsOptions): Promise<AdoptToolResult[]> {
    const { toolIds, manifest, projectRoot, version } = options;
    const results: AdoptToolResult[] = [];
    for (const toolId of toolIds) {
      const result = await this.adoptOne(toolId, manifest, projectRoot, version);
      if (result !== null) results.push(result);
    }
    return results;
  }

  private async adoptOne(
    toolId: ToolId,
    manifest: Manifest,
    projectRoot: string,
    version: string
  ): Promise<AdoptToolResult | null> {
    this.logger.info(`Adopting ${toolId}...`);
    const config = getToolConfig(toolId);
    const toolDir = join(projectRoot, config.directory);
    const dirExists = await this.fs.fileExists(toolDir);
    if (!dirExists) {
      this.logger.warn(
        `Directory '${config.directory}' not found for tool '${toolId}'. ` +
          `Run \`aidd install ${toolId}\` to install the tool from scratch.`
      );
      return null;
    }
    const files = await this.collectAllFiles(toolDir, projectRoot);
    if (files.length === 0) {
      this.logger.warn(`No files found for '${toolId}' in '${config.directory}'.`);
    }
    manifest.addTool(toolId, version, files);
    return { toolId, registered: files.map((f) => f.relativePath) };
  }

  private async collectAllFiles(toolDir: string, projectRoot: string): Promise<InstallationFile[]> {
    const absolutePaths = await this.fs.listFilesRecursive(toolDir);
    const files: InstallationFile[] = [];
    for (const absolutePath of absolutePaths) {
      const relativePath = relative(projectRoot, absolutePath).split(sep).join("/");
      const hash = await this.fs.readFileHash(absolutePath);
      files.push(new InstallationFile({ relativePath, content: "", hash }));
    }
    return files;
  }
}
