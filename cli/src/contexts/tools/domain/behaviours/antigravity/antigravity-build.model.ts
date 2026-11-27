/** Flat only. A skill sits one level under `.agents/skills/`: `agy` expands none nested deeper. */

import {
  agentsIn,
  flatMcpFileArtifact,
  rulesArtifact,
  skillsIn,
} from "../../../../../shared/domain/materialization/artifact-path.js";
import type {
  AgentMarkdown,
  ToolBuildContract,
} from "../../../../../shared/domain/materialization/build-contract.js";
import type { FlatArtifactLayout } from "../../../../../shared/domain/materialization/flat-paths.js";
import type { AgentFrontmatter } from "../../formats/agents/agent-format.js";
import { portableAgentFrontmatter } from "../../formats/agents/portable-agent.js";
import { flatHooksArtifact } from "../../formats/hooks/flat-routes.js";
import { hostToolNames } from "../../formats/host-tool-names.js";
import { pluginTreeContract } from "../../formats/plugin-tree-contract.js";
import { activationTriggersRule } from "../../formats/rule-frontmatter.js";
import {
  type AntigravityHooks,
  antigravityPluginHooks,
  mergeAntigravityHooks,
} from "./antigravity-hooks.model.js";

/** The agy name of each Claude tool an agent may declare; a Claude tool absent from it has no agy
 * equivalent. */
export type AntigravityAgentTools = ReadonlyMap<string, string>;

/** An agy subagent holds only the tools its `tools` list names, and an unknown name may hang it.
 * No declared list means every tool, as on Claude, so it gets each name the map holds. A declared
 * Claude tool with no agy name is dropped, which narrows the grant and never widens it. Written
 * inline so an empty list stays `[]`, not a null key. */
function agyTools(declared: string[] | undefined, byClaudeTool: AntigravityAgentTools): string {
  const claudeTools = declared ?? [...byClaudeTool.keys()];
  return JSON.stringify(hostToolNames(claudeTools, byClaudeTool));
}

/** An agent's frontmatter as `agy` reads it: the portable keys, and the tools it maps to. */
export function antigravityAgentFrontmatter(agentTools: AntigravityAgentTools): AgentFrontmatter {
  return (frontmatter) => {
    const { tools, ...portable } = portableAgentFrontmatter(frontmatter, String(frontmatter.name));
    return { ...portable, tools: agyTools(tools, agentTools) };
  };
}

function antigravityAgentMarkdown(agentTools: AntigravityAgentTools): AgentMarkdown {
  return { frontmatter: antigravityAgentFrontmatter(agentTools), pluginPrefixedName: true };
}

export function buildAntigravityFlatContract(
  hooks: AntigravityHooks,
  { layout, mcpPath }: { layout: FlatArtifactLayout; mcpPath: string },
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
      rules: rulesArtifact(layout, { frontmatter: activationTriggersRule, quote: "double" }),
      mcp: flatMcpFileArtifact(mcpPath),
      hooks: flatHooksArtifact(hooks, { tool: "antigravity" }, (existing, shipped) =>
        mergeAntigravityHooks(hooks, existing, shipped)
      ),
    },
    buildMarketplaceCatalog: null,
    buildMarketplaceEntry: null,
  };
}

/** Where `agy` reads a plugin's manifest and its MCP servers, at the plugin's root. */
export interface AntigravityPluginFiles {
  readonly manifest: string;
  readonly mcp: string;
  /** The directory every plugin sits in, from the project root, ending in a slash. */
  readonly pluginsDir: string;
  /** The variable `agy` expands to a plugin's directory. */
  readonly rootVariable: string;
  /** Where the catalog the build writes goes: no host reads it. */
  readonly marketplace: string;
}

/** A plugin as `agy` loads it from its own directory: the tree the plugin ships, its hooks
 * rewritten into the named group `agy` reads at the plugin's root, and an event `agy` never fires
 * reported by the build. No catalog is read, so the one written is the shared shape. Limit: the
 * plugin's `hooks.json` belongs to aidd, like every file of its directory: a later install or sync
 * rewrites it, so a group's `enabled` flag a person set there does not survive. */
export function buildAntigravityPluginTreeContract(
  hooks: AntigravityHooks,
  files: AntigravityPluginFiles,
  agentTools: AntigravityAgentTools
): ToolBuildContract {
  return {
    ...pluginTreeContract(hooks, {
      manifestRelative: files.manifest,
      marketplaceRelative: files.marketplace,
      agentMarkdown: antigravityAgentMarkdown(agentTools),
      mcpRelative: files.mcp,
      hooksConversion: antigravityPluginHooks(hooks, files.pluginsDir),
    }),
    pluginRootToken: files.rootVariable,
  };
}
