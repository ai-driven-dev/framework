import type { AiToolProfile } from "../../tools/contract/tool-profile.js";
import type { InstalledPlugin } from "../domain/plugins/installed-plugin.js";

/** Takes a plugin's project-scope integration out of a project: hooks, MCP entries and files. */
export interface ProjectIntegrationCleanup {
  assertLocalIntegrationRemovable(
    tool: AiToolProfile,
    plugin: InstalledPlugin,
    projectRoot: string
  ): Promise<void>;
  removeLocalIntegration(
    tool: AiToolProfile,
    plugin: InstalledPlugin,
    projectRoot: string
  ): Promise<void>;
  deleteLocalFiles(
    tool: AiToolProfile,
    plugin: InstalledPlugin,
    projectRoot: string
  ): Promise<void>;
}
