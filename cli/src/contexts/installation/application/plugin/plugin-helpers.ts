import { homedir as nodeHomedir } from "node:os";
import { dirname, join } from "node:path";
import { FileHash, type InstallationFile } from "../../../../shared/domain/file.js";
import type { PluginDistribution } from "../../../../shared/domain/plugin/plugin-distribution.js";
import type { Scope } from "../../../../shared/domain/scope.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
// biome-ignore lint/plugin: hands the profile to the plugin translation pipeline; it narrows when installation declares its own profile input
import type { AiToolProfile } from "../../../tools/contract/tool-profile.js";
import { driftOf } from "../../domain/manifest/drift.js";
import type { Manifest } from "../../domain/manifest.js";
import type { InstalledPlugin } from "../../domain/plugins/installed-plugin.js";
import type { PluginPlacement } from "../../ports/tool-sections.js";
import type { PluginTranslator } from "../materialize/plugin-translator.js";
import type { ProjectHooksGuard } from "../shared/remove-project-hooks.js";
import { scopeBaseOf } from "./plugin-target-resolution.js";

export async function writePluginFiles(
  files: InstallationFile[],
  baseDir: string,
  fs: FileWriter
): Promise<void> {
  await Promise.all(files.map((f) => fs.writeFile(join(baseDir, f.relativePath), f.content)));
}

/** Deletes exactly the paths a plugin's own manifest entry lists, joined to its base dir.
 * Never enumerates the directory or deletes by pattern: only manifest-tracked keys. */
export async function deleteOldFiles(
  files: ReadonlyMap<string, string>,
  baseDir: string,
  fs: FileWriter
): Promise<void> {
  for (const relativePath of files.keys()) {
    await fs.deleteFile(join(baseDir, relativePath));
  }
}

export interface PluginFilesRemoval {
  readonly files: ReadonlyMap<string, string>;
  readonly scope: Scope;
  readonly tool: PluginPlacement;
  readonly projectRoot: string;
  readonly ownerScope?: Scope;
}

/**
 * Deletes a plugin's tracked files from the base directory its manifest entry actually recorded -
 * `projectRoot` for a project-scope entry, the resolved user-scope plugins dir otherwise. Every
 * plugin-file removal path must resolve the base dir this way, or a user-scope tool's files are
 * never removed and a path under `projectRoot` that was never written is asked to delete nothing.
 */
export async function deletePluginFilesForTool(
  removal: PluginFilesRemoval,
  fs: FileWriter
): Promise<string[]> {
  const { files, scope, tool, projectRoot, ownerScope = "project" } = removal;
  if (scope === "user" && ownerScope !== "user") return [];
  const baseDir = scopeBaseOf(tool, {
    scope: scope,
    projectRoot: projectRoot,
    homedir: nodeHomedir,
  });
  const deleted: string[] = [];
  for (const relativePath of files.keys()) {
    const fullPath = join(baseDir, relativePath);
    await fs.deleteFile(fullPath);
    await fs.deleteEmptyDirectories(dirname(fullPath));
    deleted.push(relativePath);
  }
  return deleted;
}

/** Whether the file already on disk matches the content we would write, so a caller can skip the
 * write and, more importantly, not count it as restored. */
export async function isPluginFileAtDesiredState(
  fs: FileReader,
  outputPath: string,
  expectedHashValue: string
): Promise<boolean> {
  if (!(await fs.fileExists(outputPath))) return false;
  const content = await fs.readFile(outputPath);
  return driftOf(expectedHashValue, FileHash.of(content)) === "ok";
}

export interface PluginRematerialization {
  readonly dist: PluginDistribution;
  readonly tool: AiToolProfile;
  readonly plugin: InstalledPlugin;
  readonly projectRoot: string;
  readonly manifest: Manifest;
  readonly hooksGuard?: ProjectHooksGuard;
}

/**
 * Re-registers a marketplace-sourced plugin through its resolved translator: drops the existing
 * manifest entry and lets the translator re-add it, so update and restore both end with the same
 * single entry an install would have produced.
 *
 * Returns how many files the translator actually (re)wrote: not the plugin's total file count: so
 * a no-op restore reports zero. `written` is undefined for a translator that writes no files, and
 * is reported as 0 rather than guessed.
 */
export async function materializeViaTranslator(
  translator: PluginTranslator,
  rematerialization: PluginRematerialization
): Promise<number> {
  const { dist, tool, plugin, projectRoot, manifest, hooksGuard = {} } = rematerialization;
  manifest.removePlugin(tool.toolId, plugin.name);
  const { written } = await translator.addPlugin(
    dist,
    tool,
    plugin.source,
    projectRoot,
    manifest,
    plugin.marketplace,
    plugin.mcpEntries,
    false,
    plugin.projectHooks,
    hooksGuard
  );
  return written ?? 0;
}
