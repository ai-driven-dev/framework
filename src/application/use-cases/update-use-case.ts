import { join } from "node:path";
import { generateDistribution } from "../../domain/models/distribution.js";
import { GeneratedFile } from "../../domain/models/generated-file.js";
import { type ToolId, getToolConfig } from "../../domain/models/tool-config.js";
import type { FileSystem } from "../../domain/ports/file-system.js";
import type { FrameworkLoader } from "../../domain/ports/framework-loader.js";
import type { Hasher } from "../../domain/ports/hasher.js";
import type { Logger } from "../../domain/ports/logger.js";
import type { ManifestRepository } from "../../domain/ports/manifest-repository.js";
import type { Prompter } from "../../domain/ports/prompter.js";
import { writeCatalog } from "./catalog-use-case.js";

export interface UpdateOptions {
  frameworkPath: string;
  version: string;
  docsDir: string;
  projectRoot: string;
  force?: boolean;
  dryRun?: boolean;
}

export type FileDiffKind = "added" | "removed" | "changed" | "unchanged";

export interface FileDiff {
  relativePath: string;
  kind: FileDiffKind;
  conflict?: boolean;
}

export interface UpdateToolResult {
  toolId: ToolId;
  alreadyUpToDate: boolean;
  dryRun: boolean;
  diff: FileDiff[];
  kept: string[];
  written: string[];
  deleted: string[];
  backedUp: string[];
}

export interface UpdateResult {
  alreadyUpToDate: boolean;
  dryRun: boolean;
  tools: UpdateToolResult[];
}

export class UpdateUseCase {
  constructor(
    private readonly fs: FileSystem,
    private readonly manifestRepo: ManifestRepository,
    private readonly loader: FrameworkLoader,
    private readonly hasher: Hasher,
    private readonly logger: Logger,
    private readonly prompter: Prompter
  ) {}

