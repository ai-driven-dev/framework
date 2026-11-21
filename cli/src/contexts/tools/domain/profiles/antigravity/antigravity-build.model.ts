/** Flat only. A skill sits one level under `.agents/skills/`: `agy` expands none nested deeper. */

import { genericFlatSkillPath } from "../../../../../shared/domain/materialization/flat-paths.js";
import type { AgentMarkdown, ToolBuildContract } from "../../../contract/build-contract.js";
import { flatHooksArtifact } from "../../formats/hooks/flat-routes.js";
import { portableAgentFrontmatter } from "../../formats/portable-agent.js";
import { type AntigravityHooks, mergeAntigravityHooks } from "./antigravity-hooks.model.js";

const ANTIGRAVITY_SKILLS_DIR = ".agents/skills/";
const ANTIGRAVITY_AGENTS_DIR = ".agents/agents/";

function antigravityFlatSkillPath(plugin: string, rel: string): string {
  return genericFlatSkillPath(ANTIGRAVITY_SKILLS_DIR, plugin, rel.replace(/^skills\//, ""));
}

function agentName(plugin: string, rel: string): string {
  return `${plugin}-${rel.replace(/^agents\//, "").replace(/(\.agent)?\.md$/, "")}`;
}

function antigravityFlatAgentPath(plugin: string, rel: string): string {
  return `${ANTIGRAVITY_AGENTS_DIR}${agentName(plugin, rel)}/agent.md`;
}

const antigravityAgentMarkdown: AgentMarkdown = {
  frontmatter: (frontmatter, { plugin, outName }) =>
    portableAgentFrontmatter(frontmatter, agentName(plugin, `agents/${outName}`)),
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
        path: antigravityFlatSkillPath,
        rewriteSkillName: true,
      },
      agents: {
        supported: true,
        source: { kind: "filteredTree", srcDir: "agents", inputExt: ".md" },
        path: antigravityFlatAgentPath,
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
