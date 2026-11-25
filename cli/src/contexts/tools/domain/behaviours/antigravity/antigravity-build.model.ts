/** Flat only. A skill sits one level under `.agents/skills/`: `agy` expands none nested deeper. */

import { agentsIn, skillsIn } from "../../../../../shared/domain/materialization/artifact-path.js";
import type {
  AgentMarkdown,
  ToolBuildContract,
} from "../../../../../shared/domain/materialization/build-contract.js";
import type { FlatArtifactLayout } from "../../../../../shared/domain/materialization/flat-paths.js";
import { portableAgentFrontmatter } from "../../formats/agents/portable-agent.js";
import { flatHooksArtifact } from "../../formats/hooks/flat-routes.js";
import { type AntigravityHooks, mergeAntigravityHooks } from "./antigravity-hooks.model.js";

/** The agy name of each Claude tool an agent may declare; a Claude tool absent from it has no agy
 * equivalent. */
export type AntigravityAgentTools = ReadonlyMap<string, string>;

/** An agy subagent holds only the tools its `tools` list names, and an unknown name may hang it.
 * No declared list means every tool, as on Claude, so it gets each name the map holds. A declared
 * Claude tool with no agy name is dropped, which narrows the grant and never widens it. Written
 * inline so an empty list stays `[]`, not a null key. */
function agyTools(declared: string[] | undefined, byClaudeTool: AntigravityAgentTools): string {
  const claudeTools = declared ?? [...byClaudeTool.keys()];
  const names = claudeTools.flatMap((tool) => byClaudeTool.get(tool) ?? []);
  return JSON.stringify([...new Set(names)]);
}

function antigravityAgentMarkdown(agentTools: AntigravityAgentTools): AgentMarkdown {
  return {
    frontmatter: (frontmatter) => {
      const { tools, ...portable } = portableAgentFrontmatter(
        frontmatter,
        String(frontmatter.name)
      );
      return { ...portable, tools: agyTools(tools, agentTools) };
    },
    pluginPrefixedName: true,
  };
}

export function buildAntigravityFlatContract(
  hooks: AntigravityHooks,
  layout: FlatArtifactLayout,
  agentTools: AntigravityAgentTools
): ToolBuildContract {
  return {
    manifestFileRelative: null,
    synthesizeManifest: null,
    manifestSchemaName: null,
    artifacts: {
      skills: {
        supported: true,
        source: { kind: "fullTree", srcDir: "skills" },
        placement: skillsIn(layout),
        rewriteSkillName: true,
      },
      agents: {
        supported: true,
        source: { kind: "filteredTree", srcDir: "agents", inputExt: ".md" },
        placement: agentsIn(layout),
        agentMarkdown: antigravityAgentMarkdown(agentTools),
      },
      mcp: { supported: false, reason: "the flat build ships no MCP file" },
      hooks: flatHooksArtifact(hooks, { tool: "antigravity" }, (existing, shipped) =>
        mergeAntigravityHooks(hooks, existing, shipped)
      ),
    },
    buildMarketplaceCatalog: null,
    buildMarketplaceEntry: null,
  };
}
