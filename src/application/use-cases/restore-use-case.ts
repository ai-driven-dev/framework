import { join } from "node:path";
import { generateDistribution } from "../../domain/models/distribution.js";
import { buildDocsDistribution } from "../../domain/models/docs-transform.js";
import type { FileHash } from "../../domain/models/file-hash.js";
import { GeneratedFile } from "../../domain/models/generated-file.js";
import type { Manifest } from "../../domain/models/manifest.js";
import { getToolConfig, type ToolId } from "../../domain/models/tool-config.js";
import type { FileSystem } from "../../domain/ports/file-system.js";
import type { FrameworkLoader } from "../../domain/ports/framework-loader.js";
import type { Hasher } from "../../domain/ports/hasher.js";
import type { Logger } from "../../domain/ports/logger.js";
import type { ManifestRepository } from "../../domain/ports/manifest-repository.js";
import type { Prompter } from "../../domain/ports/prompter.js";

interface RestoreOptions {
  frameworkPath: string;
  version: string;
  docsDir: string;
  projectRoot: string;
  toolIds?: ToolId[];
  docsOnly?: boolean;
  files?: string[];
  force?: boolean;
  manifest?: Manifest;
}

interface RestoreToolResult {
  toolId: ToolId;
  nothingToRestore: boolean;
  restored: string[];
  kept: string[];
}

interface RestoreDocsResult {
  nothingToRestore: boolean;
  restored: string[];
  kept: string[];
}

interface RestoreResult {
  tools: RestoreToolResult[];
  docs: RestoreDocsResult | null;
}

interface DriftEntry {
  relativePath: string;
  content: string;
  reason: "deleted" | "modified";
}

interface RestorationResult {
  restored: string[];
  kept: string[];
  updatedHashMap: Map<string, FileHash>;
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
    const docsOnly = options.docsOnly ?? false;
    const fileFilter = buildFileFilter(options.files);

    const manifest = options.manifest ?? (await this.manifestRepo.load());
    if (manifest === null) throw new Error("No AIDD installation found. Run `aidd init` first.");

    const toolIds = docsOnly
      ? []
      : options.toolIds && options.toolIds.length > 0
        ? options.toolIds
        : manifest.getInstalledToolIds();

    const { descriptor, contentFiles, docsFiles } = await this.loader.loadFromDirectory(
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

      const drift = await this.collectDrift(manifestFiles, distMap, projectRoot, fileFilter);

      if (drift.length === 0) {
        toolResults.push({ toolId, nothingToRestore: true, restored: [], kept: [] });
        continue;
      }

      const { restored, kept, updatedHashMap } = await this.applyRestorations(
        drift,
        new Map(manifestFiles.map((f) => [f.relativePath, f.hash])),
        projectRoot,
        force
      );

      manifest.addTool(
        toolId,
        manifest.getToolVersion(toolId) ?? version,
        Array.from(updatedHashMap.entries()).map(
          ([relativePath, hash]) => new GeneratedFile({ relativePath, content: "", hash })
        )
      );

      toolResults.push({ toolId, nothingToRestore: false, restored, kept });
    }

    const hasExplicitToolFilter =
      !docsOnly && options.toolIds !== undefined && options.toolIds.length > 0;
    const docsResult = hasExplicitToolFilter
      ? null
      : await this.restoreDocs(
          manifest,
          docsFiles,
          docsDir,
          projectRoot,
          version,
          force,
          fileFilter
        );

    const hasChanges =
      toolResults.some((t) => t.restored.length > 0) ||
      (docsResult !== null && docsResult.restored.length > 0);

    if (hasChanges) await this.manifestRepo.save(manifest);

    return { tools: toolResults, docs: docsResult };
  }

  private async restoreDocs(
    manifest: Manifest,
    docsFiles: Map<string, string>,
    docsDir: string,
    projectRoot: string,
    version: string,
    force: boolean,
    fileFilter: ((p: string) => boolean) | null
  ): Promise<RestoreDocsResult | null> {
    const docsManifestFiles = manifest.getDocsFiles();
    const filesIncludeDocs =
      fileFilter === null || docsManifestFiles.some((f) => fileFilter(f.relativePath));

    if (!manifest.hasDocs() || !filesIncludeDocs) return null;

    this.logger.info("Checking docs for files to restore...");

    const distribution = buildDocsDistribution(docsFiles, docsDir, this.hasher);
    const distMap = new Map(distribution.map((f) => [f.relativePath, f]));

    const drift = await this.collectDrift(docsManifestFiles, distMap, projectRoot, fileFilter);

    if (drift.length === 0) return { nothingToRestore: true, restored: [], kept: [] };

    const { restored, kept, updatedHashMap } = await this.applyRestorations(
      drift,
      new Map(docsManifestFiles.map((f) => [f.relativePath, f.hash])),
      projectRoot,
      force
    );

    manifest.addDocs(
      manifest.getDocsVersion() ?? version,
      Array.from(updatedHashMap.entries()).map(
        ([relativePath, hash]) => new GeneratedFile({ relativePath, content: "", hash })
      )
    );

    return { nothingToRestore: false, restored, kept };
  }

  private async collectDrift(
    manifestFiles: ReadonlyArray<{ relativePath: string; hash: { value: string } }>,
    distMap: Map<string, GeneratedFile>,
    projectRoot: string,
    fileFilter: ((p: string) => boolean) | null
  ): Promise<DriftEntry[]> {
    const drift: DriftEntry[] = [];

    for (const manifestFile of manifestFiles) {
      if (fileFilter && !fileFilter(manifestFile.relativePath)) continue;

      const diskPath = join(projectRoot, manifestFile.relativePath);
      const diskExists = await this.fs.fileExists(diskPath);

      if (!diskExists) {
        const distFile = distMap.get(manifestFile.relativePath);
        if (distFile)
          drift.push({
            relativePath: manifestFile.relativePath,
            content: distFile.content,
            reason: "deleted",
          });
        continue;
      }

      const diskHash = await this.fs.readFileHash(diskPath);
      if (diskHash.value !== manifestFile.hash.value) {
        const distFile = distMap.get(manifestFile.relativePath);
        if (distFile)
          drift.push({
            relativePath: manifestFile.relativePath,
            content: distFile.content,
            reason: "modified",
          });
      }
    }

    return drift;
  }

  private async applyRestorations(
    drift: DriftEntry[],
    initialHashMap: Map<string, FileHash>,
    projectRoot: string,
    force: boolean
  ): Promise<RestorationResult> {
    const restored: string[] = [];
    const kept: string[] = [];
    const updatedHashMap = new Map(initialHashMap);

    for (const { relativePath, content, reason } of drift) {
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

    return { restored, kept, updatedHashMap };
  }
}

function buildFileFilter(files: string[] | undefined): ((p: string) => boolean) | null {
  if (!files || files.length === 0) return null;
  return (relativePath: string) =>
    files.some((entry) => {
      const basename = entry.split("/").at(-1) ?? entry;
      const isDirectoryPrefix = entry.endsWith("/") || !basename.includes(".");
      if (isDirectoryPrefix) {
        const prefix = entry.endsWith("/") ? entry : `${entry}/`;
        return relativePath.startsWith(prefix);
      }
      return relativePath === entry;
    });
}
