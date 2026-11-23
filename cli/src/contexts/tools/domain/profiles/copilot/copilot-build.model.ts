/** Copilot's marketplace build contract: the OpenPlugin format. */

import type { ToolBuildContract } from "../../../contract/build-contract.js";
import type { HooksRouting } from "../../formats/hooks/descriptor.js";
import { pluginTreeContract } from "../../formats/plugin-tree-contract.js";
import { resolveDescription, resolveVersion } from "../../marketplace-catalog.js";
import { copilotAgentFrontmatter } from "./copilot-agent.model.js";

export function buildCopilotMarketplaceContract(
  hooks: HooksRouting,
  output: { readonly manifestRelative: string; readonly marketplaceRelative: string }
): ToolBuildContract {
  return {
    ...pluginTreeContract(hooks, {
      ...output,
      agentMarkdown: { frontmatter: (frontmatter) => copilotAgentFrontmatter(frontmatter) },
    }),
    manifestSchemaName: null, // Copilot does not use AJV for the plugin manifest
    buildMarketplaceCatalog: async (source, entries, _fs) => ({
      catalog: {
        name: source.name,
        metadata: {
          description: source.description,
          version: source.version,
          pluginRoot: "./plugins",
        },
        owner: source.owner,
        plugins: entries,
      },
      schemaName: "marketplace",
      destRelPath: output.marketplaceRelative,
    }),
    buildMarketplaceEntry: async ({ name, outDir, srcEntry, fs }) => {
      const source = {
        fs,
        name,
        srcEntry,
        outDir,
        outputManifestRelative: output.manifestRelative,
      };
      const version = await resolveVersion(source);
      const description = await resolveDescription(source);
      return { name, source: name, description, version };
    },
  };
}
