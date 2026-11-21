import { parseFrontmatter, serializeFrontmatter } from "../../../../shared/domain/markdown.js";
import { rewriteRelativeLinks } from "../../../../shared/domain/materialization/relative-link-rewrite.js";
import type { PluginDistribution } from "../../../../shared/domain/plugin/plugin-distribution.js";
import type {
  ArtifactContract,
  ToolBuildContract,
} from "../../../tools/contract/build-contract.js";
import { PLUGIN_AGENT_INPUT_EXT } from "../canon-format.js";
import { flatAgentPath, flatLinkTarget } from "../flat-layout.js";
import type { OutputFile } from "../output-file.js";
import { assertNoToolsPlaceholder } from "../tools-placeholder.js";

type SupportedArtifact = Extract<ArtifactContract, { supported: true }>;

/** A plugin's agents as a flat tool holds them: each agent markdown file where the tool puts its
 * file name alone, through the tool's transform, or else with the links of its body resolved
 * from there. */
export function flatAgents(
  canon: PluginDistribution,
  contract: ToolBuildContract,
  artifact: SupportedArtifact
): OutputFile[] {
  const plugin = canon.manifest.name;
  return canon.components.agents
    .filter((file) => file.relativePath.endsWith(PLUGIN_AGENT_INPUT_EXT))
    .map(({ relativePath, content }) => {
      const base = relativePath.split("/").at(-1) ?? relativePath;
      assertNoToolsPlaceholder(content, plugin, relativePath);
      const flatPath = flatAgentPath(artifact, plugin, base);
      return {
        relativePath: flatPath,
        content: artifact.transform
          ? artifact.transform(content, plugin, base)
          : withResolvedLinks(content, flatPath, (rel) => flatLinkTarget(contract, plugin, rel)),
      };
    });
}

function withResolvedLinks(
  content: string,
  flatPath: string,
  resolveTargetPath: (rel: string) => string
): string {
  const { frontmatter, body } = parseFrontmatter(content);
  return serializeFrontmatter(
    frontmatter,
    rewriteRelativeLinks(body, { currentFilePluginRelative: flatPath, resolveTargetPath })
  );
}
