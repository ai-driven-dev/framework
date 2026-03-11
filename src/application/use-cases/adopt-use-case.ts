import { join } from "node:path";
import { GeneratedFile } from "../../domain/models/generated-file.js";
import { Manifest } from "../../domain/models/manifest.js";
import { type ToolId, VALID_TOOL_IDS, getToolConfig } from "../../domain/models/tool-config.js";
import type { FileSystem } from "../../domain/ports/file-system.js";
import type { Logger } from "../../domain/ports/logger.js";
import type { ManifestRepository } from "../../domain/ports/manifest-repository.js";
import { writeCatalog } from "./catalog-use-case.js";

export interface AdoptOptions {
  toolIds: ToolId[];
  docsDir: string;
  projectRoot: string;
  version: string;
}

export interface AdoptToolResult {
  toolId: ToolId;
  registered: string[];
}

export interface AdoptResult {
  tools: AdoptToolResult[];
  totalRegistered: number;
  docsRegistered: number;
}

export class AdoptUseCase {
  constructor(
    private readonly fs: FileSystem,
    private readonly manifestRepo: ManifestRepository,
    private readonly logger: Logger
  ) {}

  async execute(options: AdoptOptions): Promise<AdoptResult> {
    const { toolIds, docsDir, projectRoot, version } = options;

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

    const manifest = Manifest.create(docsDir);
    const toolResults: AdoptToolResult[] = [];

    for (const toolId of toolIds) {
      this.logger.info(`Adopting ${toolId}...`);
      const config = getToolConfig(toolId);
      const toolDir = join(projectRoot, config.directory);

      if (!(await this.fs.fileExists(toolDir))) {
        throw new Error(`Directory '${config.directory}' not found for tool '${toolId}'.`);
      }

      const registeredFiles = await this.scanAndHashDirectory(
        toolDir,
        config.directory,
        projectRoot
      );
      manifest.addTool(toolId, version, registeredFiles);
      toolResults.push({ toolId, registered: registeredFiles.map((f) => f.relativePath) });
    }

    let docsRegistered = 0;
    const docsAbsDir = join(projectRoot, docsDir);
    if (await this.fs.fileExists(docsAbsDir)) {
      this.logger.info("Adopting docs...");
      const registeredFiles = await this.scanAndHashDirectory(docsAbsDir, docsDir, projectRoot);
      manifest.addDocs(version, registeredFiles);
      docsRegistered = registeredFiles.length;
    }

    await writeCatalog(manifest, docsDir, projectRoot, this.fs);

    const catalogRelPath = `${docsDir}/CATALOG.md`;
    const catalogAbsPath = join(projectRoot, catalogRelPath);
    if (await this.fs.fileExists(catalogAbsPath)) {
      const catalogHash = await this.fs.readFileHash(catalogAbsPath);
      const docsFiles = manifest.getDocsFiles();
      const updatedDocsFiles = docsFiles.map((f) =>
        f.relativePath === catalogRelPath
          ? new GeneratedFile({ relativePath: f.relativePath, content: "", hash: catalogHash })
          : new GeneratedFile({ relativePath: f.relativePath, content: "", hash: f.hash })
      );
      if (!docsFiles.some((f) => f.relativePath === catalogRelPath)) {
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

  private async deleteLegacyConfig(projectRoot: string): Promise<void> {
    const configPath = join(projectRoot, ".aidd", "config.json");
    if (await this.fs.fileExists(configPath)) {
      await this.fs.deleteFile(configPath);
    }
  }

  private async scanAndHashDirectory(
    absoluteDir: string,
    relativePrefix: string,
    projectRoot: string
  ): Promise<GeneratedFile[]> {
    const diskFiles = await this.fs.listDirectory(absoluteDir);
    const separator = relativePrefix.endsWith("/") ? "" : "/";
    const result: GeneratedFile[] = [];

    for (const diskRelative of diskFiles) {
      const relativePath = `${relativePrefix}${separator}${diskRelative}`;
      const absolutePath = join(projectRoot, relativePath);
      const hash = await this.fs.readFileHash(absolutePath);
      // content is intentionally empty: adopt only records hashes, never reads file content
      result.push(new GeneratedFile({ relativePath, content: "", hash }));
    }

    return result;
  }
}
