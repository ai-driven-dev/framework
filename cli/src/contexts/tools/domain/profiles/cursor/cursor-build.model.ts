/**
 * Cursor's build contracts: marketplace (a native plugin tree) and flat (direct workspace
 * materialization). The transforms, path computations and merges are pure functions reused from
 * `domain/formats/`; the contracts themselves are thin wiring.
 */

import {
  genericFlatAgentPath,
  genericFlatSkillPath,
} from "../../../../../shared/domain/materialization/flat-paths.js";
import type { AgentMarkdown, ToolBuildContract } from "../../../contract/build-contract.js";
import { mergeAdditiveMcp } from "../../formats/additive-mcp-merge.js";
import type { FlatHooksRoute, HooksRouting } from "../../formats/hooks/descriptor.js";
import { flatHooksArtifact } from "../../formats/hooks/flat-routes.js";
import { pluginTreeContract } from "../../formats/plugin-tree-contract.js";
import { cursorAgentFrontmatter } from "./cursor-agent.model.js";

// Distinct from their source-side equivalents even where the literals coincide: a change to
// either side must not collapse them.
const OUTPUT_CURSOR_MANIFEST_RELATIVE = ".cursor-plugin/plugin.json";
const OUTPUT_CURSOR_MARKETPLACE_RELATIVE = ".cursor-plugin/marketplace.json";

const cursorAgentMarkdown: AgentMarkdown = {
  frontmatter: (frontmatter, { plugin, outName }) =>
    cursorAgentFrontmatter({ ...frontmatter, name: `${plugin}-${outName.replace(/\.md$/, "")}` }),
  quote: "double",
};

type FlatHooks = HooksRouting & { readonly flat: FlatHooksRoute };

export function buildCursorContract(hooks: HooksRouting): ToolBuildContract {
  return pluginTreeContract(hooks, {
    manifestRelative: OUTPUT_CURSOR_MANIFEST_RELATIVE,
    marketplaceRelative: OUTPUT_CURSOR_MARKETPLACE_RELATIVE,
    agentMarkdown: cursorAgentMarkdown,
  });
}

function cursorFlatAgentPath(plugin: string, rel: string): string {
  return genericFlatAgentPath({
    agentsPrefix: ".cursor/agents/",
    plugin,
    agentBaseName: rel.replace(/^agents\//, ""),
    outputExt: ".md",
  });
}

function cursorFlatSkillPath(plugin: string, rel: string): string {
  return genericFlatSkillPath(".cursor/skills/", plugin, rel.replace(/^skills\//, ""));
}

export function buildCursorFlatContract(hooks: FlatHooks): ToolBuildContract {
  return {
    manifestFileRelative: null,
    synthesizeManifest: null,
    manifestSchemaName: null,
    artifacts: {
      skills: {
        supported: true,
        source: { kind: "fullTree", srcDir: "skills" },
        path: cursorFlatSkillPath,
        rewriteSkillName: true,
      },
      agents: {
        supported: true,
        source: { kind: "filteredTree", srcDir: "agents", inputExt: ".md" },
        path: cursorFlatAgentPath,
        agentMarkdown: cursorAgentMarkdown,
      },
      mcp: {
        supported: true,
        source: { kind: "configFile", srcPath: ".mcp.json" },
        path: () => ".cursor/mcp.json",
        merge: (existing, incoming, force) =>
          mergeAdditiveMcp(existing, incoming, { force, serversKey: "mcpServers" }),
        mcpServersKey: "mcpServers",
        mergeDest: (outDir) => `${outDir}/.cursor/mcp.json`,
      },
      hooks: flatHooksArtifact(hooks, { tool: "cursor" }),
      rules: { supported: false },
      commands: { supported: false },
    },
    buildMarketplaceCatalog: null,
    buildMarketplaceEntry: null,
  };
}
