import type { AiToolId } from "../../../../../shared/domain/tool.js";
import type { FileReader } from "../../../../../shared/ports/file-reader.js";
import type { ToolCatalog } from "../../../../tools/contract/tool-catalog.js";
import type { Manifest } from "../../../domain/manifest.js";
import { assertProjectMcpEntriesRemovable } from "../../removal/remove-project-plugin.js";
import { assertProjectHooksRemovable } from "../../shared/remove-project-hooks.js";

/** An add that replaces a plugin may not clobber MCP entries or hooks the user edited since. */
export async function assertExistingContributionsUnchanged(
  fs: FileReader,
  tools: ToolCatalog,
  existing: {
    pluginName: string;
    toolIds: readonly AiToolId[];
    manifest: Manifest;
    projectRoot: string;
  }
): Promise<void> {
  const { pluginName, toolIds, manifest, projectRoot } = existing;
  for (const toolId of toolIds) {
    const previous = manifest
      .getRecordedPlugins(toolId)
      .find(({ plugin }) => plugin.name === pluginName);
    if (previous === undefined) continue;
    const tool = tools.aiProfile(toolId);
    await assertProjectMcpEntriesRemovable(fs, { plugin: previous, tool, projectRoot });
    await assertProjectHooksRemovable({ fs, plugin: previous, tool, projectRoot });
  }
}
