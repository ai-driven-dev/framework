import type { PluginDistribution } from "../../../../shared/domain/plugin/plugin-distribution.js";
import type { ArtifactContract } from "../../../tools/contract/build-contract.js";
import type { OutputFile } from "../output-file.js";
import { withRootToken } from "../rules/root-token.js";

type SupportedArtifact = Extract<ArtifactContract, { supported: true }>;

/** A plugin's hooks as a marketplace holds them: every file under its hooks folder, hooks.json
 * through the tool's transform, each through the tool's own plugin root and script rewrite. */
export function marketplaceHooks(
  canon: PluginDistribution,
  artifact: SupportedArtifact,
  pluginRootToken: string | undefined
): OutputFile[] {
  const plugin = canon.manifest.name;
  return canon.components.hooks.map(({ relativePath, content }) => {
    const base = relativePath.split("/").at(-1) ?? relativePath;
    const transformed =
      artifact.transform && relativePath.endsWith(".json")
        ? artifact.transform(content, plugin, base)
        : content;
    const rooted = withRootToken(transformed, pluginRootToken);
    return {
      relativePath: `plugins/${plugin}/${relativePath}`,
      content: artifact.script?.(relativePath, rooted) ?? rooted,
    };
  });
}
