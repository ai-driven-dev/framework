import type { PluginDistribution } from "../../../../shared/domain/plugin/plugin-distribution.js";
import type { ArtifactContract } from "../../../tools/contract/build-contract.js";
import { PLUGIN_SKILL_ENTRY_FILE } from "../canon-format.js";
import type { OutputFile } from "../output-file.js";
import { rewriteRelativeLinks } from "../rules/links.js";
import { assertNoToolsPlaceholder } from "../tools-placeholder.js";

type SupportedArtifact = Extract<ArtifactContract, { supported: true }>;

/** A plugin's skills as a marketplace holds them: each file under the plugin's own skills folder,
 * a markdown one with its relative links rewritten and its entry file through the tool's
 * transform, any other carried untouched. */
export function marketplaceSkills(
  canon: PluginDistribution,
  artifact: SupportedArtifact
): OutputFile[] {
  const plugin = canon.manifest.name;
  return canon.components.skills.map(({ relativePath, content }) => {
    const inSkills = relativePath.slice("skills/".length);
    const destination = `plugins/${plugin}/${relativePath}`;
    if (!relativePath.endsWith(".md")) return { relativePath: destination, content };
    assertNoToolsPlaceholder(content, plugin, inSkills);
    const rewritten = rewriteRelativeLinks(content, { currentFilePluginRelative: relativePath });
    const isEntry = relativePath.split("/").at(-1) === PLUGIN_SKILL_ENTRY_FILE;
    return {
      relativePath: destination,
      content:
        isEntry && artifact.transform
          ? artifact.transform(rewritten, plugin, PLUGIN_SKILL_ENTRY_FILE)
          : rewritten,
    };
  });
}
