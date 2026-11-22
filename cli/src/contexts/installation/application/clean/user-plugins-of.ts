import type { AiToolId } from "../../../../shared/domain/tool.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import type { Manifest } from "../../domain/manifest.js";
import type { InstalledPlugin } from "../../domain/plugins/installed-plugin.js";

/** The user-scope plugins a manifest tracks, each with the AI tool it was installed for. */
export function userPluginsOf(
  manifest: Manifest,
  tools: ToolCatalog
): Array<{ toolId: AiToolId; plugin: InstalledPlugin }> {
  return manifest
    .getInstalledToolIds()
    .filter((toolId) => tools.isAiTool(toolId))
    .flatMap((toolId) =>
      manifest
        .getPlugins(toolId)
        .filter((plugin) => plugin.scope === "user")
        .map((plugin) => ({ toolId, plugin }))
    );
}
