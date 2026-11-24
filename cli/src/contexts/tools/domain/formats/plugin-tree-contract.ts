import type {
  AgentMarkdown,
  ToolBuildContract,
} from "../../../../shared/domain/materialization/build-contract.js";
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
  /** The file the plugin's MCP servers go in, when the tool reads one other than `.mcp.json`. */
  readonly mcpRelative?: string;
}

function pluginTreeArtifacts(
  hooks: HooksRouting,
  agentMarkdown: AgentMarkdown,
  mcpRelative: string
): ToolBuildContract["artifacts"] {
  return {
    skills: {
      supported: true,
      source: { kind: "fullTree", srcDir: "skills" },
      placement: { kind: "relative" },
    },
    agents: {
      supported: true,
      source: { kind: "filteredTree", srcDir: "agents", inputExt: ".md" },
      placement: { kind: "relative" },
      agentMarkdown,
    },
    mcp: {
      supported: true,
      source: { kind: "configFile", srcPath: ".mcp.json" },
      placement: { kind: "file", at: mcpRelative },
    },
    hooks: pluginTreeHooksArtifact(hooks),
  };
}

/** The build contract of a tool that installs a native plugin tree: the plugin's skills, agents,
 * MCP config and hooks keep their place, and a marketplace catalog lists them. */
export function pluginTreeContract(
  hooks: HooksRouting,
  {
    manifestRelative,
    marketplaceRelative,
    agentMarkdown,
    mcpRelative = ".mcp.json",
  }: PluginTreeLayout
): ToolBuildContract {
  return {
    pluginRootToken: hooks.rootToken,
    manifestFileRelative: manifestRelative,
    synthesizeManifest: (source, presence) =>
      synthesizeSharedManifest(source, presence, {
        agentsField: true,
        hooksField: hooks.manifestNamesHooks === true,
        mcpRelative,
      }),
    manifestSchemaName: "plugin-manifest",
    artifacts: pluginTreeArtifacts(hooks, agentMarkdown, mcpRelative),
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
