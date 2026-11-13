/** Flat only: the IDE and CLI V3 read one layout, under a project's `.kiro/` and `~/.kiro/`. */

import { parseFrontmatter } from "../../../../../kernel/markdown.js";
import {
  genericFlatAgentPath,
  genericFlatSkillPath,
} from "../../../../../kernel/materialization/flat-paths.js";
import type { ToolBuildContract } from "../../build-contract.js";
import { flatHooksArtifact } from "../../formats/hooks-descriptor.js";
import { mergeVscodeMcp } from "../../formats/vscode-mcp-merge.js";
import { KIRO_HOOKS } from "./hooks.js";
import { kiroAgentFrontmatter, kiroAgentJson } from "./kiro-agent.js";
import { mergeKiroHooks } from "./kiro-hooks.js";
import { KIRO_AGENTS_DIR, KIRO_MCP_PATH, KIRO_SKILLS_DIR } from "./kiro-paths.js";

const AGENT_OUTPUT_EXT = ".json";

/** Kiro lists a skill only one level below `skills/`, so its folder carries the plugin's name. */
function kiroFlatSkillPath(plugin: string, rel: string): string {
  return genericFlatSkillPath(KIRO_SKILLS_DIR, plugin, rel.replace(/^skills\//, ""));
}

function kiroFlatAgentPath(plugin: string, rel: string): string {
  return genericFlatAgentPath(
    KIRO_AGENTS_DIR,
    plugin,
    rel.replace(/^agents\//, ""),
    AGENT_OUTPUT_EXT
  );
}

function transformKiroFlatAgent(content: string, plugin: string, outName: string): string {
  const { frontmatter, body } = parseFrontmatter(content);
  const name = `${plugin}-${outName.replace(/\.md$/, "")}`;
  return kiroAgentJson(kiroAgentFrontmatter({ ...frontmatter, name }), body);
}

export function buildKiroFlatContract(): ToolBuildContract {
  return {
    manifestFileRelative: null,
    synthesizeManifest: null,
    manifestSchemaName: null,
    artifacts: {
      skills: {
        supported: true,
        source: { kind: "fullTree", srcDir: "skills" },
        path: kiroFlatSkillPath,
        rewriteSkillName: true,
      },
      agents: {
        supported: true,
        source: { kind: "filteredTree", srcDir: "agents", inputExt: ".md" },
        path: kiroFlatAgentPath,
        transform: transformKiroFlatAgent,
      },
      mcp: {
        supported: true,
        source: { kind: "configFile", srcPath: ".mcp.json" },
        path: () => KIRO_MCP_PATH,
        merge: (existing, incoming, force) =>
          mergeVscodeMcp(existing, incoming, force, "mcpServers"),
        mcpServersKey: "mcpServers",
        mergeDest: (outDir) => `${outDir}/${KIRO_MCP_PATH}`,
      },
      hooks: flatHooksArtifact(KIRO_HOOKS, { tool: "kiro" }, mergeKiroHooks),
      rules: { supported: false },
      commands: { supported: false },
    },
    buildMarketplaceCatalog: null,
    buildMarketplaceEntry: null,
  };
}
