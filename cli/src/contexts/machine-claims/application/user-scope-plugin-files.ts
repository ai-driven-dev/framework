import { dirname, join, posix } from "node:path";
import { FileHash, type InstallationFile } from "../../../shared/domain/file.js";
import { isErrnoException } from "../../../shared/domain/reading/json-file.js";
import type { FileReader } from "../../../shared/ports/file-reader.js";
import type { Logger } from "../../../shared/ports/logger.js";
import { isStrictlyWithinUserScope } from "../domain/user-scope-containment.js";
import type { UserScopePluginFiles } from "../ports/machine-manifest.js";
import type { UserScopeTool } from "../ports/user-scope-tool.js";

/**
 * The files of a user-scope plugin that are actually safe to delete: safe only once the real,
 * `realpath`-resolved location still sits strictly inside the tool's own declared user-scope
 * directory and its current content still matches the recorded install digest. A `..` segment,
 * symlink escape, unreadable file, or user edit refuses a destructive operation before claim detach.
 */
export async function userScopeFilesSafeToDelete(
  fs: FileReader,
  logger: Logger,
  plugin: UserScopePluginFiles<unknown>,
  tool: UserScopeTool,
  homedir: string
): Promise<ReadonlyMap<string, string>> {
  const { toolId } = tool;
  const boundary = tool.plugins()?.userPluginsBaseDir(homedir);
  if (boundary === null || boundary === undefined) return new Map();
  const resolvedBoundary = await tryRealpath(fs, boundary);
  if (resolvedBoundary === null) return new Map();
  const allowed = new Map<string, string>();
  for (const [relativePath, hash] of plugin.files) {
    const resolvedCandidate = await tryRealpath(fs, join(boundary, relativePath));
    if (
      resolvedCandidate !== null &&
      isStrictlyWithinUserScope(resolvedCandidate, resolvedBoundary)
    ) {
      if (!FileHash.isDigest(hash)) {
        throw new Error(
          `${toolId}: '${plugin.name}' file '${relativePath}' has an unproven install digest; removal refused.`
        );
      }
      const current = await fs.readFileHash(join(boundary, relativePath));
      if (current.value !== hash) {
        throw new Error(
          `${toolId}: '${plugin.name}' file '${relativePath}' was edited after install; removal refused.`
        );
      }
      allowed.set(relativePath, hash);
      continue;
    }
    logger.warn(
      `${toolId}: '${plugin.name}' file '${relativePath}' does not resolve inside ${boundary}; left in place.`
    );
  }
  return allowed;
}

/** The plugin without the recorded files nothing stands at any more, which an update writes back.
 * A dangling symlink counts as gone: the atomic write replaces the link, and never follows it. */
export async function withoutMissingFiles<P extends UserScopePluginFiles<P>>(
  fs: FileReader,
  plugin: P,
  tool: UserScopeTool,
  homedir: string
): Promise<P> {
  const boundary = tool.plugins()?.userPluginsBaseDir(homedir);
  if (boundary === null || boundary === undefined) return plugin;
  const present = new Map<string, string>();
  for (const [relativePath, hash] of plugin.files) {
    if (await fs.fileExists(join(boundary, relativePath))) present.set(relativePath, hash);
  }
  return plugin.withFiles(present);
}

/** Refuse a machine update if a new path, existing parent, or plugin directory escapes its declared base. */
export async function assertUserScopeWriteBoundary(
  fs: FileReader,
  tool: UserScopeTool,
  pluginName: string,
  files: readonly InstallationFile[],
  homedir: string
): Promise<void> {
  const { toolId } = tool;
  const boundary = tool.plugins()?.userPluginsBaseDir(homedir);
  if (boundary === null || boundary === undefined)
    throw new Error(`${toolId}: no user plugins directory is declared.`);
  const resolvedBoundary = await tryRealpath(fs, boundary);
  const pluginDir = join(boundary, pluginName);
  const resolvedPluginDir = await tryRealpath(fs, pluginDir);
  if (
    resolvedBoundary === null ||
    resolvedPluginDir === null ||
    !isStrictlyWithinUserScope(resolvedPluginDir, resolvedBoundary)
  ) {
    throw new Error(
      `${toolId}: '${pluginName}' directory is not safely inside ${boundary}; update refused.`
    );
  }
  for (const file of files) {
    const rel = file.relativePath;
    if (
      posix.isAbsolute(rel) ||
      rel.includes("\\") ||
      posix.normalize(rel) !== rel ||
      !rel.startsWith(`${pluginName}/`)
    ) {
      throw new Error(
        `${toolId}: '${pluginName}' update path '${rel}' escapes its plugin directory.`
      );
    }
    let parent = dirname(join(boundary, rel));
    while (true) {
      const resolved = await tryRealpath(fs, parent);
      if (resolved !== null) {
        if (!isStrictlyWithinUserScope(resolved, resolvedBoundary)) {
          throw new Error(
            `${toolId}: '${pluginName}' update parent '${parent}' escapes ${boundary}.`
          );
        }
        break;
      }
      if (parent === pluginDir) {
        throw new Error(`${toolId}: '${pluginName}' directory disappeared during update.`);
      }
      parent = dirname(parent);
    }
  }
}

async function tryRealpath(fs: FileReader, path: string): Promise<string | null> {
  try {
    return await fs.realpath(path);
  } catch (err) {
    if (isErrnoException(err) && err.code === "ENOENT") return null;
    throw err;
  }
}
