import type { InstallationFile } from "../../../../shared/domain/installation-file.js";
import type { MergeFileEntry } from "../../../../shared/domain/merge.js";
import type { ToolId } from "../../../../shared/domain/tool.js";
import { DuplicatePluginError, PluginNotFoundError } from "../installation.error.js";
import { InstalledPlugin } from "../plugins/installed-plugin.js";
import type { PluginEntryData } from "../plugins/plugin-entry.js";
import {
  type MergeFileEntryData,
  parseMergeFileEntries,
  toMergeFileEntryData,
} from "./merge-files.js";
import {
  type NativeRegistrations,
  parseNativeRegistrations,
  serializeNativeRegistrations,
} from "./native-registrations.js";
import {
  parseTrackedFiles,
  type TrackedFile,
  type TrackedFileData,
  toTrackedFileData,
  toTrackedFiles,
} from "./tracked-files.js";

export interface ToolEntry {
  readonly toolId: ToolId;
  readonly version: string;
  readonly files: readonly TrackedFile[];
  readonly mergeFiles: readonly MergeFileEntry[];
  readonly plugins: readonly InstalledPlugin[];
  /** What this tool's own CLI was asked to register, or `undefined` for a tool with
   * no `nativeActivation`: see {@link NativeRegistrations}. */
  readonly nativeRegistrations?: NativeRegistrations;
}

export interface ToolEntryData {
  toolId: string;
  version: string;
  files: TrackedFileData[];
  mergeFiles?: MergeFileEntryData[];
  plugins?: PluginEntryData[];
  nativeRegistrations?: unknown;
}

export function createToolEntry(params: {
  toolId: ToolId;
  version: string;
  files: InstallationFile[];
  mergeFiles: readonly MergeFileEntry[];
  existingPlugins: readonly InstalledPlugin[];
}): ToolEntry {
  return {
    toolId: params.toolId,
    version: params.version,
    files: toTrackedFiles(params.files),
    mergeFiles: params.mergeFiles,
    plugins: params.existingPlugins,
  };
}

export function addPluginToEntry(entry: ToolEntry, plugin: InstalledPlugin): ToolEntry {
  if (entry.plugins.some((p) => p.name === plugin.name)) {
    throw new DuplicatePluginError(plugin.name);
  }
  return { ...entry, plugins: [...entry.plugins, plugin] };
}

export function removePluginFromEntry(entry: ToolEntry, name: string): ToolEntry {
  if (!entry.plugins.some((p) => p.name === name)) {
    throw new PluginNotFoundError(name);
  }
  return { ...entry, plugins: entry.plugins.filter((p) => p.name !== name) };
}

export function updatePluginInEntry(entry: ToolEntry, plugin: InstalledPlugin): ToolEntry {
  if (!entry.plugins.some((p) => p.name === plugin.name)) {
    throw new PluginNotFoundError(plugin.name);
  }
  return {
    ...entry,
    plugins: entry.plugins.map((p) => (p.name === plugin.name ? plugin : p)),
  };
}

/** Every tracked path under `dir`: files, merge files and plugin files alike, across the entries. */
export function trackedPathsInDirectory(entries: Iterable<ToolEntry>, dir: string): Set<string> {
  const tracked = new Set<string>();
  for (const entry of entries) {
    const paths = [
      ...entry.files.map((f) => f.relativePath),
      ...entry.mergeFiles.map((m) => m.relativePath),
      ...entry.plugins.flatMap((plugin) => [...plugin.files.keys()]),
    ];
    for (const path of paths) if (path.startsWith(dir)) tracked.add(path);
  }
  return tracked;
}

export function serializeToolEntry(entry: ToolEntry): ToolEntryData {
  return {
    toolId: entry.toolId,
    version: entry.version,
    files: toTrackedFileData(entry.files),
    mergeFiles: toMergeFileEntryData(entry.mergeFiles),
    ...(entry.plugins.length > 0 && { plugins: entry.plugins.map((p) => p.toJSON()) }),
    ...(entry.nativeRegistrations !== undefined && {
      nativeRegistrations: serializeNativeRegistrations(entry.nativeRegistrations),
    }),
  };
}

export function parseToolEntry(toolId: ToolId, data: ToolEntryData): ToolEntry {
  return {
    toolId,
    version: data.version,
    files: parseTrackedFiles(data.files),
    mergeFiles: parseMergeFileEntries(data.mergeFiles ?? []),
    plugins: (data.plugins ?? []).map((p) => InstalledPlugin.fromJSON(p)),
    nativeRegistrations: parseNativeRegistrations(data.nativeRegistrations),
  };
}
