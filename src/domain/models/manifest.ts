import {
  InvalidManifestDataError,
  InvalidManifestToolIdError,
  InvalidRepoFormatError,
  ManifestValidationError,
  ToolNotInManifestError,
} from "../errors.js";
import { FileHash, type InstallationFile } from "./file.js";
import { type McpExclusion, mcpExclusionEquals } from "./mcp-exclusion.js";
import type { MergeFileEntry } from "./merge.js";
import { type ToolId, VALID_TOOL_IDS } from "./tool-ids.js";

const MANIFEST_VERSION = 2;

// VSCode file paths that were tracked under "copilot" in manifest v1.
// Used exclusively by migrateV1toV2 to move them to the "vscode" tool entry.
const VSCODE_MIGRATION_PATHS = new Set([
  ".vscode/extensions.json",
  ".vscode/keybindings.json",
  ".vscode/settings.json",
]);

const REPO_FORMAT_REGEX = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;
const DOCS_DIR_REGEX = /^[a-zA-Z0-9_-]+$/;

export function validateRepoFormat(repo: string): void {
  if (!REPO_FORMAT_REGEX.test(repo)) {
    throw new InvalidRepoFormatError();
  }
}

interface TrackedFile {
  readonly relativePath: string;
  readonly hash: FileHash;
  readonly frameworkPath?: string;
}

interface DocsEntry {
  readonly version: string;
  readonly files: readonly TrackedFile[];
}

interface ScriptsEntry {
  readonly version: string;
  readonly files: readonly TrackedFile[];
}

interface ToolEntry {
  readonly toolId: ToolId;
  readonly version: string;
  readonly files: readonly TrackedFile[];
  readonly mergeFiles: readonly MergeFileEntry[];
  readonly excludedMcp: readonly McpExclusion[];
}

interface ScriptsEntryData {
  version: string;
  files: TrackedFileData[];
}

interface ManifestData {
  version: number;
  docsDir: string;
  repo?: string;
  tools: Record<string, ToolEntryData>;
  docs: DocsEntryData | null;
  scripts: ScriptsEntryData | null;
}

interface MergeFileEntryData {
  relativePath: string;
  sectionKey: string | null;
  entries: Record<string, string>;
}

interface ToolEntryData {
  toolId: string;
  version: string;
  files: TrackedFileData[];
  mergeFiles?: MergeFileEntryData[];
  excludedMcp?: Array<{ configPath: string; entryKey: string }>;
}

interface DocsEntryData {
  version: string;
  files: TrackedFileData[];
}

interface TrackedFileData {
  relativePath: string;
  hash: string;
  frameworkPath?: string;
}

// This migration block must remain until all users have upgraded past v1.
// Removing it would corrupt manifests that still have VSCode files tracked under "copilot".
// It can only be removed when the manifest version is bumped again and v1 support is explicitly dropped.
function migrateV1toV2(raw: Record<string, unknown>): void {
  const tools = raw.tools as Record<string, ToolEntryData> | undefined;
  if (!tools) return;

  const copilot = tools.copilot;
  if (!copilot) return;

  const vscodeFiles = copilot.files.filter((f) => VSCODE_MIGRATION_PATHS.has(f.relativePath));
  if (vscodeFiles.length === 0) return;

  copilot.files = copilot.files.filter((f) => !VSCODE_MIGRATION_PATHS.has(f.relativePath));

  if (!tools.vscode) {
    tools.vscode = {
      toolId: "vscode",
      version: copilot.version,
      files: [],
      mergeFiles: [],
    };
  }
  const existingPaths = new Set(tools.vscode.files.map((f) => f.relativePath));
  const deduped = vscodeFiles.filter((f) => !existingPaths.has(f.relativePath));
  tools.vscode.files = [...tools.vscode.files, ...deduped];
}

export class Manifest {
  static readonly DEFAULT_DOCS_DIR = "aidd_docs";
  static readonly DEFAULT_REPO = "ai-driven-dev/aidd-framework";

  static validateDocsDir(name: string): void {
    if (!DOCS_DIR_REGEX.test(name) || name.includes("..")) {
      throw new ManifestValidationError(
        `Invalid directory name: "${name}". Use alphanumeric characters, hyphens, and underscores only.`
      );
    }
  }

  private readonly _tools: Map<ToolId, ToolEntry>;
  private _docs: DocsEntry | null;
  private _scripts: ScriptsEntry | null;
  readonly docsDir: string;
  readonly repo?: string;

  private constructor(params: {
    tools: Map<ToolId, ToolEntry>;
    docs: DocsEntry | null;
    scripts: ScriptsEntry | null;
    docsDir: string;
    repo?: string;
  }) {
    this._tools = new Map(params.tools);
    this._docs = params.docs;
    this._scripts = params.scripts;
    this.docsDir = params.docsDir;
    this.repo = params.repo;
  }

