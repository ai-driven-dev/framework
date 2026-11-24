import { dirname, join } from "node:path";
import type { Scope } from "../../../../../shared/domain/scope.js";
import type { FileWriter } from "../../../../../shared/ports/file-writer.js";
import type { PluginPlacement } from "../../../ports/tool-sections.js";
import { scopeBaseOf } from "../plugin-target-resolution.js";

/** The directory a plugin's recorded paths are relative to, with the scope that recorded it. */
export interface PluginBase {
  readonly dir: string;
  readonly scope: Scope;
}

/** Deletes exactly the paths a plugin's own manifest entry lists, joined to its base dir, and the
 * directories they leave empty. Never enumerates the directory or deletes by pattern: only
 * manifest-tracked keys. The tool's own folder is never pruned: a user may have filled it before
 * and expects to find it. */
export async function deleteOldFiles(
  files: ReadonlyMap<string, string>,
  base: PluginBase,
  fs: FileWriter
): Promise<void> {
  for (const relativePath of files.keys()) {
    const path = join(base.dir, relativePath);
    await fs.deleteFile(path);
    const floor = pruningFloor(relativePath, base);
    if (floor !== undefined) await fs.deleteEmptyDirectories(dirname(path), floor);
  }
}

/** A user-scope base already sits inside the tool's folder, so only the base is kept. A project
 * base is the project root, whose first path segment is the tool's folder. `undefined` when the
 * file sits directly in the kept directory. */
function pruningFloor(relativePath: string, { dir, scope }: PluginBase): string | undefined {
  const [root = "", ...below] = relativePath.split("/");
  if (scope === "user") return below.length > 0 ? dir : undefined;
  return below.length > 1 ? join(dir, root) : undefined;
}

export interface PluginFilesRemoval {
  readonly files: ReadonlyMap<string, string>;
  readonly scope: Scope;
  readonly tool: PluginPlacement;
  readonly projectRoot: string;
  readonly ownerScope?: Scope;
  readonly homedir: () => string;
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
  const { files, scope, tool, projectRoot, ownerScope = "project", homedir } = removal;
  if (scope === "user" && ownerScope !== "user") return [];
  const baseDir = scopeBaseOf(tool, {
    scope: scope,
    projectRoot: projectRoot,
    homedir,
  });
  await deleteOldFiles(files, { dir: baseDir, scope }, fs);
  return [...files.keys()];
}
