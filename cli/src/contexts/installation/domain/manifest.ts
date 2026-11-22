import type { FileHash } from "../../../shared/domain/file-hash.js";
import type { InstallationFile } from "../../../shared/domain/installation-file.js";
import type { MergeFileEntry } from "../../../shared/domain/merge.js";
import { ToolNotInManifestError } from "../../../shared/domain/shared.error.js";
import type { ToolId, ToolIdResolver } from "../../../shared/domain/tool.js";
import { InvalidManifestDataError } from "./installation.error.js";
import {
  assertSupportedManifestVersion,
  DEFAULT_MANIFEST_CONTEXT,
  type ManifestFileContext,
} from "./manifest/assert-supported-version.js";
import { type Ownership, ownerOf } from "./manifest/ownership.js";
import {
  addPluginToEntry,
  createToolEntry,
  removePluginFromEntry,
  type ToolEntry,
  updatePluginInEntry,
} from "./manifest/tool-entry.js";
import { withUpdatedHash } from "./manifest/tracked-files.js";
import {
  MANIFEST_VERSION,
  type ManifestData,
  parseManifestTools,
  serializeManifestTools,
} from "./manifest-serialization.js";
import type { InstalledPlugin } from "./plugins/installed-plugin.js";
import type { RecordedPlugin } from "./plugins/recorded-plugin.js";

export class Manifest {
  private readonly _tools: Map<string, ToolEntry>;

  private constructor(params: { tools: Map<ToolId, ToolEntry> }) {
    this._tools = new Map(params.tools);
  }

  static create(): Manifest {
    return new Manifest({ tools: new Map() });
  }

  addTool(toolId: ToolId, version: string, files: InstallationFile[]): void {
    const existing = this._tools.get(toolId);
    this._tools.set(
      toolId,
      createToolEntry({
        toolId,
        version,
        files,
        mergeFiles: [],
        existingPlugins: existing?.plugins ?? [],
      })
    );
  }

  getInstalledToolIds(): ToolId[] {
    return [...this._tools.values()].map((entry) => entry.toolId);
  }

  getToolFiles(
    toolId: string
  ): ReadonlyArray<{ relativePath: string; hash: FileHash; frameworkPath?: string }> {
    return this._tools.get(toolId)?.files ?? [];
  }

  getMergeFiles(toolId: string): readonly MergeFileEntry[] {
    return this._tools.get(toolId)?.mergeFiles ?? [];
  }

  /** Tracked files, merge files and plugin files alike, across every tool. */
  recordFileHash(toolId: ToolId, relativePath: string, hash: FileHash): void {
    const entry = this._tools.get(toolId);
    if (!entry) return;
    this._tools.set(toolId, { ...entry, files: withUpdatedHash(entry.files, relativePath, hash) });
  }

  updateToolMergeFiles(toolId: ToolId, mergeFiles: MergeFileEntry[]): void {
    this.changeEntry(toolId, (entry) => ({ ...entry, mergeFiles }));
  }

  removeTool(toolId: ToolId): void {
    if (!this._tools.has(toolId)) throw new ToolNotInManifestError(toolId);
    this._tools.delete(toolId);
  }

  hasTool(toolId: string): boolean {
    return this._tools.has(toolId);
  }

  /** What installation owns of each plugin the tool records. */
  getPlugins(toolId: string): readonly InstalledPlugin[] {
    return this.getRecordedPlugins(toolId).map((recorded) => recorded.plugin);
  }

  /** Each plugin the tool records, with its provenance, host reference and machine claim. */
  getRecordedPlugins(toolId: string): readonly RecordedPlugin[] {
    return this._tools.get(toolId)?.plugins ?? [];
  }

  addPlugin(toolId: ToolId, plugin: RecordedPlugin): void {
    this.changeEntry(toolId, (entry) => addPluginToEntry(entry, plugin));
  }

  removePlugin(toolId: ToolId, name: string): void {
    this.changeEntry(toolId, (entry) => removePluginFromEntry(entry, name));
  }

  updatePlugin(toolId: ToolId, plugin: RecordedPlugin): void {
    this.changeEntry(toolId, (entry) => updatePluginInEntry(entry, plugin));
  }

  /** Records the plugin, replacing the one of the same name in place when there is one. */
  withPlugin(toolId: ToolId, plugin: RecordedPlugin): void {
    const recorded = this.getPlugins(toolId).some((p) => p.name === plugin.plugin.name);
    if (recorded) this.updatePlugin(toolId, plugin);
    else this.addPlugin(toolId, plugin);
  }

  /** Drops the plugin of that name. There is nothing to drop when the plugin or its tool is absent. */
  withoutPlugin(toolId: ToolId, name: string): void {
    if (this.getPlugins(toolId).some((p) => p.name === name)) this.removePlugin(toolId, name);
  }

  private changeEntry(toolId: ToolId, change: (entry: ToolEntry) => ToolEntry): void {
    const entry = this._tools.get(toolId);
    if (!entry) throw new ToolNotInManifestError(toolId);
    this._tools.set(toolId, change(entry));
  }

  ownerOf(relativePath: string): Ownership {
    return ownerOf([...this._tools.values()], relativePath);
  }

  isFileTracked(relativePath: string): boolean {
    return this.ownerOf(relativePath).owner !== "user";
  }

  getToolVersion(toolId: string): string | undefined {
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
    return { version: MANIFEST_VERSION, tools: serializeManifestTools(this._tools) };
  }

  static fromJSON(
    data: unknown,
    resolveToolId: ToolIdResolver,
    context: ManifestFileContext = DEFAULT_MANIFEST_CONTEXT
  ): Manifest {
    if (data === null || typeof data !== "object") {
      throw new InvalidManifestDataError("expected an object.");
    }
    const raw = data as Record<string, unknown>;
    assertSupportedManifestVersion(raw, context);
    const tools = parseManifestTools(raw, resolveToolId);
    return new Manifest({ tools });
  }
}
