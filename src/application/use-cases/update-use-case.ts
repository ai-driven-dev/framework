import { join } from "node:path";
import { generateDistribution } from "../../domain/models/distribution.js";
import { buildDocsDistribution } from "../../domain/models/docs-transform.js";
import type { FileHash } from "../../domain/models/file-hash.js";
import { GeneratedFile } from "../../domain/models/generated-file.js";
import type { Manifest } from "../../domain/models/manifest.js";
import { type ToolId, getToolConfig } from "../../domain/models/tool-config.js";
import type { FileSystem } from "../../domain/ports/file-system.js";
import type { FrameworkLoader } from "../../domain/ports/framework-loader.js";
import type { Hasher } from "../../domain/ports/hasher.js";
import type { Logger } from "../../domain/ports/logger.js";
import type { ManifestRepository } from "../../domain/ports/manifest-repository.js";
import type { Prompter } from "../../domain/ports/prompter.js";
import { writeCatalog } from "./catalog-use-case.js";

interface UpdateOptions {
  frameworkPath: string;
  version: string;
  docsDir: string;
  projectRoot: string;
  toolIds?: ToolId[];
  docsOnly?: boolean;
  force?: boolean;
  dryRun?: boolean;
}

type FileDiffKind = "added" | "removed" | "changed" | "unchanged";

interface FileDiff {
  relativePath: string;
  kind: FileDiffKind;
  conflict?: boolean;
}

interface UpdateSectionResult {
  alreadyUpToDate: boolean;
  dryRun: boolean;
  diff: FileDiff[];
  kept: string[];
  written: string[];
  deleted: string[];
  backedUp: string[];
}

interface UpdateToolResult extends UpdateSectionResult {
  toolId: ToolId;
}

type DocsUpdateResult = UpdateSectionResult;

interface UpdateResult {
  alreadyUpToDate: boolean;
  dryRun: boolean;
  tools: UpdateToolResult[];
  docs: DocsUpdateResult | null;
}

interface ApplyDiffResult {
  kept: string[];
  written: string[];
  deleted: string[];
  backedUp: string[];
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
    const docsOnly = options.docsOnly ?? false;

    const manifest = await this.manifestRepo.load();
    if (manifest === null) throw new Error("No AIDD installation found. Run `aidd init` first.");

    const { descriptor, contentFiles, docsFiles } = await this.loader.loadFromDirectory(
      frameworkPath,
      version
    );

    const toolResults: UpdateToolResult[] = [];

    const effectiveToolIds = docsOnly
      ? []
      : options.toolIds && options.toolIds.length > 0
        ? options.toolIds
        : manifest.getInstalledToolIds();

    for (const toolId of effectiveToolIds) {
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

      let result: ApplyDiffResult = { kept: [], written: [], deleted: [], backedUp: [] };

      if (!dryRun) {
        const mergedHashMap = new Map<string, FileHash>();
        for (const newFile of newDistribution) {
          if (!newFile.merge) continue;
          const outputPath = join(projectRoot, newFile.relativePath);
          await this.fs.mergeJsonFile(outputPath, newFile.content);
          const diskHash = await this.fs.readFileHash(outputPath);
          manifest.syncFileHashAcrossTools(newFile.relativePath, diskHash);
          mergedHashMap.set(newFile.relativePath, diskHash);
        }

        result = await this.applyDiff(diff, newDistMap, projectRoot, force);

        const nonMergedFinal = newDistribution
          .filter((f) => !f.merge)
          .filter(
            (f) => !result.deleted.includes(f.relativePath) && !result.kept.includes(f.relativePath)
          );
        const keptFiles = manifestFiles
          .filter((f) => result.kept.includes(f.relativePath))
          .map(
            (f) => new GeneratedFile({ relativePath: f.relativePath, content: "", hash: f.hash })
          );
        const mergedFiles = manifestFiles
          .filter((f) => newDistMap.get(f.relativePath)?.merge === true)
          .map((f) => {
            const hash = mergedHashMap.get(f.relativePath) ?? f.hash;
            return new GeneratedFile({ relativePath: f.relativePath, content: "", hash });
          });

        manifest.addTool(toolId, version, [...nonMergedFinal, ...keptFiles, ...mergedFiles]);
      }

      toolResults.push({
        toolId,
        alreadyUpToDate: !diff.some((d) => d.kind !== "unchanged"),
        dryRun,
        diff,
        ...result,
      });
    }

