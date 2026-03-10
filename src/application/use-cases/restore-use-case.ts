import { join } from "node:path";
import { generateDistribution } from "../../domain/models/distribution.js";
import { GeneratedFile } from "../../domain/models/generated-file.js";
import type { Manifest } from "../../domain/models/manifest.js";
import { type ToolId, getToolConfig } from "../../domain/models/tool-config.js";
import type { FileSystem } from "../../domain/ports/file-system.js";
import type { FrameworkLoader } from "../../domain/ports/framework-loader.js";
import type { Hasher } from "../../domain/ports/hasher.js";
import type { Logger } from "../../domain/ports/logger.js";
import type { ManifestRepository } from "../../domain/ports/manifest-repository.js";
import type { Prompter } from "../../domain/ports/prompter.js";

export interface RestoreOptions {
  frameworkPath: string;
  version: string;
  docsDir: string;
  projectRoot: string;
  toolIds?: ToolId[];
  files?: string[];
  force?: boolean;
  manifest?: Manifest;
}

export interface RestoreToolResult {
  toolId: ToolId;
  nothingToRestore: boolean;
  restored: string[];
  kept: string[];
  removed: string[];
}

export interface RestoreResult {
  tools: RestoreToolResult[];
}

export class RestoreUseCase {
  constructor(
    private readonly fs: FileSystem,
    private readonly manifestRepo: ManifestRepository,
    private readonly loader: FrameworkLoader,
    private readonly hasher: Hasher,
    private readonly logger: Logger,
    private readonly prompter: Prompter
  ) {}

  async execute(options: RestoreOptions): Promise<RestoreResult> {
    const { frameworkPath, version, docsDir, projectRoot, force = false } = options;
    const fileFilterEntries = options.files && options.files.length > 0 ? options.files : null;
    const fileFilter = fileFilterEntries
      ? (relativePath: string) =>
          fileFilterEntries.some((entry) => {
            const basename = entry.split("/").at(-1) ?? entry;
            const isDirectoryPrefix = entry.endsWith("/") || !basename.includes(".");
            if (isDirectoryPrefix) {
              const prefix = entry.endsWith("/") ? entry : `${entry}/`;
              return relativePath.startsWith(prefix);
            }
            return relativePath === entry;
          })
      : null;

    const manifest = options.manifest ?? (await this.manifestRepo.load());
    if (manifest === null) {
      throw new Error("No AIDD installation found. Run `aidd init` first.");
    }

    const toolIds =
      options.toolIds && options.toolIds.length > 0
        ? options.toolIds
        : manifest.getInstalledToolIds();

    const { descriptor, contentFiles } = await this.loader.loadFromDirectory(
      frameworkPath,
      version
    );

    const toolResults: RestoreToolResult[] = [];

    for (const toolId of toolIds) {
      this.logger.info(`Checking ${toolId} for files to restore...`);

      const config = getToolConfig(toolId);
      const manifestFiles = manifest.getToolFiles(toolId);

      const distribution = generateDistribution(
        descriptor,
        config,
        docsDir,
        contentFiles,
        this.hasher
      );
      const distMap = new Map(distribution.map((f) => [f.relativePath, f]));

      const toRestore: Array<{
        relativePath: string;
        content: string;
        reason: "deleted" | "modified";
      }> = [];

      for (const manifestFile of manifestFiles) {
        if (fileFilter && !fileFilter(manifestFile.relativePath)) continue;

        const diskPath = join(projectRoot, manifestFile.relativePath);
        const diskExists = await this.fs.fileExists(diskPath);

        if (!diskExists) {
          const distFile = distMap.get(manifestFile.relativePath);
          if (distFile) {
            toRestore.push({
              relativePath: manifestFile.relativePath,
              content: distFile.content,
              reason: "deleted",
            });
          }
          continue;
        }

        const diskHash = await this.fs.readFileHash(diskPath);
        if (diskHash.value !== manifestFile.hash.value) {
          const distFile = distMap.get(manifestFile.relativePath);
          if (distFile) {
            toRestore.push({
              relativePath: manifestFile.relativePath,
              content: distFile.content,
              reason: "modified",
            });
          }
        }
      }

      const restored: string[] = [];
      const kept: string[] = [];
      const removed: string[] = [];

      // When no files filter is active, scan tracked directories and remove untracked files.
      if (!fileFilter) {
        const trackedPaths = new Set(manifestFiles.map((f) => f.relativePath));
        const toolDir = join(projectRoot, config.directory);
        const toolDirExists = await this.fs.fileExists(toolDir);
        if (toolDirExists) {
          const diskFiles = await this.fs.listDirectory(toolDir);
          for (const diskRelative of diskFiles) {
            const relativePath = `${config.directory}${diskRelative}`;
            if (!trackedPaths.has(relativePath)) {
              await this.fs.deleteFile(join(projectRoot, relativePath));
              removed.push(relativePath);
            }
          }
        }
      }

      if (toRestore.length === 0 && removed.length === 0) {
        toolResults.push({ toolId, nothingToRestore: true, restored, kept, removed });
        continue;
      }

      // Accumulate hash updates across all files before calling addTool once at the end.
      const updatedHashMap = new Map(manifestFiles.map((f) => [f.relativePath, f.hash]));

      for (const { relativePath, content, reason } of toRestore) {
        if (!force) {
          const decision = await this.prompter.resolveConflict(relativePath, reason);
          if (decision === "keep") {
            kept.push(relativePath);
            continue;
          }
        }
        await this.fs.writeFile(join(projectRoot, relativePath), content);
        const newHash = await this.fs.readFileHash(join(projectRoot, relativePath));
        updatedHashMap.set(relativePath, newHash);
        restored.push(relativePath);
      }

      const updatedFiles = Array.from(updatedHashMap.entries()).map(
        ([relativePath, hash]) => new GeneratedFile({ relativePath, content: "", hash })
      );
      manifest.addTool(toolId, manifest.getToolVersion(toolId) ?? version, updatedFiles);

      toolResults.push({
        toolId,
        nothingToRestore: false,
        restored,
        kept,
        removed,
      });
    }

    const hasChanges = toolResults.some((t) => t.restored.length > 0 || t.removed.length > 0);
    if (hasChanges) {
      await this.manifestRepo.save(manifest);
    }

    return { tools: toolResults };
  }
}
