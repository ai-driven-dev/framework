import type { Manifest } from "../domain/manifest.js";
import type { InstalledPlugin } from "../domain/plugins/installed-plugin.js";
import type { RecordedPlugin } from "../domain/plugins/recorded-plugin.js";
import type { EnabledPluginsSection, ProjectPluginIntegration } from "./tool-sections.js";

/** The recorded plugin whose project-local integration a removal lets go of, in the manifest the
 * caller saves once it is done. */
export interface LocalIntegrationRemoval {
  readonly plugin: RecordedPlugin;
  readonly tool: ProjectPluginIntegration & EnabledPluginsSection;
  readonly projectRoot: string;
  readonly manifest: Manifest;
  /** The ref the host recorded for the plugin, when it recorded one. */
  readonly hostRef?: string;
}

/** Takes a plugin's project-scope integration out of a project: hooks, MCP entries, its enabled
 * entry and files. */
export interface ProjectIntegrationCleanup {
  assertLocalIntegrationRemovable(
    tool: ProjectPluginIntegration,
    plugin: RecordedPlugin,
    projectRoot: string
  ): Promise<void>;
  removeLocalIntegration(removal: LocalIntegrationRemoval): Promise<void>;
  deleteLocalFiles(
    tool: ProjectPluginIntegration,
    plugin: InstalledPlugin,
    projectRoot: string
  ): Promise<void>;
}
