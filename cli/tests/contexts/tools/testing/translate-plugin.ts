import { createPluginTranslation } from "../../../../src/composition/translate.js";
import type { ToolProfile } from "../../../../src/contexts/tools/contract/tool-profile.js";
import type { TranslateDistributionResult } from "../../../../src/contexts/translate/application/translate-plugin-distribution.js";
import type { PluginDistribution } from "../../../../src/shared/domain/plugin/plugin-distribution.js";
import { registeredTools } from "../../../shared/testing/registered-tools.js";

/** What installing a plugin distribution for one tool writes, through the translate command the
 * composition wires for the installation. */
export function translatePlugin(
  distribution: PluginDistribution,
  tool: ToolProfile
): TranslateDistributionResult {
  return createPluginTranslation(registeredTools()).execute({ distribution, tool });
}
