import type { InstalledPlugin } from "../domain/plugins/installed-plugin.js";
import type { RecordedPlugin } from "../domain/plugins/recorded-plugin.js";
import type { ProjectPluginIntegration } from "./tool-sections.js";

/** Takes a plugin's project-scope integration out of a project: hooks, MCP entries and files. */
export interface ProjectIntegrationCleanup {
  assertLocalIntegrationRemovable(
    tool: ProjectPluginIntegration,
    plugin: RecordedPlugin,
    projectRoot: string
  ): Promise<void>;
  removeLocalIntegration(
    tool: ProjectPluginIntegration,
    plugin: RecordedPlugin,
    projectRoot: string
  ): Promise<void>;
  deleteLocalFiles(
    tool: ProjectPluginIntegration,
    plugin: InstalledPlugin,
    projectRoot: string
  ): Promise<void>;
}
