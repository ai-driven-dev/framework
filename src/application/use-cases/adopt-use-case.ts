import { join } from "node:path";
import { generateDistribution } from "../../domain/models/distribution.js";
import { GeneratedFile } from "../../domain/models/generated-file.js";
import { Manifest } from "../../domain/models/manifest.js";
import { type ToolId, VALID_TOOL_IDS, getToolConfig } from "../../domain/models/tool-config.js";
import type { FileSystem } from "../../domain/ports/file-system.js";
import type { FrameworkLoader } from "../../domain/ports/framework-loader.js";
import type { Hasher } from "../../domain/ports/hasher.js";
import type { Logger } from "../../domain/ports/logger.js";
import type { ManifestRepository } from "../../domain/ports/manifest-repository.js";
import type { Prompter } from "../../domain/ports/prompter.js";
import { writeCatalog } from "./catalog-use-case.js";

export interface AdoptOptions {
  frameworkPath: string;
  version: string;
  docsDir: string;
  projectRoot: string;
  force?: boolean;
}

export interface AdoptToolResult {
  toolId: ToolId;
  written: string[];
  kept: string[];
  backedUp: string[];
  orphans: string[];
}

export interface AdoptResult {
  tools: AdoptToolResult[];
  totalWritten: number;
  totalKept: number;
  totalBackedUp: number;
  orphans: string[];
}

const TOOL_DETECTION_SIGNALS: Record<ToolId, string> = {
  claude: ".claude",
  cursor: ".cursor",
  copilot: ".github/copilot-instructions.md",
};

export class AdoptUseCase {
  constructor(
    private readonly fs: FileSystem,
    private readonly manifestRepo: ManifestRepository,
    private readonly loader: FrameworkLoader,
    private readonly hasher: Hasher,
    private readonly logger: Logger,
    private readonly prompter: Prompter
  ) {}

  async execute(options: AdoptOptions): Promise<AdoptResult> {
    const { frameworkPath, version, docsDir, projectRoot, force = false } = options;

    const existing = await this.manifestRepo.load();
    if (existing !== null) {
      throw new Error("Already initialized. Use `aidd update` to upgrade.");
    }

    const detectedToolIds: ToolId[] = [];
    for (const toolId of VALID_TOOL_IDS) {
      const signal = join(projectRoot, TOOL_DETECTION_SIGNALS[toolId]);
      if (await this.fs.fileExists(signal)) {
        detectedToolIds.push(toolId);
      }
    }

    if (detectedToolIds.length === 0) {
      throw new Error("No AIDD directories found. Run `aidd init` instead.");
    }

    const { descriptor, contentFiles } = await this.loader.loadFromDirectory(
      frameworkPath,
      version
    );

    const manifest = Manifest.create(docsDir);
    const toolResults: AdoptToolResult[] = [];

    for (const toolId of detectedToolIds) {
      this.logger.info(`Adopting ${toolId}...`);

      const config = getToolConfig(toolId);
      const distribution = generateDistribution(
        descriptor,
        config,
        docsDir,
        contentFiles,
        this.hasher
      );

      const written: string[] = [];
      const kept: string[] = [];
      const backedUp: string[] = [];
      const orphans: string[] = [];
      const finalFiles: GeneratedFile[] = [];

      for (const file of distribution) {
        const outputPath = join(projectRoot, file.relativePath);

        if (file.merge) {
          await this.fs.mergeJsonFile(outputPath, file.content);
          const diskHash = await this.fs.readFileHash(outputPath);
          manifest.syncFileHashAcrossTools(file.relativePath, diskHash);
          finalFiles.push(
            new GeneratedFile({
              relativePath: file.relativePath,
              content: "",
              hash: diskHash,
              merge: true,
            })
          );
          continue;
        }

        const exists = await this.fs.fileExists(outputPath);

        if (!exists) {
          await this.fs.writeFile(outputPath, file.content);
          const diskHash = await this.fs.readFileHash(outputPath);
          finalFiles.push(
            new GeneratedFile({ relativePath: file.relativePath, content: "", hash: diskHash })
          );
          written.push(file.relativePath);
        } else if (force) {
          const diskContent = await this.fs.readFile(outputPath);
          await this.fs.writeFile(`${outputPath}.backup`, diskContent);
          backedUp.push(`${file.relativePath}.backup`);
          await this.fs.writeFile(outputPath, file.content);
          const diskHash = await this.fs.readFileHash(outputPath);
          finalFiles.push(
            new GeneratedFile({ relativePath: file.relativePath, content: "", hash: diskHash })
          );
          written.push(file.relativePath);
        } else {
          const decision = await this.prompter.resolveConflict(file.relativePath, "modified");
          if (decision === "keep") {
            const diskHash = await this.fs.readFileHash(outputPath);
            finalFiles.push(
              new GeneratedFile({ relativePath: file.relativePath, content: "", hash: diskHash })
            );
            kept.push(file.relativePath);
          } else {
            const diskContent = await this.fs.readFile(outputPath);
            await this.fs.writeFile(`${outputPath}.backup`, diskContent);
            backedUp.push(`${file.relativePath}.backup`);
            await this.fs.writeFile(outputPath, file.content);
            const diskHash = await this.fs.readFileHash(outputPath);
            finalFiles.push(
              new GeneratedFile({ relativePath: file.relativePath, content: "", hash: diskHash })
            );
            written.push(file.relativePath);
          }
        }
      }

      const toolDir = join(projectRoot, config.directory);
      if (await this.fs.fileExists(toolDir)) {
        const distPaths = new Set(distribution.map((f) => f.relativePath));
        const diskFiles = await this.fs.listDirectory(toolDir);
        for (const diskRelative of diskFiles) {
          const relativePath = `${config.directory}${diskRelative}`;
          if (!distPaths.has(relativePath)) {
            orphans.push(relativePath);
            this.logger.warn(`Orphan file not in framework distribution: ${relativePath}`);
          }
        }
      }

      manifest.addTool(toolId, version, finalFiles);
      toolResults.push({ toolId, written, kept, backedUp, orphans });
    }

    await this.manifestRepo.save(manifest);
    await writeCatalog(manifest, docsDir, projectRoot, this.fs);

    return {
      tools: toolResults,
      totalWritten: toolResults.reduce((sum, r) => sum + r.written.length, 0),
      totalKept: toolResults.reduce((sum, r) => sum + r.kept.length, 0),
      totalBackedUp: toolResults.reduce((sum, r) => sum + r.backedUp.length, 0),
      orphans: toolResults.flatMap((r) => r.orphans),
    };
  }
}
