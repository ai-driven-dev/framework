import type { InstalledPlugin } from "../domain/plugins/installed-plugin.js";
import type { PluginPlacement } from "./tool-sections.js";

/** The files of a user-scope plugin that are safe to delete, by relative path with their install
 * digest: those still inside the tool's own user directory and unedited since install. */
export type UserPluginFileProof = (
  plugin: InstalledPlugin,
  tool: PluginPlacement,
  home: string
) => Promise<ReadonlyMap<string, string>>;
