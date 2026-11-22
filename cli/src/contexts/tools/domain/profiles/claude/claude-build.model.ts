/**
 * Claude's build contracts: marketplace (a native plugin tree) and flat (direct workspace
 * materialization). The transforms, path computations and merges are pure functions reused from
 * `domain/formats/`; the contracts themselves are thin wiring.
 */

import {
  type FlatArtifactLayout,
  flatArtifactLayout,
} from "../../../../../shared/domain/materialization/flat-paths.js";
import { agentsIn, skillsIn } from "../../../contract/artifact-path.js";
import type { AgentMarkdown, ToolBuildContract } from "../../../contract/build-contract.js";
import type { FlatHooksRoute, HooksRouting } from "../../formats/hooks/descriptor.js";
import { flatHooksArtifact } from "../../formats/hooks/flat-routes.js";
import { pluginTreeContract } from "../../formats/plugin-tree-contract.js";
import { claudeAgentFrontmatter } from "./claude-agent.model.js";

/** Build output paths, deliberately distinct from the source-side constants even where the
 * literal values coincide: a change to either side must not collapse them. */
const OUTPUT_CLAUDE_MANIFEST_RELATIVE = ".claude-plugin/plugin.json";
const OUTPUT_CLAUDE_MARKETPLACE_RELATIVE = ".claude-plugin/marketplace.json";

type FlatHooks = HooksRouting & { readonly flat: FlatHooksRoute };

export function buildClaudeContract(hooks: HooksRouting): ToolBuildContract {
  return pluginTreeContract(hooks, {
    manifestRelative: OUTPUT_CLAUDE_MANIFEST_RELATIVE,
    marketplaceRelative: OUTPUT_CLAUDE_MARKETPLACE_RELATIVE,
    agentMarkdown: claudeAgentMarkdown,
  });
}

/** Where a flat build puts claude's skills and agents. */
const CLAUDE_FLAT_LAYOUT: FlatArtifactLayout = flatArtifactLayout(".claude/", {
  skills: "single-level",
  agent: { ext: ".md" },
});

const claudeAgentMarkdown: AgentMarkdown = {
  frontmatter: (frontmatter) => claudeAgentFrontmatter(frontmatter),
};

const claudeFlatAgentMarkdown: AgentMarkdown = {
  frontmatter: (frontmatter) => claudeAgentFrontmatter(frontmatter),
  pluginPrefixedName: true,
};

export function buildClaudeFlatContract(hooks: FlatHooks): ToolBuildContract {
  return {
    manifestFileRelative: null,
    synthesizeManifest: null,
    manifestSchemaName: null,
    artifacts: {
      skills: {
        supported: true,
        source: { kind: "fullTree", srcDir: "skills" },
        placement: skillsIn(CLAUDE_FLAT_LAYOUT),
        rewriteSkillName: true,
      },
      agents: {
        supported: true,
        source: { kind: "filteredTree", srcDir: "agents", inputExt: ".md" },
        placement: agentsIn(CLAUDE_FLAT_LAYOUT),
        agentMarkdown: claudeFlatAgentMarkdown,
      },
      mcp: {
        supported: true,
        source: { kind: "configFile", srcPath: ".mcp.json" },
        placement: { kind: "file", at: ".mcp.json" },
        mcpServersKey: "mcpServers",
      },
      hooks: flatHooksArtifact(hooks, { tool: "claude" }),
    },
    buildMarketplaceCatalog: null,
    buildMarketplaceEntry: null,
  };
}
