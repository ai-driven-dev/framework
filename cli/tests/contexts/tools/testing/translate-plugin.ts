import { wireInstallation } from "../../../../src/composition/installation.js";
import { wireBase } from "../../../../src/composition/shared.js";
import type { ToolProfile } from "../../../../src/contexts/tools/contract/tool-profile.js";
import type { TranslateDistributionResult } from "../../../../src/contexts/translate/application/translate-distribution.js";
import type { PluginDistribution } from "../../../../src/shared/domain/plugin/plugin-distribution.js";
import { registeredTools } from "../../../shared/testing/registered-tools.js";

const ANY_PROJECT_ROOT = "/project";

/** What installing a plugin distribution for one tool writes, through the translate command the
 * composition wires for the installation. */
export function translatePlugin(
  distribution: PluginDistribution,
  tool: ToolProfile
): TranslateDistributionResult {
  const base = wireBase(ANY_PROJECT_ROOT, { verbose: false }, undefined, registeredTools());
  const { translate } = wireInstallation(base).builtMaterializationDeps;
  return translate.execute({ distribution, tool });
}
