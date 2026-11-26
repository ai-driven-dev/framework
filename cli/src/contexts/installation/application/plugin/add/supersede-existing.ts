import type { AiToolId } from "../../../../../shared/domain/tool.js";
import type { ToolCatalog } from "../../../../tools/contract/tool-catalog.js";
import type { Manifest } from "../../../domain/manifest.js";
import type { AssertProjectIntegrationRemovable } from "../../removal/assert-project-integration-removable.use-case.js";
import { assertExistingContributionsUnchanged } from "./assert-existing-contributions.js";
import {
  assertNoDuplicates,
  dropExistingPlugin,
  type PreviousInstall,
  previousInstall,
} from "./existing-plugin.js";

interface ExistingPlugin {
  readonly pluginName: string;
  readonly toolIds: readonly AiToolId[];
  readonly manifest: Manifest;
  readonly projectRoot: string;
  readonly replace?: boolean;
}

/**
 * Clears the manifest of an earlier install of the plugin when the add replaces it, after checking
 * the user has not edited what it contributed; otherwise refuses a duplicate. Returns what the
 * earlier install left behind, for the new one to supersede.
 */
export async function supersedeExisting(
  assertIntegration: Pick<AssertProjectIntegrationRemovable, "execute">,
  tools: ToolCatalog,
  existing: ExistingPlugin
): Promise<PreviousInstall> {
  const { pluginName, toolIds, manifest, replace } = existing;
  if (replace === true)
    await assertExistingContributionsUnchanged(assertIntegration, tools, existing);
  const previous = previousInstall(pluginName, toolIds, manifest);
  if (replace === true) dropExistingPlugin(pluginName, toolIds, manifest);
  else assertNoDuplicates(pluginName, toolIds, manifest);
  return previous;
}
