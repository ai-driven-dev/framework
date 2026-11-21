import type { PluginDistribution } from "../../../../shared/domain/plugin/plugin-distribution.js";
import type { ArtifactContract } from "../../../tools/contract/build-contract.js";
import { PLUGIN_AGENT_INPUT_EXT } from "../canon-format.js";
import type { OutputFile } from "../output-file.js";
import { agentContent } from "../rules/agent-markdown.js";
import { assertNoToolsPlaceholder } from "../tools-placeholder.js";

type SupportedArtifact = Extract<ArtifactContract, { supported: true }>;

/** A plugin's agents as a marketplace holds them: each agent markdown file under the path the
 * tool gives its file name alone, written as the tool keeps an agent. */
export function marketplaceAgents(
  canon: PluginDistribution,
  artifact: SupportedArtifact
): OutputFile[] {
  const plugin = canon.manifest.name;
  return canon.components.agents
    .filter((file) => file.relativePath.endsWith(PLUGIN_AGENT_INPUT_EXT))
    .map(({ relativePath, content }) => {
      const base = relativePath.split("/").at(-1) ?? relativePath;
      assertNoToolsPlaceholder(content, plugin, relativePath.slice("agents/".length));
      return {
        relativePath: `plugins/${plugin}/${artifact.path(plugin, `agents/${base}`)}`,
        content: agentContent(content, artifact, {
          plugin,
          outName: base,
          from: `agents/${base}`,
          unshaped: "carry",
        }),
      };
    });
}
