import { FileHash } from "./file-hash.js";
import type { GeneratedFile } from "./generated-file.js";
import { type ToolId, VALID_TOOL_IDS } from "./tool-config.js";

const DEFAULT_DOCS_DIR = "aidd_docs";

const MANIFEST_VERSION = 1;

interface TrackedFile {
  readonly relativePath: string;
  readonly hash: FileHash;
}

interface DocsEntry {
  readonly version: string;
  readonly files: readonly TrackedFile[];
}

interface ToolEntry {
  readonly toolId: ToolId;
  readonly version: string;
  readonly files: readonly TrackedFile[];
}

interface ManifestData {
  version: number;
  docsDir: string;
  repo?: string;
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
  readonly docsDir: string;
  readonly repo?: string;

  private constructor(params: {
    tools: Map<ToolId, ToolEntry>;
    docs: DocsEntry | null;
    docsDir: string;
    repo?: string;
  }) {
    this._tools = new Map(params.tools);
    this._docs = params.docs;
    this.docsDir = params.docsDir;
    this.repo = params.repo;
  }

  static create(docsDir?: string, repo?: string): Manifest {
    return new Manifest({
      tools: new Map(),
      docs: null,
      docsDir: docsDir ?? DEFAULT_DOCS_DIR,
      repo,
    });
  }

  addTool(toolId: ToolId, version: string, files: GeneratedFile[]): void {
    this._tools.set(toolId, { toolId, version, files: this.toTrackedFiles(files) });
  }

  syncFileHashAcrossTools(relativePath: string, hash: FileHash): void {
    for (const [toolId, entry] of this._tools.entries()) {
      const idx = entry.files.findIndex((f) => f.relativePath === relativePath);
      if (idx === -1) continue;
      const files = [...entry.files];
      files[idx] = { relativePath, hash };
      this._tools.set(toolId, { ...entry, files });
    }
  }

  addDocs(version: string, files: GeneratedFile[]): void {
    this._docs = { version, files: this.toTrackedFiles(files) };
  }

  private toTrackedFiles(files: GeneratedFile[]): TrackedFile[] {
    return files.map((f) => ({ relativePath: f.relativePath, hash: f.hash }));
  }

  getInstalledToolIds(): ToolId[] {
    return [...this._tools.keys()];
  }

  getToolFiles(toolId: ToolId): ReadonlyArray<{ relativePath: string; hash: FileHash }> {
    return this._tools.get(toolId)?.files ?? [];
  }

  getDocsFiles(): ReadonlyArray<{ relativePath: string; hash: FileHash }> {
    return this._docs?.files ?? [];
  }

  getDocsVersion(): string | undefined {
    return this._docs?.version;
  }

  hasDocs(): boolean {
    return this._docs !== null;
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

  withDocsDir(newDocsDir: string): Manifest {
    return new Manifest({
      tools: new Map(this._tools),
      docs: this._docs,
      docsDir: newDocsDir,
      repo: this.repo,
    });
  }

  withRepo(newRepo: string): Manifest {
    return new Manifest({
      tools: new Map(this._tools),
      docs: this._docs,
      docsDir: this.docsDir,
      repo: newRepo,
    });
  }

  getToolVersion(toolId: ToolId): string | undefined {
    return this._tools.get(toolId)?.version;
  }

  getInstalledDirectories(): Set<string> {
    const dirs = new Set<string>();
    for (const entry of this._tools.values()) {
      for (const file of entry.files) {
        dirs.add(`${file.relativePath.split("/")[0]}/`);
      }
    }
    return dirs;
  }

  toJSON(): ManifestData {
    const tools: Record<string, ToolEntryData> = {};
    for (const [toolId, entry] of this._tools.entries()) {
      tools[toolId] = {
        toolId: entry.toolId,
        version: entry.version,
        files: this.toTrackedFileData(entry.files),
      };
    }

    return {
      version: MANIFEST_VERSION,
      docsDir: this.docsDir,
      ...(this.repo !== undefined && { repo: this.repo }),
      tools,
      docs: this._docs
        ? { version: this._docs.version, files: this.toTrackedFileData(this._docs.files) }
        : null,
    };
  }

  private toTrackedFileData(files: readonly TrackedFile[]): TrackedFileData[] {
    return files.map((f) => ({ relativePath: f.relativePath, hash: f.hash.value }));
  }

  private static parseTrackedFiles(files: TrackedFileData[]): TrackedFile[] {
    return files.map((f) => ({ relativePath: f.relativePath, hash: new FileHash(f.hash) }));
  }

  static fromJSON(data: unknown): Manifest {
    if (data === null || typeof data !== "object") {
      throw new Error("Invalid manifest data: expected an object.");
    }

    const raw = data as Record<string, unknown>;

    if (raw.version !== MANIFEST_VERSION) {
      throw new Error(
        `Unsupported manifest version: ${String(raw.version)}. Expected ${MANIFEST_VERSION}.`
      );
    }

    const tools = new Map<ToolId, ToolEntry>();
    if (raw.tools !== null && typeof raw.tools === "object") {
      for (const [key, value] of Object.entries(raw.tools as Record<string, unknown>)) {
        const toolId = key as ToolId;
        if (!VALID_TOOL_IDS.includes(toolId)) {
          throw new Error(`Invalid tool id in manifest: '${key}'.`);
        }
        const entry = value as ToolEntryData;
        tools.set(toolId, {
          toolId,
          version: entry.version,
          files: Manifest.parseTrackedFiles(entry.files),
        });
      }
    }

    let docs: DocsEntry | null = null;
    if (raw.docs !== null && raw.docs !== undefined && typeof raw.docs === "object") {
      const docsRaw = raw.docs as DocsEntryData;
      docs = {
        version: docsRaw.version,
        files: Manifest.parseTrackedFiles(docsRaw.files),
      };
    }

    const docsDir = typeof raw.docsDir === "string" ? raw.docsDir : DEFAULT_DOCS_DIR;
    const repo = typeof raw.repo === "string" ? raw.repo : undefined;

    return new Manifest({ tools, docs, docsDir, repo });
  }
}