  static create(docsDir?: string, repo?: string): Manifest {
    return new Manifest({
      tools: new Map(),
      docs: null,
      scripts: null,
      docsDir: docsDir ?? Manifest.DEFAULT_DOCS_DIR,
      repo,
    });
  }

  addTool(
    toolId: ToolId,
    version: string,
    files: InstallationFile[],
    mergeFiles: MergeFileEntry[] = [],
    excludedMcp: McpExclusion[] = []
  ): void {
    this._tools.set(toolId, {
      toolId,
      version,
      files: this.toTrackedFiles(files),
      mergeFiles,
      excludedMcp,
    });
  }

  addDocs(version: string, files: InstallationFile[]): void {
    this._docs = { version, files: this.toTrackedFiles(files) };
  }

  addScripts(version: string, files: InstallationFile[]): void {
    this._scripts = { version, files: this.toTrackedFiles(files) };
  }

  getScriptsFiles(): ReadonlyArray<{ relativePath: string; hash: FileHash }> {
    return this._scripts?.files ?? [];
  }

  getScriptsVersion(): string | undefined {
    return this._scripts?.version;
  }

  hasScripts(): boolean {
    return this._scripts !== null;
  }

  private toTrackedFiles(files: InstallationFile[]): TrackedFile[] {
    return files.map((f) => ({
      relativePath: f.relativePath,
      hash: f.hash,
      ...(f.frameworkPath !== undefined && { frameworkPath: f.frameworkPath }),
    }));
  }

  getInstalledToolIds(): ToolId[] {
    return [...this._tools.keys()];
  }

  getToolFiles(
    toolId: ToolId
  ): ReadonlyArray<{ relativePath: string; hash: FileHash; frameworkPath?: string }> {
    return this._tools.get(toolId)?.files ?? [];
  }

  getMergeFiles(toolId: ToolId): readonly MergeFileEntry[] {
    return this._tools.get(toolId)?.mergeFiles ?? [];
  }

  /** Returns all tracked paths (files + merge files) across all tools that start with the given directory prefix. */
  getTrackedPathsInDirectory(dir: string): Set<string> {
    const tracked = new Set<string>();
    for (const [, entry] of this._tools) {
      for (const f of entry.files) {
        if (f.relativePath.startsWith(dir)) tracked.add(f.relativePath);
      }
      for (const m of entry.mergeFiles) {
        if (m.relativePath.startsWith(dir)) tracked.add(m.relativePath);
      }
    }
    return tracked;
  }

  getExcludedMcp(toolId: ToolId): readonly McpExclusion[] {
    return this._tools.get(toolId)?.excludedMcp ?? [];
  }

  addExcludedMcp(toolId: ToolId, exclusions: McpExclusion[]): void {
    const entry = this._tools.get(toolId);
    if (!entry) throw new ToolNotInManifestError(toolId);
    const existing = [...entry.excludedMcp];
    for (const excl of exclusions) {
      if (!existing.some((e) => mcpExclusionEquals(e, excl))) {
        existing.push(excl);
      }
    }
    this._tools.set(toolId, { ...entry, excludedMcp: existing });
  }

  removeExcludedMcp(toolId: ToolId, exclusions: McpExclusion[]): void {
    const entry = this._tools.get(toolId);
    if (!entry) throw new ToolNotInManifestError(toolId);
    const filtered = entry.excludedMcp.filter(
      (e) => !exclusions.some((r) => mcpExclusionEquals(e, r))
    );
    this._tools.set(toolId, { ...entry, excludedMcp: filtered });
  }

  clearExcludedMcp(toolId: ToolId): void {
    const entry = this._tools.get(toolId);
    if (!entry) throw new ToolNotInManifestError(toolId);
    this._tools.set(toolId, { ...entry, excludedMcp: [] });
  }

