import type { DocsEntry } from "./docs-entry.js";
import { FileHash } from "./file-hash.js";
import type { GeneratedFile } from "./generated-file.js";
import { StatusReport } from "./status-report.js";
import type { ToolEntry } from "./tool-entry.js";
import { ToolId } from "./tool-spec.js";
import type { TrackedFile } from "./tracked-file.js";

const MANIFEST_VERSION = "1";
const DEFAULT_DOCS_DIR = "aidd_docs";

interface ManifestData {
  version: string;
  docsDir?: string;
  tools: Record<string, ToolEntryData>;
  docs: DocsEntryData | null;
}

interface ToolEntryData {
  toolId: string;
  version: string;
  files: TrackedFileData[];
}

interface DocsEntryData {
  version: string;
  files: TrackedFileData[];
}

interface TrackedFileData {
  relativePath: string;
  hash: string;
}

export class Manifest {
  private readonly _tools: Map<ToolId, ToolEntry>;
  private _docs: DocsEntry | null;
  readonly docsDir: string | undefined;

  private constructor(params: {
    tools: Map<ToolId, ToolEntry>;
    docs: DocsEntry | null;
    docsDir?: string;
  }) {
    this._tools = new Map(params.tools);
    this._docs = params.docs;
    this.docsDir = params.docsDir;
  }

  static create(docsDir?: string): Manifest {
    return new Manifest({
      tools: new Map(),
      docs: null,
      docsDir: docsDir !== DEFAULT_DOCS_DIR ? docsDir : undefined,
    });
  }

  addTool(toolId: ToolId, version: string, files: GeneratedFile[]): void {
    const trackedFiles: TrackedFile[] = files.map((f) => ({
      relativePath: f.relativePath,
      hash: f.hash,
    }));
    this._tools.set(toolId, { toolId, version, files: trackedFiles });
  }

  addDocs(version: string, files: GeneratedFile[]): void {
    const trackedFiles: TrackedFile[] = files.map((f) => ({
      relativePath: f.relativePath,
      hash: f.hash,
    }));
    this._docs = { version, files: trackedFiles };
  }

  removeTool(toolId: ToolId): void {
    if (!this._tools.has(toolId)) {
      throw new Error(`Tool '${toolId}' is not installed in the manifest.`);
    }
    this._tools.delete(toolId);
  }

  hasTool(toolId: ToolId): boolean {
    return this._tools.has(toolId);
  }

  getToolVersion(toolId: ToolId): string | undefined {
    return this._tools.get(toolId)?.version;
  }

  computeStatus(diskHashes: Map<string, FileHash>): StatusReport {
    const allManifestPaths = new Set<string>();
    const modified: string[] = [];
    const deleted: string[] = [];

    for (const entry of this._tools.values()) {
      for (const file of entry.files) {
        allManifestPaths.add(file.relativePath);
        const diskHash = diskHashes.get(file.relativePath);
        if (diskHash === undefined) {
          deleted.push(file.relativePath);
        } else if (!diskHash.equals(file.hash)) {
          modified.push(file.relativePath);
        }
      }
    }

    if (this._docs !== null) {
      for (const file of this._docs.files) {
        allManifestPaths.add(file.relativePath);
        const diskHash = diskHashes.get(file.relativePath);
        if (diskHash === undefined) {
          deleted.push(file.relativePath);
        } else if (!diskHash.equals(file.hash)) {
          modified.push(file.relativePath);
        }
      }
    }

    const untracked: string[] = [];
    for (const path of diskHashes.keys()) {
      if (!allManifestPaths.has(path)) {
        untracked.push(path);
      }
    }

    return new StatusReport({ modified, deleted, untracked });
  }

  toJSON(): ManifestData {
    const tools: Record<string, ToolEntryData> = {};
    for (const [toolId, entry] of this._tools.entries()) {
      tools[toolId] = {
        toolId: entry.toolId,
        version: entry.version,
        files: entry.files.map((f) => ({
          relativePath: f.relativePath,
          hash: f.hash.value,
        })),
      };
    }

    return {
      version: MANIFEST_VERSION,
      ...(this.docsDir !== undefined ? { docsDir: this.docsDir } : {}),
      tools,
      docs: this._docs
        ? {
            version: this._docs.version,
            files: this._docs.files.map((f) => ({
              relativePath: f.relativePath,
              hash: f.hash.value,
            })),
          }
        : null,
    };
  }

  static fromJSON(data: unknown): Manifest {
    if (data === null || typeof data !== "object") {
      throw new Error("Invalid manifest data: expected an object.");
    }

    const raw = data as Record<string, unknown>;

    if (raw.version !== MANIFEST_VERSION) {
      throw new Error(
        `Unsupported manifest version: "${String(raw.version)}". Expected "${MANIFEST_VERSION}".`
      );
    }

    const tools = new Map<ToolId, ToolEntry>();
    if (raw.tools !== null && typeof raw.tools === "object") {
      for (const [key, value] of Object.entries(raw.tools as Record<string, unknown>)) {
        const toolId = key as ToolId;
        if (!Object.values(ToolId).includes(toolId)) {
          throw new Error(`Invalid tool id in manifest: '${key}'.`);
        }
        const entry = value as ToolEntryData;
        tools.set(toolId, {
          toolId,
          version: entry.version,
          files: entry.files.map((f) => ({
            relativePath: f.relativePath,
            hash: new FileHash(f.hash),
          })),
        });
      }
    }

    let docs: DocsEntry | null = null;
    if (raw.docs !== null && raw.docs !== undefined && typeof raw.docs === "object") {
      const docsRaw = raw.docs as DocsEntryData;
      docs = {
        version: docsRaw.version,
        files: docsRaw.files.map((f) => ({
          relativePath: f.relativePath,
          hash: new FileHash(f.hash),
        })),
      };
    }

    const docsDir = typeof raw.docsDir === "string" ? raw.docsDir : undefined;

    return new Manifest({ tools, docs, docsDir });
  }
}
