import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { InstalledPlugin } from "../../domain/plugins/installed-plugin.js";
import type { PluginPlacement } from "../../ports/tool-sections.js";
import type { UserPluginFileProof } from "../../ports/user-plugin-file-proof.js";
import { deletePluginFilesForTool } from "../plugin/plugin-helpers.js";

/** The files a user-scope plugin keeps under the OS home: which of them are safe to delete, and
 * their deletion. Nothing is deleted that `proven` did not first return. */
export class UserScopePluginFiles {
  constructor(
    private readonly fs: FileWriter,
    private readonly prove: UserPluginFileProof
  ) {}

  /** The plugin's tracked files proven to sit inside the user scope and to be unedited since
   * install, by relative path with their install digest. */
  proven(
    plugin: InstalledPlugin,
    tool: PluginPlacement,
    home: string
  ): Promise<ReadonlyMap<string, string>> {
    return this.prove(plugin, tool, home);
  }

  /** Deletes the given files from the user plugins directory of `tool`. */
  async remove(
    files: ReadonlyMap<string, string>,
    tool: PluginPlacement,
    projectRoot: string
  ): Promise<void> {
    await deletePluginFilesForTool(files, "user", tool, projectRoot, this.fs, "user");
  }
}
