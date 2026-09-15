import { dirname, join, posix } from "node:path";
import type { InstallationFile } from "../../../../kernel/file.js";
import type { FileReader } from "../../../../kernel/ports/file-reader.js";
import type { Logger } from "../../../../kernel/ports/logger.js";
import type { AiToolId } from "../../../../kernel/tool.js";
import { resolvePluginsCapability } from "../../../tools/domain/registry.js";
import type { InstalledPlugin } from "../../domain/plugins/installed-plugin.js";
import { isStrictlyWithinUserScope } from "../../domain/plugins/user-scope-containment.js";

/**
 * The files of a user-scope plugin that are actually safe to delete: safe only once the real,
 * `realpath`-resolved location still sits strictly inside the tool's own declared user-scope
 * directory. A `..` segment a corrupted manifest entry carries, or a plugin directory that became a
 * symlink after install, both fail this and are left in place and named.
 */
export async function userScopeFilesSafeToDelete(
  fs: FileReader,
  logger: Logger,
  plugin: InstalledPlugin,
  toolId: AiToolId,
  homedir: string
): Promise<ReadonlyMap<string, string>> {
  const boundary = resolvePluginsCapability(toolId)?.userPluginsBaseDir(homedir);
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
      allowed.set(relativePath, hash);
      continue;
    }
    logger.warn(
      `${toolId}: '${plugin.name}' file '${relativePath}' does not resolve inside ${boundary}; left in place.`
    );
  }
  return allowed;
}

/** Refuse a machine update if a new path, existing parent, or plugin directory escapes its declared base. */
export async function assertUserScopeWriteBoundary(
  fs: FileReader,
  toolId: AiToolId,
  pluginName: string,
  files: readonly InstallationFile[],
  homedir: string
): Promise<void> {
  const boundary = resolvePluginsCapability(toolId)?.userPluginsBaseDir(homedir);
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
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}
