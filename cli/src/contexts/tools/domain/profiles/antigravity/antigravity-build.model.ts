/** Flat only. A skill sits one level under `.agents/skills/`: `agy` expands none nested deeper. */

import {
  type FlatArtifactLayout,
  flatArtifactLayout,
} from "../../../../../shared/domain/materialization/flat-paths.js";
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
        layout: ANTIGRAVITY_FLAT_LAYOUT,
        rewriteSkillName: true,
      },
      agents: {
        supported: true,
        source: { kind: "filteredTree", srcDir: "agents", inputExt: ".md" },
        layout: ANTIGRAVITY_FLAT_LAYOUT,
        agentMarkdown: antigravityAgentMarkdown,
      },
      mcp: { supported: false },
      hooks: flatHooksArtifact(hooks, { tool: "antigravity" }, (existing, shipped) =>
        mergeAntigravityHooks(hooks, existing, shipped)
      ),
      rules: { supported: false },
      commands: { supported: false },
    },
    buildMarketplaceCatalog: null,
    buildMarketplaceEntry: null,
  };
}