  async execute(options: UpdateOptions): Promise<UpdateResult> {
    const { frameworkPath, version, docsDir, projectRoot, force = false, dryRun = false } = options;

    const manifest = await this.manifestRepo.load();
    if (manifest === null) {
      throw new Error("No AIDD installation found. Run `aidd init` first.");
    }

    const { descriptor, contentFiles } = await this.loader.loadFromDirectory(
      frameworkPath,
      version
    );

    const installedToolIds = manifest.getInstalledToolIds();
    const toolResults: UpdateToolResult[] = [];

    for (const toolId of installedToolIds) {
      this.logger.info(`Checking ${toolId} for updates...`);

      const config = getToolConfig(toolId);
      const manifestFiles = manifest.getToolFiles(toolId);
      const manifestMap = new Map(manifestFiles.map((f) => [f.relativePath, f.hash]));

      const newDistribution = generateDistribution(
        descriptor,
        config,
        docsDir,
        contentFiles,
        this.hasher
      );
      const newDistMap = new Map(newDistribution.map((f) => [f.relativePath, f]));

      const diff = await this.computeDiff(newDistribution, newDistMap, manifestMap, projectRoot);

      const kept: string[] = [];
      const written: string[] = [];
      const deleted: string[] = [];
      const backedUp: string[] = [];

      if (!dryRun) {
        // Always re-apply merged files silently
        for (const newFile of newDistribution) {
          if (!newFile.merge) continue;
          const outputPath = join(projectRoot, newFile.relativePath);
          await this.fs.mergeJsonFile(outputPath, newFile.content);
          const diskHash = await this.fs.readFileHash(outputPath);
          manifest.syncFileHashAcrossTools(newFile.relativePath, diskHash);
        }

        for (const entry of diff) {
          if (entry.kind === "added") {
            const newFile = newDistMap.get(entry.relativePath);
            if (!newFile)
              throw new Error(`Missing new file in distribution: ${entry.relativePath}`);
            await this.fs.writeFile(join(projectRoot, entry.relativePath), newFile.content);
            written.push(entry.relativePath);
          } else if (entry.kind === "removed") {
            await this.fs.deleteFile(join(projectRoot, entry.relativePath));
            deleted.push(entry.relativePath);
          } else if (entry.kind === "changed") {
            if (entry.conflict && !force) {
              const decision = await this.prompter.resolveConflict(entry.relativePath, "modified");
              if (decision === "keep") {
                kept.push(entry.relativePath);
                continue;
              }
            }
            if (entry.conflict) {
              const diskPath = join(projectRoot, entry.relativePath);
              const diskContent = await this.fs.readFile(diskPath);
              await this.fs.writeFile(`${diskPath}.backup`, diskContent);
              backedUp.push(`${entry.relativePath}.backup`);
            }
            const newFile = newDistMap.get(entry.relativePath);
            if (!newFile)
              throw new Error(`Missing new file in distribution: ${entry.relativePath}`);
            await this.fs.writeFile(join(projectRoot, entry.relativePath), newFile.content);
            written.push(entry.relativePath);
          }
        }

        // Build final manifest file list from new distribution (non-merged) + kept files
        const nonMergedFinal = newDistribution
          .filter((f) => !f.merge)
          .filter((f) => !deleted.includes(f.relativePath) && !kept.includes(f.relativePath));

        const keptFiles = manifestFiles
          .filter((f) => kept.includes(f.relativePath))
          .map(
            (f) => new GeneratedFile({ relativePath: f.relativePath, content: "", hash: f.hash })
          );

        // Merged files are already updated in manifest via syncFileHashAcrossTools;
        // re-add them from the manifest to preserve their updated hashes.
        const mergedFiles = manifestFiles
          .filter((f) => newDistMap.get(f.relativePath)?.merge === true)
          .map(
            (f) => new GeneratedFile({ relativePath: f.relativePath, content: "", hash: f.hash })
          );

        manifest.addTool(toolId, version, [...nonMergedFinal, ...keptFiles, ...mergedFiles]);
      }

      const hasChanges = diff.some((d) => d.kind !== "unchanged");

      toolResults.push({
        toolId,
        alreadyUpToDate: !hasChanges,
        dryRun,
        diff,
        kept,
        written,
        deleted,
        backedUp,
      });
    }

    if (!dryRun) {
      await this.manifestRepo.save(manifest);
      await writeCatalog(manifest, docsDir, projectRoot, this.fs);
    }

    const allUpToDate = toolResults.every((r) => r.alreadyUpToDate);

    return {
      alreadyUpToDate: allUpToDate,
      dryRun,
      tools: toolResults,
    };
  }

  private async computeDiff(
    newDistribution: GeneratedFile[],
    newDistMap: Map<string, GeneratedFile>,
    manifestMap: Map<string, { value: string }>,
    projectRoot: string
  ): Promise<FileDiff[]> {
    const diff: FileDiff[] = [];

    for (const newFile of newDistribution) {
      // Merged files (e.g. vscode settings) are always silently re-applied;
      // their manifest hash is post-merge and can't be compared to raw content hash.
      if (newFile.merge) continue;

      const manifestHash = manifestMap.get(newFile.relativePath);
      if (manifestHash === undefined) {
        diff.push({ relativePath: newFile.relativePath, kind: "added" });
      } else if (newFile.hash.value !== manifestHash.value) {
        const diskPath = join(projectRoot, newFile.relativePath);
        const diskExists = await this.fs.fileExists(diskPath);
        let conflict = false;
        if (diskExists) {
          const diskHash = await this.fs.readFileHash(diskPath);
          conflict = diskHash.value !== manifestHash.value;
        }
        diff.push({ relativePath: newFile.relativePath, kind: "changed", conflict });
      } else {
        diff.push({ relativePath: newFile.relativePath, kind: "unchanged" });
      }
    }

    for (const [relativePath] of manifestMap) {
      if (!newDistMap.has(relativePath)) {
        diff.push({ relativePath, kind: "removed" });
      }
    }

    return diff;
  }
}
