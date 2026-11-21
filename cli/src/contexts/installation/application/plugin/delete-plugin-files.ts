import { homedir as nodeHomedir } from "node:os";
import { dirname, join } from "node:path";
import type { Scope } from "../../../../shared/domain/scope.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { PluginPlacement } from "../../ports/tool-sections.js";
import { scopeBaseOf } from "./plugin-target-resolution.js";

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
  readonly homedir?: () => string;
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
  const {
    files,
    scope,
    tool,
    projectRoot,
    ownerScope = "project",
    homedir = nodeHomedir,
  } = removal;
  if (scope === "user" && ownerScope !== "user") return [];
  const baseDir = scopeBaseOf(tool, {
    scope: scope,
    projectRoot: projectRoot,
    homedir,
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