    const hasExplicitToolFilter =
      !docsOnly && options.toolIds !== undefined && options.toolIds.length > 0;
    const docsResult = hasExplicitToolFilter
      ? null
      : await this.updateDocs(manifest, docsFiles, docsDir, projectRoot, version, force, dryRun);

    if (!dryRun) {
      await this.manifestRepo.save(manifest);
      await writeCatalog(manifest, docsDir, projectRoot, this.fs);
    }

    return {
      alreadyUpToDate:
        toolResults.every((r) => r.alreadyUpToDate) &&
        (docsResult === null || docsResult.alreadyUpToDate),
      dryRun,
      tools: toolResults,
      docs: docsResult,
    };
  }

  private async updateDocs(
    manifest: Manifest,
    docsFiles: Map<string, string>,
    docsDir: string,
    projectRoot: string,
    version: string,
    force: boolean,
    dryRun: boolean
  ): Promise<DocsUpdateResult | null> {
    if (!manifest.hasDocs()) return null;

    this.logger.info("Checking docs for updates...");

    const newDistribution = buildDocsDistribution(docsFiles, docsDir, this.hasher);
    const newDistMap = new Map(newDistribution.map((f) => [f.relativePath, f]));
    const manifestFiles = manifest.getDocsFiles();
    const manifestMap = new Map(manifestFiles.map((f) => [f.relativePath, f.hash]));
    const diff = await this.computeDiff(newDistribution, newDistMap, manifestMap, projectRoot);

    let result: ApplyDiffResult = { kept: [], written: [], deleted: [], backedUp: [] };

    if (!dryRun) {
      result = await this.applyDiff(diff, newDistMap, projectRoot, force);

      const finalFiles = newDistribution.filter(
        (f) => !result.deleted.includes(f.relativePath) && !result.kept.includes(f.relativePath)
      );
      const keptFiles = manifestFiles
        .filter((f) => result.kept.includes(f.relativePath))
        .map((f) => new GeneratedFile({ relativePath: f.relativePath, content: "", hash: f.hash }));
      manifest.addDocs(version, [...finalFiles, ...keptFiles]);
    }

    return {
      alreadyUpToDate: !diff.some((d) => d.kind !== "unchanged"),
      dryRun,
      diff,
      ...result,
    };
  }

  private async applyDiff(
    diff: FileDiff[],
    distMap: Map<string, GeneratedFile>,
    projectRoot: string,
    force: boolean
  ): Promise<ApplyDiffResult> {
    const kept: string[] = [];
    const written: string[] = [];
    const deleted: string[] = [];
    const backedUp: string[] = [];

    for (const entry of diff) {
      if (entry.kind === "added") {
        const newFile = distMap.get(entry.relativePath);
        if (!newFile) throw new Error(`Missing new file in distribution: ${entry.relativePath}`);
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
          await this.fs.writeFile(`${diskPath}.backup`, await this.fs.readFile(diskPath));
          backedUp.push(`${entry.relativePath}.backup`);
        }
        const newFile = distMap.get(entry.relativePath);
        if (!newFile) throw new Error(`Missing new file in distribution: ${entry.relativePath}`);
        await this.fs.writeFile(join(projectRoot, entry.relativePath), newFile.content);
        written.push(entry.relativePath);
      }
    }

    return { kept, written, deleted, backedUp };
  }

  private async computeDiff(
    newDistribution: GeneratedFile[],
    newDistMap: Map<string, GeneratedFile>,
    manifestMap: Map<string, { value: string }>,
    projectRoot: string
  ): Promise<FileDiff[]> {
    const diff: FileDiff[] = [];

    for (const newFile of newDistribution) {
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
        const diskPath = join(projectRoot, newFile.relativePath);
        const diskExists = await this.fs.fileExists(diskPath);
        if (!diskExists) {
          diff.push({ relativePath: newFile.relativePath, kind: "changed", conflict: false });
        } else {
          const diskHash = await this.fs.readFileHash(diskPath);
          if (diskHash.value !== manifestHash.value) {
            diff.push({ relativePath: newFile.relativePath, kind: "changed", conflict: true });
          } else {
            diff.push({ relativePath: newFile.relativePath, kind: "unchanged" });
          }
        }
      }
    }

    for (const [relativePath] of manifestMap) {
      if (!newDistMap.has(relativePath)) diff.push({ relativePath, kind: "removed" });
    }

    return diff;
  }
}
