/** Copilot's marketplace build contract: the OpenPlugin format. */

import type { ToolBuildContract } from "../../../../../shared/domain/materialization/build-contract.js";
import type { HooksRouting } from "../../formats/hooks/descriptor.js";
import { pluginTreeContract } from "../../formats/plugin-tree-contract.js";
import { resolveDescription, resolveVersion } from "../../marketplace-catalog.js";

export function buildCopilotMarketplaceContract(
  hooks: HooksRouting,
  output: Parameters<typeof pluginTreeContract>[1]
): ToolBuildContract {
  return {
    ...pluginTreeContract(hooks, output),
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
