/**
 * Claude's build contracts: marketplace (a native plugin tree) and flat (direct workspace
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

function claudeFlatAgentPath(plugin: string, rel: string): string {
  return genericFlatAgentPath({
    agentsPrefix: ".claude/agents/",
    plugin,
    agentBaseName: rel.slice("agents/".length),
    outputExt: ".md",
  });
}

function claudeFlatSkillPath(plugin: string, rel: string): string {
  return genericFlatSkillPath(".claude/skills/", plugin, rel.slice("skills/".length));
}

const claudeAgentMarkdown: AgentMarkdown = {
  frontmatter: (frontmatter) => claudeAgentFrontmatter(frontmatter),
};

const claudeFlatAgentMarkdown: AgentMarkdown = {
  frontmatter: (frontmatter, { plugin, outName }) =>
    claudeAgentFrontmatter({ ...frontmatter, name: `${plugin}-${outName.replace(/\.md$/, "")}` }),
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
        path: claudeFlatSkillPath,
        rewriteSkillName: true,
      },
      agents: {
        supported: true,
        source: { kind: "filteredTree", srcDir: "agents", inputExt: ".md" },
        path: claudeFlatAgentPath,
        agentMarkdown: claudeFlatAgentMarkdown,
      },
      mcp: {
        supported: true,
        source: { kind: "configFile", srcPath: ".mcp.json" },
        path: () => ".mcp.json",
        merge: (existing, incoming, force) =>
          mergeAdditiveMcp(existing, incoming, { force, serversKey: "mcpServers" }),
        mcpServersKey: "mcpServers",
        mergeDest: (outDir) => `${outDir}/.mcp.json`,
      },
      hooks: flatHooksArtifact(hooks, { tool: "claude" }),
      rules: { supported: false },
      commands: { supported: false },
    },
    buildMarketplaceCatalog: null,
    buildMarketplaceEntry: null,
  };
}
