import { join } from "node:path";
import type { FileHash } from "../../domain/models/file-hash.js";
import { getToolConfig, type ToolId } from "../../domain/models/tool-config.js";
import type { FileSystem } from "../../domain/ports/file-system.js";
import type { Logger } from "../../domain/ports/logger.js";
import type { ManifestRepository } from "../../domain/ports/manifest-repository.js";
import { NoManifestError } from "../errors.js";

type FileStatusKind = "modified" | "deleted" | "added";

interface FileDrift {
  relativePath: string;
  status: FileStatusKind;
}

interface ToolStatus {
  toolId: ToolId;
  version: string;
  drifted: FileDrift[];
}

interface DocsStatus {
  version: string;
  drifted: FileDrift[];
}

interface StatusReport {
  tools: ToolStatus[];
  docs: DocsStatus | null;
  inSync: boolean;
}

interface StatusOptions {
  projectRoot: string;
  filterToolId?: ToolId;
  filterDocs?: boolean;
  repo?: string;
}

export class StatusUseCase {
  constructor(
    private readonly fs: FileSystem,
    private readonly manifestRepo: ManifestRepository,
    readonly _logger: Logger
  ) {}

  async execute(options: StatusOptions): Promise<StatusReport> {
    const { projectRoot, filterToolId, filterDocs, repo } = options;

    const manifest = await this.manifestRepo.load();
    if (manifest === null) {
      throw new NoManifestError(repo);
    }

    if (filterToolId && !manifest.hasTool(filterToolId)) {
      throw new Error(`${filterToolId} is not installed`);
    }

    const installedToolIds = filterDocs
      ? []
      : filterToolId
        ? [filterToolId]
        : manifest.getInstalledToolIds();

    const tools: ToolStatus[] = [];
    for (const toolId of installedToolIds) {
      const version = manifest.getToolVersion(toolId) ?? "unknown";
      const trackedFiles = manifest.getToolFiles(toolId);
      const config = getToolConfig(toolId);

      const drifted = await this.checkTrackedFiles(trackedFiles, projectRoot);
      const trackedSet = new Set(trackedFiles.map((f) => f.relativePath));

      const toolDir = join(projectRoot, config.directory);
      const toolDirExists = await this.fs.fileExists(toolDir);
      if (toolDirExists) {
        const diskFiles = await this.fs.listDirectory(toolDir);
        for (const diskRelPath of diskFiles) {
          if (diskRelPath.endsWith(".backup")) continue;
          const fullRelPath = `${config.directory}${diskRelPath}`;
          if (!trackedSet.has(fullRelPath)) {
            drifted.push({ relativePath: fullRelPath, status: "added" });
          }
        }
      }

      tools.push({ toolId, version, drifted });
    }

    let docs: DocsStatus | null = null;
    if ((filterDocs || !filterToolId) && manifest.hasDocs()) {
      const docsVersion = manifest.getDocsVersion() ?? "unknown";
      const docsFiles = manifest.getDocsFiles();
      const drifted = await this.checkTrackedFiles(docsFiles, projectRoot);
      const catalogPath = join(projectRoot, manifest.docsDir, "CATALOG.md");
      if (!(await this.fs.fileExists(catalogPath))) {
        drifted.push({ relativePath: `${manifest.docsDir}/CATALOG.md`, status: "deleted" });
      }
      const trackedDocsSet = new Set(docsFiles.map((f) => f.relativePath));
      const docsDir = join(projectRoot, manifest.docsDir);
      if (await this.fs.fileExists(docsDir)) {
        const diskFiles = await this.fs.listDirectory(docsDir);
        for (const diskRelPath of diskFiles) {
          if (diskRelPath.endsWith(".backup")) continue;
          if (diskRelPath === "CATALOG.md") continue;
          const fullRelPath = `${manifest.docsDir}/${diskRelPath}`;
          if (!trackedDocsSet.has(fullRelPath)) {
            drifted.push({ relativePath: fullRelPath, status: "added" });
          }
        }
      }
      docs = { version: docsVersion, drifted };
    }

    const inSync =
      tools.every((t) => t.drifted.length === 0) && (docs === null || docs.drifted.length === 0);

    return { tools, docs, inSync };
  }

  private async checkTrackedFiles(
    files: ReadonlyArray<{ relativePath: string; hash: FileHash }>,
    projectRoot: string
  ): Promise<FileDrift[]> {
    const drifted: FileDrift[] = [];
    for (const file of files) {
      const fullPath = join(projectRoot, file.relativePath);
      if (!(await this.fs.fileExists(fullPath))) {
        drifted.push({ relativePath: file.relativePath, status: "deleted" });
      } else {
        const diskHash = await this.fs.readFileHash(fullPath);
        if (!diskHash.equals(file.hash)) {
          drifted.push({ relativePath: file.relativePath, status: "modified" });
        }
      }
    }
    return drifted;
  }
}
