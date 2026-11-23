import { dirname, join, posix } from "node:path";
import { isStrictlyWithin } from "../../../../shared/domain/paths.model.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import {
  NoUserPluginsDirectoryError,
  PluginDirectoryDisappearedError,
  PluginDirectoryOutsideBoundaryError,
  UpdateParentEscapesBoundaryError,
  UpdatePathEscapesPluginError,
} from "../../contract/machine-claims.error.js";
import type { UserScopeTool } from "../../ports/user-scope-tool.js";
import {
  tryRealpath,
  type UserScopeReach,
  type UserScopeWrite,
  userPluginsBoundary,
} from "./user-scope-boundary.js";

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
      if (!isStrictlyWithin(resolved, resolvedBoundary)) {
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

export class AssertUserScopeWriteBoundary {
  constructor(private readonly reach: UserScopeReach) {}

  async execute(tool: UserScopeTool, write: UserScopeWrite): Promise<void> {
    const { fs, home } = this.reach;
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
      !isStrictlyWithin(resolvedPluginDir, resolvedBoundary)
    ) {
      throw new PluginDirectoryOutsideBoundaryError(toolId, pluginName, boundary);
    }
    const location = { toolId, pluginName, boundary, resolvedBoundary };
    for (const { relativePath } of write.files) {
      assertWithinPluginDirectory(write, tool, relativePath);
      await assertParentInside(fs, location, { pluginDir, path: join(boundary, relativePath) });
    }
  }
}
