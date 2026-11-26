/** Kimi's two build contracts. Flat: rules sit in Kimi's own `instructions/` folder and AGENTS.md
 * lists them; skills sit in the shared `.agents/skills/`; agents sit in Kimi's own folder, because
 * `.agents/agents/` belongs to Antigravity. Plugin: a tree Kimi installs from a local directory,
 * at user scope only. */

import {
  agentsIn,
  flatMcpFileArtifact,
  rulesArtifact,
  skillsIn,
} from "../../../../../shared/domain/materialization/artifact-path.js";
import type {
  AgentMarkdown,
  PluginPresence,
  ToolBuildContract,
} from "../../../../../shared/domain/materialization/build-contract.js";
import type { FlatArtifactLayout } from "../../../../../shared/domain/materialization/flat-paths.js";
import { rewritePluginRootInJson } from "../../../../../shared/domain/materialization/plugin-root-path-rewrite.js";
import { portableAgentFrontmatter } from "../../formats/agents/portable-agent.js";
import { AGENTS_FILE, agentsIndexFiles } from "../../formats/agents-rules-index.js";
import { hostToolNames } from "../../formats/host-tool-names.js";
import { identityFields } from "../../marketplace-catalog.js";

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
    rules: rulesArtifact(layout),
    mcp: flatMcpFileArtifact(mcpPath),
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

/** Where Kimi reads a plugin's manifest: https://www.kimi.com/code/docs/en/kimi-code-cli/customization/plugins.html */
const PLUGIN_MANIFEST_RELATIVE = ".kimi-plugin/plugin.json";

export interface KimiPluginSpec {
  readonly agentTools: KimiAgentTools;
  readonly hooksReason: string;
}

/** The manifest Kimi installs. Every path starts with `./`, and Kimi finds `agents/` by itself
 * when the manifest names none. Its servers are an inline object, not a path, with the plugin
 * root its own directory. `repository` is left out: Kimi lists no such field. */
function kimiPluginManifest(
  source: Record<string, unknown>,
  { skillsList, mcpServers }: PluginPresence
): Record<string, unknown> {
  const { repository: _repository, ...identity } = identityFields(source);
  return {
    ...identity,
    ...(skillsList.length > 0 && { skills: "./skills/" }),
    ...(Object.keys(mcpServers).length > 0 && { mcpServers: rewritePluginRootInJson(mcpServers) }),
  };
}

/** The tree `aidd translate --to kimi --as marketplace` builds and the user-scope install hands
 * to Kimi's own plugin server: skills and agents under the plugin, the servers in the manifest. */
export function buildKimiPluginContract({
  agentTools,
  hooksReason,
}: KimiPluginSpec): ToolBuildContract {
  return {
    manifestFileRelative: PLUGIN_MANIFEST_RELATIVE,
    synthesizeManifest: kimiPluginManifest,
    manifestSchemaName: null,
    artifacts: {
      skills: {
        supported: true,
        source: { kind: "fullTree", srcDir: "skills" },
        placement: { kind: "relative" },
      },
      agents: {
        supported: true,
        source: { kind: "filteredTree", srcDir: "agents", inputExt: ".md" },
        placement: { kind: "relative" },
        agentMarkdown: kimiAgentMarkdown(agentTools),
      },
      mcp: { supported: false, reason: "Kimi reads a plugin's servers from its manifest" },
      hooks: { supported: false, reason: hooksReason },
    },
    buildMarketplaceCatalog: null,
    buildMarketplaceEntry: null,
  };
}
