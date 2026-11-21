/** Flat only. A skill sits one level under `.agents/skills/`: `agy` expands none nested deeper. */

import { parseFrontmatter, serializeFrontmatter } from "../../../../../shared/domain/markdown.js";
import { genericFlatSkillPath } from "../../../../../shared/domain/materialization/flat-paths.js";
import { rewriteRelativeLinks } from "../../../../../shared/domain/materialization/relative-link-rewrite.js";
import type { ToolBuildContract } from "../../../contract/build-contract.js";
import { flatTargetsOf } from "../../formats/flat-targets.js";
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

const resolveTarget = flatTargetsOf(antigravityFlatAgentPath, antigravityFlatSkillPath);

function transformAntigravityAgent(content: string, plugin: string, outName: string): string {
  const { frontmatter, body } = parseFrontmatter(content);
  const rel = `agents/${outName}`;
  const rewrittenBody = rewriteRelativeLinks(body, {
    currentFilePluginRelative: antigravityFlatAgentPath(plugin, rel),
    resolveTargetPath: (target) => resolveTarget(plugin, target),
  });
  return serializeFrontmatter(
    portableAgentFrontmatter(frontmatter, agentName(plugin, rel)),
    rewrittenBody
  );
}

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
        transform: transformAntigravityAgent,
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
