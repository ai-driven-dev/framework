import type { PluginDistribution } from "../../../../shared/domain/plugin/plugin-distribution.js";
import type { ArtifactContract } from "../../../tools/contract/build-contract.js";
import { rewritePluginRootToken } from "../../../tools/contract/plugin-root-token.js";
import { PLUGIN_MCP_RELATIVE } from "../canon-format.js";
import type { OutputFile } from "../output-file.js";

type SupportedArtifact = Extract<ArtifactContract, { supported: true }>;

/** A plugin's mcp declaration as a marketplace holds it: at the plugin's root, through the tool's
 * transform and its own plugin root. */
export function marketplaceMcp(
  canon: PluginDistribution,
  artifact: SupportedArtifact,
  pluginRootToken: string | undefined
): OutputFile[] {
  const plugin = canon.manifest.name;
  return canon.components.mcp.map(({ content }) => {
    const transformed = artifact.transform
      ? artifact.transform(content, plugin, PLUGIN_MCP_RELATIVE)
      : content;
    return {
      relativePath: `plugins/${plugin}/${PLUGIN_MCP_RELATIVE}`,
      content: pluginRootToken ? rewritePluginRootToken(transformed, pluginRootToken) : transformed,
    };
  });
}
