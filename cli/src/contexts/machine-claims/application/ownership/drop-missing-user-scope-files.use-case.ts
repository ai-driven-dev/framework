import { join } from "node:path";
import type { UserScopePluginFiles } from "../../ports/machine-manifest.js";
import type { UserScopeTool } from "../../ports/user-scope-tool.js";
import { type UserScopeReach, userPluginsBoundary } from "./user-scope-boundary.js";

export class DropMissingUserScopeFiles {
  constructor(private readonly reach: UserScopeReach) {}

  /** The plugin without the recorded files nothing stands at any more, which an update writes back.
   * A dangling symlink counts as gone: the atomic write replaces the link, and never follows it. */
  async execute<P extends UserScopePluginFiles<P>>(plugin: P, tool: UserScopeTool): Promise<P> {
    const { fs, home } = this.reach;
    const boundary = userPluginsBoundary(tool, home);
    if (boundary === null) return plugin;
    const present = new Map<string, string>();
    for (const [relativePath, hash] of plugin.files) {
      if (await fs.fileExists(join(boundary, relativePath))) present.set(relativePath, hash);
    }
    return plugin.withFiles(present);
  }
}
