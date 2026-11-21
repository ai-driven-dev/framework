import type { AgentMarkdown, ToolBuildContract } from "../../contract/build-contract.js";
import {
  buildSharedEntry,
  buildSharedMarketplace,
  synthesizeSharedManifest,
} from "../marketplace-catalog.js";
import type { HooksRouting } from "./hooks/descriptor.js";
import { pluginTreeHooksArtifact } from "./hooks/routes.js";

interface PluginTreeLayout {
  readonly manifestRelative: string;
  readonly marketplaceRelative: string;
  readonly agentMarkdown: AgentMarkdown;
}

function pluginTreeArtifacts(
  hooks: HooksRouting,
  agentMarkdown: AgentMarkdown
): ToolBuildContract["artifacts"] {
  return {
    skills: {
      supported: true,
      source: { kind: "fullTree", srcDir: "skills" },
      path: (_p, rel) => rel,
    },
    agents: {
      supported: true,
      source: { kind: "filteredTree", srcDir: "agents", inputExt: ".md" },
      path: (_p, rel) => rel,
      agentMarkdown,
    },
    mcp: {
      supported: true,
      source: { kind: "configFile", srcPath: ".mcp.json" },
      path: () => ".mcp.json",
    },
    hooks: pluginTreeHooksArtifact(hooks),
    rules: { supported: false },
    commands: { supported: false },
  };
}

/** The build contract of a tool that installs a native plugin tree: the plugin's skills, agents,
 * MCP config and hooks keep their place, and a marketplace catalog lists them. */
export function pluginTreeContract(
  hooks: HooksRouting,
  { manifestRelative, marketplaceRelative, agentMarkdown }: PluginTreeLayout
): ToolBuildContract {
  return {
    pluginRootToken: hooks.rootToken,
    manifestFileRelative: manifestRelative,
    synthesizeManifest: (source, presence) =>
      synthesizeSharedManifest(source, presence, {
        agentsField: true,
        hooksField: hooks.manifestNamesHooks === true,
      }),
    manifestSchemaName: "plugin-manifest",
    artifacts: pluginTreeArtifacts(hooks, agentMarkdown),
    buildMarketplaceCatalog: async (source, entries, _fs) => ({
      catalog: buildSharedMarketplace(
        source as Parameters<typeof buildSharedMarketplace>[0],
        entries
      ),
      schemaName: "claude-marketplace",
      destRelPath: marketplaceRelative,
    }),
    buildMarketplaceEntry: async ({ name, outDir, srcEntry, fs }) =>
      buildSharedEntry({ fs, name, srcEntry, outDir, outputManifestRelative: manifestRelative }),
  };
}
