/**
 * Cursor's build contracts: marketplace (a native plugin tree) and flat (direct workspace
 * materialization). The transforms, path computations and merges are pure functions reused from
 * `domain/formats/`; the contracts themselves are thin wiring.
 */

import {
  type FlatArtifactLayout,
  flatArtifactLayout,
} from "../../../../../shared/domain/materialization/flat-paths.js";
import type { AgentMarkdown, ToolBuildContract } from "../../../contract/build-contract.js";
import type { FlatHooksRoute, HooksRouting } from "../../formats/hooks/descriptor.js";
import { flatHooksArtifact } from "../../formats/hooks/flat-routes.js";
import { pluginTreeContract } from "../../formats/plugin-tree-contract.js";
import { cursorAgentFrontmatter } from "./cursor-agent.model.js";

// Distinct from their source-side equivalents even where the literals coincide: a change to
// either side must not collapse them.
const OUTPUT_CURSOR_MANIFEST_RELATIVE = ".cursor-plugin/plugin.json";
const OUTPUT_CURSOR_MARKETPLACE_RELATIVE = ".cursor-plugin/marketplace.json";

const cursorAgentMarkdown: AgentMarkdown = {
  frontmatter: (frontmatter) => cursorAgentFrontmatter(frontmatter),
  pluginPrefixedName: true,
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

/** Where a flat build puts cursor's skills and agents. */
const CURSOR_FLAT_LAYOUT: FlatArtifactLayout = flatArtifactLayout(".cursor/", {
  skills: "single-level",
  agent: { ext: ".md" },
});

export function buildCursorFlatContract(hooks: FlatHooks): ToolBuildContract {
  return {
    manifestFileRelative: null,
    synthesizeManifest: null,
    manifestSchemaName: null,
    artifacts: {
      skills: {
        supported: true,
        source: { kind: "fullTree", srcDir: "skills" },
        layout: CURSOR_FLAT_LAYOUT,
        rewriteSkillName: true,
      },
      agents: {
        supported: true,
        source: { kind: "filteredTree", srcDir: "agents", inputExt: ".md" },
        layout: CURSOR_FLAT_LAYOUT,
        agentMarkdown: cursorAgentMarkdown,
      },
      mcp: {
        supported: true,
        source: { kind: "configFile", srcPath: ".mcp.json" },
        path: () => ".cursor/mcp.json",
        mcpServersKey: "mcpServers",
      },
      hooks: flatHooksArtifact(hooks, { tool: "cursor" }),
      rules: { supported: false },
      commands: { supported: false },
    },
    buildMarketplaceCatalog: null,
    buildMarketplaceEntry: null,
  };
}
