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

const antigravityAgentMarkdown: AgentMarkdown = {
  frontmatter: (frontmatter) => portableAgentFrontmatter(frontmatter, String(frontmatter.name)),
  pluginPrefixedName: true,
};

export function buildAntigravityFlatContract(
  hooks: AntigravityHooks,
  layout: FlatArtifactLayout
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
        agentMarkdown: antigravityAgentMarkdown,
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
