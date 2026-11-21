import type { PluginDistribution } from "../../../../shared/domain/plugin/plugin-distribution.js";
import type {
  ArtifactContract,
  ToolBuildContract,
} from "../../../tools/contract/build-contract.js";
import { PLUGIN_AGENT_INPUT_EXT } from "../canon-format.js";
import { flatAgentPath, flatLinkTarget } from "../flat-layout.js";
import type { OutputFile } from "../output-file.js";
import { agentContent } from "../rules/agent-markdown.js";
import { assertNoToolsPlaceholder } from "../tools-placeholder.js";

type SupportedArtifact = Extract<ArtifactContract, { supported: true }>;

/** A plugin's agents as a flat tool holds them: each agent markdown file where the tool puts its
 * file name alone, written as the tool keeps an agent, its links resolved from there. */
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
        content: agentContent(content, artifact, {
          plugin,
          outName: base,
          from: flatPath,
          resolveTarget: (rel) => flatLinkTarget(contract, plugin, rel),
          unshaped: "links",
        }),
      };
    });
}
