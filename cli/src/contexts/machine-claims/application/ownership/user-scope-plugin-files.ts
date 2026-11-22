import { dirname, join, posix } from "node:path";
import { FileHash } from "../../../../shared/domain/file-hash.js";
import type { InstallationFile } from "../../../../shared/domain/installation-file.js";
import { whenAbsent } from "../../../../shared/domain/reading/json-file.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { Logger } from "../../../../shared/ports/logger.js";
import {
  EditedAfterInstallError,
  NoUserPluginsDirectoryError,
  PluginDirectoryDisappearedError,
  PluginDirectoryOutsideBoundaryError,
  UnprovenInstallDigestError,
  UpdateParentEscapesBoundaryError,
  UpdatePathEscapesPluginError,
} from "../../domain/machine-claims.error.js";
import { isStrictlyWithinUserScope } from "../../domain/user-scope-containment.js";
import type { UserScopePluginFiles } from "../../ports/machine-manifest.js";
import type { UserScopeTool } from "../../ports/user-scope-tool.js";

/** The disk a machine-scope plugin is judged on, and the home its user plugins directory sits under. */
export interface UserScopeReach {
  readonly fs: FileReader;
  readonly home: string;
}

/** A reach that also says why a file is left in place. */
export interface ReportingUserScopeReach extends UserScopeReach {
  readonly logger: Logger;
}

/** The files an update is about to write into one plugin's directory. */
export interface UserScopeWrite {
  readonly pluginName: string;
  readonly files: readonly InstallationFile[];
}

function userPluginsBoundary(tool: UserScopeTool, home: string): string | null {
  return tool.plugins()?.userPluginsBaseDir(home) ?? null;
}

/** A recorded file is deletable only while its content still matches the digest recorded at install. */
async function assertUnedited(
  { fs, tool }: { fs: FileReader; tool: UserScopeTool },
  plugin: UserScopePluginFiles<unknown>,
  file: { path: string; relativePath: string; hash: string }
): Promise<void> {
  if (!FileHash.isDigest(file.hash)) {
    throw new UnprovenInstallDigestError(tool.toolId, plugin.name, file.relativePath);
  }
  const current = await fs.readFileHash(file.path);
  if (current.value !== file.hash) {
    throw new EditedAfterInstallError(tool.toolId, plugin.name, file.relativePath);
  }
}

/**
 * The files of a user-scope plugin that are actually safe to delete: safe only once the real,
 * `realpath`-resolved location still sits strictly inside the tool's own declared user-scope
 * directory and its current content still matches the recorded install digest. A `..` segment,
 * symlink escape, unreadable file, or user edit refuses a destructive operation before claim detach.
 */
export async function userScopeFilesSafeToDelete(
  { fs, logger, home }: ReportingUserScopeReach,
  plugin: UserScopePluginFiles<unknown>,
  tool: UserScopeTool
): Promise<ReadonlyMap<string, string>> {
  const boundary = userPluginsBoundary(tool, home);
  if (boundary === null) return new Map();
  const resolvedBoundary = await tryRealpath(fs, boundary);
  if (resolvedBoundary === null) return new Map();
  const allowed = new Map<string, string>();
  for (const [relativePath, hash] of plugin.files) {
    const path = join(boundary, relativePath);
    const resolved = await tryRealpath(fs, path);
    if (resolved === null || !isStrictlyWithinUserScope(resolved, resolvedBoundary)) {
      logger.warn(
        `${tool.toolId}: '${plugin.name}' file '${relativePath}' does not resolve inside ${boundary}; left in place.`
      );
      continue;
    }
    await assertUnedited({ fs, tool }, plugin, { path, relativePath, hash });
    allowed.set(relativePath, hash);
  }
  return allowed;
}

/** The plugin without the recorded files nothing stands at any more, which an update writes back.
 * A dangling symlink counts as gone: the atomic write replaces the link, and never follows it. */
export async function withoutMissingFiles<P extends UserScopePluginFiles<P>>(
  { fs, home }: UserScopeReach,
  plugin: P,
  tool: UserScopeTool
): Promise<P> {
  const boundary = userPluginsBoundary(tool, home);
  if (boundary === null) return plugin;
  const present = new Map<string, string>();
  for (const [relativePath, hash] of plugin.files) {
    if (await fs.fileExists(join(boundary, relativePath))) present.set(relativePath, hash);
  }
  return plugin.withFiles(present);
}

function assertWithinPluginDirectory(
  { pluginName }: UserScopeWrite,
  tool: UserScopeTool,
  rel: string
) {
  if (
    posix.isAbsolute(rel) ||
    rel.includes("\\") ||
    posix.normalize(rel) !== rel ||
    !rel.startsWith(`${pluginName}/`)
  ) {
    throw new UpdatePathEscapesPluginError(tool.toolId, pluginName, rel);
  }
}

/** The nearest existing parent of a new file must still sit inside the boundary. */
async function assertParentInside(
  fs: FileReader,
  location: { toolId: string; pluginName: string; boundary: string; resolvedBoundary: string },
  file: { pluginDir: string; path: string }
): Promise<void> {
  const { toolId, pluginName, boundary, resolvedBoundary } = location;
  let parent = dirname(file.path);
  while (true) {
    const resolved = await tryRealpath(fs, parent);
    if (resolved !== null) {
      if (!isStrictlyWithinUserScope(resolved, resolvedBoundary)) {
        throw new UpdateParentEscapesBoundaryError(toolId, pluginName, parent, boundary);
      }
      return;
    }
    if (parent === file.pluginDir) {
      throw new PluginDirectoryDisappearedError(toolId, pluginName);
    }
    parent = dirname(parent);
  }
}

/** Refuse a machine update if a new path, existing parent, or plugin directory escapes its declared base. */
export async function assertUserScopeWriteBoundary(
  { fs, home }: UserScopeReach,
  tool: UserScopeTool,
  write: UserScopeWrite
): Promise<void> {
  const { toolId } = tool;
  const { pluginName } = write;
  const boundary = userPluginsBoundary(tool, home);
  if (boundary === null) throw new NoUserPluginsDirectoryError(toolId);
  const resolvedBoundary = await tryRealpath(fs, boundary);
  const pluginDir = join(boundary, pluginName);
  const resolvedPluginDir = await tryRealpath(fs, pluginDir);
  if (
    resolvedBoundary === null ||
    resolvedPluginDir === null ||
    !isStrictlyWithinUserScope(resolvedPluginDir, resolvedBoundary)
  ) {
    throw new PluginDirectoryOutsideBoundaryError(toolId, pluginName, boundary);
  }
  const location = { toolId, pluginName, boundary, resolvedBoundary };
  for (const { relativePath } of write.files) {
    assertWithinPluginDirectory(write, tool, relativePath);
    await assertParentInside(fs, location, { pluginDir, path: join(boundary, relativePath) });
  }
}

async function tryRealpath(fs: FileReader, path: string): Promise<string | null> {
  return whenAbsent(() => fs.realpath(path), null);
}
