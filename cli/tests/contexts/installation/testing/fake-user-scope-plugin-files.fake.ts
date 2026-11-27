import type { InstalledPlugin } from "../../../../src/contexts/installation/domain/plugins/installed-plugin.js";
import type { PluginPlacement } from "../../../../src/contexts/installation/ports/tool-sections.js";
import type { UserScopePluginFileRemoval } from "../../../../src/contexts/installation/ports/user-scope/user-scope-plugin-files.js";

/** User-scope plugin files proven as told and removals recorded, nothing touching a disk. */
export class FakeUserScopePluginFiles implements UserScopePluginFileRemoval {
  readonly removed: ReadonlyMap<string, string>[] = [];
  readonly provenHomes: string[] = [];

  constructor(private readonly provenByPlugin: ReadonlyMap<string, ReadonlyMap<string, string>>) {}

  async proven(
    plugin: InstalledPlugin,
    _tool: PluginPlacement,
    home: string
  ): Promise<ReadonlyMap<string, string>> {
    this.provenHomes.push(home);
    return this.provenByPlugin.get(plugin.name) ?? new Map();
  }

  async remove(files: ReadonlyMap<string, string>): Promise<void> {
    this.removed.push(files);
  }
}
