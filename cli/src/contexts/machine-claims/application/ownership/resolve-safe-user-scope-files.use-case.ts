import { join } from "node:path";
import { FileHash } from "../../../../shared/domain/file-hash.js";
import { isStrictlyWithin } from "../../../../shared/domain/paths.model.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import {
  EditedAfterInstallError,
  UnprovenInstallDigestError,
} from "../../domain/machine-claims.error.js";
import type { UserScopePluginFiles } from "../../ports/machine-manifest.js";
import type { UserScopeTool } from "../../ports/user-scope-tool.js";
import {
  type ReportingUserScopeReach,
  tryRealpath,
  userPluginsBoundary,
} from "./user-scope-boundary.js";

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
  if (!current.equals(new FileHash(file.hash))) {
    throw new EditedAfterInstallError(tool.toolId, plugin.name, file.relativePath);
  }
}

export class ResolveSafeUserScopeFiles {
  constructor(private readonly reach: ReportingUserScopeReach) {}

  /**
   * The files of a user-scope plugin that are actually safe to delete: safe only once the real,
   * `realpath`-resolved location still sits strictly inside the tool's own declared user-scope
   * directory and its current content still matches the recorded install digest. A `..` segment,
   * symlink escape, unreadable file, or user edit refuses a destructive operation before claim detach.
   */
  async execute(
    plugin: UserScopePluginFiles<unknown>,
    tool: UserScopeTool
  ): Promise<ReadonlyMap<string, string>> {
    const { fs, logger, home } = this.reach;
    const boundary = userPluginsBoundary(tool, home);
    if (boundary === null) return new Map();
    const resolvedBoundary = await tryRealpath(fs, boundary);
    if (resolvedBoundary === null) return new Map();
    const allowed = new Map<string, string>();
    for (const [relativePath, hash] of plugin.files) {
      const path = join(boundary, relativePath);
      const resolved = await tryRealpath(fs, path);
      if (resolved === null || !isStrictlyWithin(resolved, resolvedBoundary)) {
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
}
