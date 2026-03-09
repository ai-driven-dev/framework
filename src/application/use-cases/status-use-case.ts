import { join } from "node:path";
import type { FileHash } from "../../domain/models/file-hash.js";
import { type ToolId, getToolConfig } from "../../domain/models/tool-config.js";
import type { FileSystem } from "../../domain/ports/file-system.js";
import type { FrameworkResolver } from "../../domain/ports/framework-resolver.js";
import type { Logger } from "../../domain/ports/logger.js";
import type { ManifestRepository } from "../../domain/ports/manifest-repository.js";

export type FileStatusKind = "modified" | "deleted" | "added";

export interface FileDrift {
  relativePath: string;
  status: FileStatusKind;
}

export interface ToolStatus {
  toolId: ToolId;
  version: string;
  drifted: FileDrift[];
  updateAvailable?: { current: string; latest: string };
}

export interface DocsStatus {
  version: string;
  drifted: FileDrift[];
  updateAvailable?: { current: string; latest: string };
}

export interface StatusReport {
  tools: ToolStatus[];
  docs: DocsStatus | null;
  inSync: boolean;
}

export interface StatusOptions {
  projectRoot: string;
  filterToolId?: ToolId;
}

export function compareSemver(a: string, b: string): -1 | 0 | 1 {
  const parse = (v: string) => v.replace(/^v/, "").split(".").map(Number);
  const [aMajor = 0, aMinor = 0, aPatch = 0] = parse(a);
  const [bMajor = 0, bMinor = 0, bPatch = 0] = parse(b);
  if (aMajor !== bMajor) return aMajor < bMajor ? -1 : 1;
  if (aMinor !== bMinor) return aMinor < bMinor ? -1 : 1;
  if (aPatch !== bPatch) return aPatch < bPatch ? -1 : 1;
  return 0;
}

export class StatusUseCase {
  constructor(
    private readonly fs: FileSystem,
    private readonly manifestRepo: ManifestRepository,
    private readonly logger: Logger,
    private readonly resolver?: FrameworkResolver
  ) {}

  async execute(options: StatusOptions): Promise<StatusReport> {
    const { projectRoot, filterToolId } = options;

    const manifest = await this.manifestRepo.load();
    if (manifest === null) {
      throw new Error("No AIDD installation found. Run `aidd init` first.");
    }

    if (filterToolId && !manifest.hasTool(filterToolId)) {
      throw new Error(`${filterToolId} is not installed`);
    }

    const installedToolIds = filterToolId ? [filterToolId] : manifest.getInstalledToolIds();

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
          const fullRelPath = `${config.directory}${diskRelPath}`;
          if (!trackedSet.has(fullRelPath)) {
            drifted.push({ relativePath: fullRelPath, status: "added" });
          }
        }
      }

      tools.push({ toolId, version, drifted });
    }

    let docs: DocsStatus | null = null;
    if (!filterToolId && manifest.hasDocs()) {
      const docsVersion = manifest.getDocsVersion() ?? "unknown";
      const docsFiles = manifest.getDocsFiles();
      const drifted = await this.checkTrackedFiles(docsFiles, projectRoot);
      docs = { version: docsVersion, drifted };
    }

    const inSync =
      tools.every((t) => t.drifted.length === 0) && (docs === null || docs.drifted.length === 0);

    const latestVersion = await this.fetchLatestSemver();
    if (latestVersion !== null) {
      for (const tool of tools) {
        const current = tool.version.replace(/^v/, "");
        if (/^\d+\.\d+\.\d+$/.test(current) && compareSemver(current, latestVersion) < 0) {
          tool.updateAvailable = { current, latest: latestVersion };
        }
      }
      if (docs) {
        const current = docs.version.replace(/^v/, "");
        if (/^\d+\.\d+\.\d+$/.test(current) && compareSemver(current, latestVersion) < 0) {
          docs.updateAvailable = { current, latest: latestVersion };
        }
      }
    }

    return { tools, docs, inSync };
  }

  private async fetchLatestSemver(): Promise<string | null> {
    if (!this.resolver) return null;
    try {
      const tagName = await this.resolver.fetchLatestVersion();
      return tagName.replace(/^v/, "");
    } catch (error) {
      this.logger.debug(`Version check skipped: ${error}`);
      return null;
    }
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
