/** Flat only. A skill sits one level under `.agents/skills/`: `agy` expands none nested deeper. */

import {
  type FlatArtifactLayout,
  flatArtifactLayout,
} from "../../../../../shared/domain/materialization/flat-paths.js";
import { agentsIn, skillsIn } from "../../../contract/artifact-path.js";
import type { AgentMarkdown, ToolBuildContract } from "../../../contract/build-contract.js";
import { flatHooksArtifact } from "../../formats/hooks/flat-routes.js";
import { portableAgentFrontmatter } from "../../formats/portable-agent.js";
import { type AntigravityHooks, mergeAntigravityHooks } from "./antigravity-hooks.model.js";

/** Where a flat build, and a flat install, put antigravity's skills and agents. */
export const ANTIGRAVITY_FLAT_LAYOUT: FlatArtifactLayout = flatArtifactLayout(".agents/", {
  skills: "single-level",
  agent: { folderFile: "agent.md" },
});

const antigravityAgentMarkdown: AgentMarkdown = {
  frontmatter: (frontmatter) => portableAgentFrontmatter(frontmatter, String(frontmatter.name)),
  pluginPrefixedName: true,
};

export function buildAntigravityFlatContract(hooks: AntigravityHooks): ToolBuildContract {
  return {
    manifestFileRelative: null,
    synthesizeManifest: null,
    manifestSchemaName: null,
    artifacts: {
      skills: {
        supported: true,
        source: { kind: "fullTree", srcDir: "skills" },
        placement: skillsIn(ANTIGRAVITY_FLAT_LAYOUT),
        rewriteSkillName: true,
      },
      agents: {
        supported: true,
        source: { kind: "filteredTree", srcDir: "agents", inputExt: ".md" },
        placement: agentsIn(ANTIGRAVITY_FLAT_LAYOUT),
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
