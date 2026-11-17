import type { ToolProfile } from "../../../../src/contexts/tools/contract/tool-profile.js";
import {
  type TranslateDistributionResult,
  TranslatePluginDistribution,
} from "../../../../src/contexts/translate/application/translate-distribution.js";
import type { PluginDistribution } from "../../../../src/shared/domain/plugin/plugin-distribution.js";
import { registeredTools } from "../../../shared/testing/registered-tools.js";

/** What installing a plugin distribution for one tool writes, through the translate command the
 * composition hands the installation, probing every registered tool's manifest location. */
export function translatePlugin(
  distribution: PluginDistribution,
  tool: ToolProfile
): TranslateDistributionResult {
  const tools = registeredTools();
  const manifestProbes = tools.inHelpOrder("ai").flatMap((format) =>
    tools
      .aiProfile(format)
      .distributionPaths("manifest")
      .map((relativePath) => ({ format, relativePath }))
  );
  return new TranslatePluginDistribution(manifestProbes).execute({ distribution, tool });
}
