import type { PluginDistribution } from "../../../../shared/domain/plugin/plugin-distribution.js";
import type {
  ArtifactContract,
  ToolBuildContract,
} from "../../../tools/contract/build-contract.js";
import { PLUGIN_SKILL_ENTRY_FILE } from "../canon-format.js";
import { flatLinkTarget } from "../flat-layout.js";
import type { OutputFile } from "../output-file.js";
import { rewriteRelativeLinks } from "../rules/links.js";
import { namedAfterFolder } from "../rules/skill-name.js";
import { assertNoToolsPlaceholder } from "../tools-placeholder.js";

type SupportedArtifact = Extract<ArtifactContract, { supported: true }>;

/** A plugin's skills as a flat tool holds them: each file where the tool's path puts it, a
 * markdown one with its links resolved from there, its entry named after its folder when the tool
 * asks for it. */
export function flatSkills(
  canon: PluginDistribution,
  contract: ToolBuildContract,
  artifact: SupportedArtifact
): OutputFile[] {
  const plugin = canon.manifest.name;
  return canon.components.skills.map(({ relativePath, content }) => {
    const flatPath = artifact.path(plugin, relativePath);
    if (!relativePath.endsWith(".md")) return { relativePath: flatPath, content };
    assertNoToolsPlaceholder(content, plugin, relativePath.slice("skills/".length));
    const rewritten = rewriteRelativeLinks(content, {
      currentFilePluginRelative: flatPath,
      resolveTargetPath: (rel) => flatLinkTarget(contract, plugin, rel),
    });
    const isEntry = relativePath.split("/").at(-1) === PLUGIN_SKILL_ENTRY_FILE;
    return {
      relativePath: flatPath,
      content:
        artifact.rewriteSkillName && isEntry ? namedAfterFolder(rewritten, flatPath) : rewritten,
    };
  });
}
