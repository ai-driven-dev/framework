import { createPluginTranslation } from "../../../../src/composition/contexts/translate.js";
import type { ToolProfile } from "../../../../src/contexts/tools/contract/tool-profile.js";
import type { TranslateDistributionResult } from "../../../../src/contexts/translate/application/translate-distribution.use-case.js";
import type { PluginDistribution } from "../../../../src/shared/domain/plugin/plugin-distribution.js";
import { registeredTools } from "../../../shared/testing/registered-tools.builder.js";

/** What installing a plugin distribution for one tool writes, through the translate command the
 * composition wires for the installation. */
export function translatePlugin(
  distribution: PluginDistribution,
  tool: ToolProfile
): TranslateDistributionResult {
  return createPluginTranslation(registeredTools()).execute({ distribution, tool });
}

/** What installing a plugin leaves in the project, hooks a tool keeps there included: the files the
 * install writes, then its scripts and its hooks file with the manifest merged in. */
export function translatePluginIntoProject(
  distribution: PluginDistribution,
  tool: ToolProfile
): TranslateDistributionResult {
  const result = translatePlugin(distribution, tool);
  const location = tool.kind === "ai" ? tool.projectHooksDelivery() : null;
  const { manifest, scripts } = result.projectHooks;
  if (location === null || manifest === null) return result;
  const merged = location.format.merge(null, {
    json: manifest,
    plugin: distribution.manifest.name,
  }).content;
  return {
    ...result,
    files: [...result.files, ...scripts, { relativePath: location.relativePath, content: merged }],
  };
}
