import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
// biome-ignore lint/plugin: hands the profile to the plugin translation pipeline; it narrows when installation declares its own profile input
import type { AiToolProfile } from "../../../tools/contract/tool-profile.js";
import type { InstalledPlugin } from "../../domain/plugins/installed-plugin.js";
import type { PluginPlacement } from "../../ports/tool-sections.js";
import type { UserScopePluginFileRemoval } from "../../ports/user-scope/user-scope-plugin-files.js";
import { syncUserRules } from "../materialize/listed-rules/list-user-rules.js";
import { deletePluginFilesForTool } from "../plugin/files/delete-plugin-files.js";

/** The files a user-scope plugin keeps under the OS home: which of them are safe to delete, and
 * their deletion. Nothing is deleted that `proven` did not first return. */
export class UserScopePluginFiles implements UserScopePluginFileRemoval {
  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly prove: UserScopePluginFileRemoval["proven"]
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
    tool: AiToolProfile,
    { projectRoot, home, plugin }: { projectRoot: string; home: string; plugin: string }
  ): Promise<void> {
    await deletePluginFilesForTool(
      { files, scope: "user", tool, projectRoot, ownerScope: "user", homedir: () => home },
      this.fs
    );
    const baseDir = tool.plugins()?.userPluginsBaseDir(home);
    if (baseDir == null) return;
    await syncUserRules(this.fs, { tool, baseDir, home, plugin, files: [] });
  }
}
