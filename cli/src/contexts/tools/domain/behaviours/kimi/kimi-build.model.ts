/** Flat only. Rules sit in Kimi's own `instructions/` folder and AGENTS.md lists them. Skills sit in the shared `.agents/skills/`; agents sit in Kimi's own folder, because
 * `.agents/agents/` belongs to Antigravity, whose tool names Kimi does not read. */

import {
  agentsIn,
  rulesIn,
  skillsIn,
} from "../../../../../shared/domain/materialization/artifact-path.js";
import type {
  AgentMarkdown,
  ToolBuildContract,
} from "../../../../../shared/domain/materialization/build-contract.js";
import type { FlatArtifactLayout } from "../../../../../shared/domain/materialization/flat-paths.js";
import { portableAgentFrontmatter } from "../../formats/agents/portable-agent.js";
import { AGENTS_FILE, agentsIndexFiles } from "../../formats/agents-rules-index.js";
import { hostToolNames } from "../../formats/host-tool-names.js";

/** The Kimi name of each Claude tool an agent may declare; a Claude tool absent from it has no
 * Kimi equivalent. */
export type KimiAgentTools = ReadonlyMap<string, string>;

/** Kimi matches `tools` by exact name and an MCP tool by an `mcp__` glob, the form Claude uses. */
const MCP_PREFIX = "mcp__";

/** Kimi gives every tool to an agent with no `tools`, as Claude does, so none is written then. A
 * declared Claude tool with no Kimi name is dropped, which narrows the grant and never widens it:
 * an unknown name matches nothing and only warns. Written inline so an empty list stays `[]`. */
function kimiTools(declared: string[], byClaudeTool: KimiAgentTools): string {
  return JSON.stringify(
    hostToolNames(declared, byClaudeTool, (tool) => tool.startsWith(MCP_PREFIX))
  );
}

function kimiAgentMarkdown(agentTools: KimiAgentTools): AgentMarkdown {
  return {
    frontmatter: (frontmatter) => {
      // Kimi documents no `model`, and ignores a key it does not know: none is written.
      const {
        model: _model,
        tools,
        ...portable
      } = portableAgentFrontmatter(frontmatter, String(frontmatter.name));
      return tools === undefined ? portable : { ...portable, tools: kimiTools(tools, agentTools) };
    },
    pluginPrefixedName: true,
  };
}

export interface KimiFlatSpec {
  readonly layout: FlatArtifactLayout;
  readonly mcpPath: string;
  readonly agentTools: KimiAgentTools;
  readonly hooksReason: string;
}

function kimiFlatArtifacts({
  layout,
  mcpPath,
  agentTools,
  hooksReason,
}: KimiFlatSpec): ToolBuildContract["artifacts"] {
  return {
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
      agentMarkdown: kimiAgentMarkdown(agentTools),
    },
    rules: {
      supported: true,
      source: { kind: "fullTree", srcDir: "rules" },
      placement: rulesIn(layout),
    },
    mcp: {
      supported: true,
      source: { kind: "configFile", srcPath: ".mcp.json" },
      placement: { kind: "file", at: mcpPath },
      mcpServersKey: "mcpServers",
    },
    hooks: { supported: false, reason: hooksReason },
  };
}

export function buildKimiFlatContract(spec: KimiFlatSpec): ToolBuildContract {
  return {
    manifestFileRelative: null,
    synthesizeManifest: null,
    manifestSchemaName: null,
    artifacts: kimiFlatArtifacts(spec),
    buildMarketplaceCatalog: null,
    buildMarketplaceEntry: null,
    configArtifact: {
      reads: () => [AGENTS_FILE],
      probes: () => [],
      assets: { tool: "kimi", names: [] },
      emit: ({ existing, rulesGlobs }) => agentsIndexFiles(existing, rulesGlobs),
    },
  };
}
