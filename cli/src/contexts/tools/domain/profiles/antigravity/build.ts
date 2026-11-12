/** Flat only. A skill sits one level under `.agents/skills/`: `agy` expands none nested deeper. */

import { parseFrontmatter, serializeFrontmatter } from "../../../../../kernel/markdown.js";
import { genericFlatSkillPath } from "../../../../../kernel/materialization/flat-paths.js";
import { rewriteRelativeLinks } from "../../../../../kernel/materialization/relative-link-rewrite.js";
import type { ToolBuildContract } from "../../../contract/build-contract.js";
import { flatHooksArtifact } from "../../formats/hooks-descriptor.js";
import { portableAgentFrontmatter } from "../../formats/portable-agent.js";
import { mergeAntigravityHooks } from "./antigravity-hooks.js";
import { ANTIGRAVITY_AGENTS_DIR, ANTIGRAVITY_SKILLS_DIR } from "./antigravity-paths.js";
import { ANTIGRAVITY_HOOKS } from "./hooks.js";

function antigravityFlatSkillPath(plugin: string, rel: string): string {
  return genericFlatSkillPath(ANTIGRAVITY_SKILLS_DIR, plugin, rel.replace(/^skills\//, ""));
}

function agentName(plugin: string, rel: string): string {
  return `${plugin}-${rel.replace(/^agents\//, "").replace(/(\.agent)?\.md$/, "")}`;
}

function antigravityFlatAgentPath(plugin: string, rel: string): string {
  return `${ANTIGRAVITY_AGENTS_DIR}${agentName(plugin, rel)}/agent.md`;
}

function resolveTarget(plugin: string, rel: string): string {
  if (rel.startsWith("agents/")) return antigravityFlatAgentPath(plugin, rel);
  if (rel.startsWith("skills/")) return antigravityFlatSkillPath(plugin, rel);
  return rel;
}

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

export function buildAntigravityFlatContract(): ToolBuildContract {
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
      hooks: flatHooksArtifact(ANTIGRAVITY_HOOKS, { tool: "antigravity" }, mergeAntigravityHooks),
      rules: { supported: false },
      commands: { supported: false },
    },
    buildMarketplaceCatalog: null,
    buildMarketplaceEntry: null,
  };
}
