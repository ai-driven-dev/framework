import type { AiToolId } from "../../../../../shared/domain/tool.js";
import type { ToolCatalog } from "../../../../tools/contract/tool-catalog.js";
import type { Manifest } from "../../../domain/manifest.js";
import type { AssertProjectIntegrationRemovable } from "../../removal/assert-project-integration-removable.use-case.js";

/** An add that replaces a plugin may not clobber MCP entries or hooks the user edited since. */
export async function assertExistingContributionsUnchanged(
  assertIntegration: Pick<AssertProjectIntegrationRemovable, "execute">,
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
    await assertIntegration.execute({ plugin: previous, tool, projectRoot });
  }
}