  updateToolMergeFiles(
    toolId: ToolId,
    mergeFiles: MergeFileEntry[],
    excludedMcp?: McpExclusion[]
  ): void {
    const entry = this._tools.get(toolId);
    if (!entry) throw new ToolNotInManifestError(toolId);
    this._tools.set(toolId, {
      ...entry,
      mergeFiles,
      ...(excludedMcp !== undefined && { excludedMcp }),
    });
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
      throw new ToolNotInManifestError(toolId);
    }
    this._tools.delete(toolId);
  }

  hasTool(toolId: ToolId): boolean {
    return this._tools.has(toolId);
  }

  isFileTracked(relativePath: string): boolean {
    for (const entry of this._tools.values()) {
      if (entry.files.some((f) => f.relativePath === relativePath)) return true;
      if (entry.mergeFiles.some((m) => m.relativePath === relativePath)) return true;
    }
    if (this._docs?.files.some((f) => f.relativePath === relativePath)) return true;
    if (this._scripts?.files.some((f) => f.relativePath === relativePath)) return true;
    return false;
  }

  withDocsDir(newDocsDir: string): Manifest {
    return new Manifest({
      tools: new Map(this._tools),
      docs: this._docs,
      scripts: this._scripts,
      docsDir: newDocsDir,
      repo: this.repo,
    });
  }

  withRepo(newRepo: string): Manifest {
    return new Manifest({
      tools: new Map(this._tools),
      docs: this._docs,
      scripts: this._scripts,
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
        mergeFiles: this.toMergeFileEntryData(entry.mergeFiles),
        ...(entry.excludedMcp.length > 0 && {
          excludedMcp: entry.excludedMcp.map((e) => ({
            configPath: e.configPath,
            entryKey: e.entryKey,
          })),
        }),
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
      scripts: this._scripts
        ? { version: this._scripts.version, files: this.toTrackedFileData(this._scripts.files) }
        : null,
    };
  }

  private toTrackedFileData(files: readonly TrackedFile[]): TrackedFileData[] {
    return files.map((f) => ({
      relativePath: f.relativePath,
      hash: f.hash.value,
      ...(f.frameworkPath !== undefined && { frameworkPath: f.frameworkPath }),
    }));
  }

  private static parseTrackedFiles(files: TrackedFileData[]): TrackedFile[] {
    return files.map((f) => ({
      relativePath: f.relativePath,
      hash: new FileHash(f.hash),
      ...(f.frameworkPath !== undefined && { frameworkPath: f.frameworkPath }),
    }));
  }

  private toMergeFileEntryData(mergeFiles: readonly MergeFileEntry[]): MergeFileEntryData[] {
    return mergeFiles.map((m) => {
      const entries: Record<string, string> = {};
      for (const [key, hash] of Object.entries(m.entries)) {
        entries[key] = hash.value;
      }
      return {
        relativePath: m.relativePath,
        sectionKey: m.sectionKey,
        entries,
      };
    });
  }

  private static parseMergeFileEntries(data: MergeFileEntryData[]): MergeFileEntry[] {
    return data.map((m) => {
      const entries: Record<string, FileHash> = {};
      for (const [key, hash] of Object.entries(m.entries)) {
        entries[key] = new FileHash(hash);
      }
      return {
        relativePath: m.relativePath,
        sectionKey: m.sectionKey,
        entries,
      };
    });
  }

  static fromJSON(data: unknown): Manifest {
    if (data === null || typeof data !== "object") {
      throw new InvalidManifestDataError("expected an object.");
    }

    const raw = data as Record<string, unknown>;

    if (raw.version === MANIFEST_VERSION - 1) {
      migrateV1toV2(raw);
    } else if (raw.version !== MANIFEST_VERSION) {
      throw new InvalidManifestDataError(
        `Unsupported manifest version: ${String(raw.version)}. Expected ${MANIFEST_VERSION}.`
      );
    }

    const tools = Manifest.parseTools(raw);

    let docs: DocsEntry | null = null;
    if (raw.docs !== null && raw.docs !== undefined && typeof raw.docs === "object") {
      const docsRaw = raw.docs as DocsEntryData;
      docs = {
        version: docsRaw.version,
        files: Manifest.parseTrackedFiles(docsRaw.files),
      };
    }

    const docsDir = typeof raw.docsDir === "string" ? raw.docsDir : Manifest.DEFAULT_DOCS_DIR;
    const repo = typeof raw.repo === "string" ? raw.repo : undefined;

    let scripts: ScriptsEntry | null = null;
    if (raw.scripts !== null && raw.scripts !== undefined && typeof raw.scripts === "object") {
      const scriptsRaw = raw.scripts as ScriptsEntryData;
      scripts = {
        version: scriptsRaw.version,
        files: Manifest.parseTrackedFiles(scriptsRaw.files),
      };
    }

    return new Manifest({ tools, docs, scripts, docsDir, repo });
  }

  private static parseTools(raw: Record<string, unknown>): Map<ToolId, ToolEntry> {
    const tools = new Map<ToolId, ToolEntry>();
    if (raw.tools === null || typeof raw.tools !== "object") return tools;

    for (const [key, value] of Object.entries(raw.tools as Record<string, unknown>)) {
      const toolId = key as ToolId;
      if (!VALID_TOOL_IDS.includes(toolId)) {
        throw new InvalidManifestToolIdError(key);
      }
      const entry = value as ToolEntryData;
      tools.set(toolId, {
        toolId,
        version: entry.version,
        files: Manifest.parseTrackedFiles(entry.files),
        mergeFiles: Manifest.parseMergeFileEntries(entry.mergeFiles ?? []),
        excludedMcp:
          entry.excludedMcp?.map((e) => ({ configPath: e.configPath, entryKey: e.entryKey })) ?? [],
      });
    }
    return tools;
  }
}
