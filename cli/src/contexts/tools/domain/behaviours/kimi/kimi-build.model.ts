/** Kimi's two build contracts. Flat: rules sit in Kimi's own `instructions/` folder and AGENTS.md
 * lists them; skills sit in the shared `.agents/skills/`; agents sit in Kimi's own folder, because
 * `.agents/agents/` belongs to Antigravity. Plugin: a tree Kimi installs from a local directory,
 * at user scope only. */

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
import type { PluginPresence } from "../../../../../shared/domain/materialization/plugin-presence.js";
import { rewritePluginRootInJson } from "../../../../../shared/domain/materialization/plugin-root-path-rewrite.js";
import { portableAgentFrontmatter } from "../../formats/agents/portable-agent.js";
import { AGENTS_FILE, agentsIndexFiles } from "../../formats/agents-rules-index.js";
import type { HooksRouting } from "../../formats/hooks/descriptor.js";
import { pluginTreeHooksArtifact } from "../../formats/hooks/routes.js";
import { hostToolNames } from "../../formats/host-tool-names.js";
import { shapeEntries } from "../../hooks/hooks-entry-shape.js";
import { routeEvents } from "../../hooks/hooks-route.js";
import { toolWarning, unmappedEventWarning } from "../../hooks/hooks-warnings.js";
import { matcherGroupsByEvent } from "../../hooks/plugin-hooks-shape.js";
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

/** Where Kimi reads a plugin's manifest: https://www.kimi.com/code/docs/en/kimi-code-cli/customization/plugins.html */
const PLUGIN_MANIFEST_RELATIVE = ".kimi-plugin/plugin.json";

/** Kimi's hooks, with the native event each canonical event fires on. */
export type KimiHooks = HooksRouting & { readonly eventMap: Readonly<Record<string, string>> };

export interface KimiPluginSpec {
  readonly agentTools: KimiAgentTools;
  readonly hooks: KimiHooks;
}

/** A hook as Kimi's manifest lists it: `event`, `matcher`, `command` and `timeout`
 * (https://www.kimi.com/code/docs/en/kimi-code-cli/customization/plugins.html). */
const MANIFEST_ENTRY = {
  wrapper: {},
  entries: { shape: "flat", fieldsKept: ["command", "matcher", "timeout"] },
} as const;

/** The hooks a manifest lists, from the plugin's events: commands run from the plugin root, an
 * event Kimi never fires left out and named. */
function manifestHooks(shipped: Readonly<Record<string, unknown>>, { eventMap }: KimiHooks) {
  const { routed, skipped } = routeEvents(
    matcherGroupsByEvent(rewritePluginRootInJson(shipped)),
    eventMap,
    (groups) => shapeEntries(groups, MANIFEST_ENTRY)
  );
  return {
    entries: routed.flatMap(([event, entries]) => entries.map((entry) => ({ event, ...entry }))),
    skipped,
  };
}

/** The manifest Kimi installs, which also reports each event Kimi never fires. Every path starts
 * with `./`, and Kimi finds `agents/` by itself when the manifest names none. Its servers and
 * hooks are inline, not paths, with the plugin root its own directory. `repository` is left
 * out: Kimi lists no such field. */
function kimiPluginManifest(hooks: KimiHooks) {
  return (
    source: Record<string, unknown>,
    { skillsList, mcpServers, hooks: shipped }: PluginPresence,
    warn?: (warning: string) => void
  ): Record<string, unknown> => {
    const { repository: _repository, ...identity } = identityFields(source);
    const { entries, skipped } = manifestHooks(shipped, hooks);
    for (const event of skipped) warn?.(toolWarning("kimi", unmappedEventWarning(event)));
    return {
      ...identity,
      ...(skillsList.length > 0 && { skills: "./skills/" }),
      ...(Object.keys(mcpServers).length > 0 && {
        mcpServers: rewritePluginRootInJson(mcpServers),
      }),
      ...(entries.length > 0 && { hooks: entries }),
    };
  };
}

/** The tree `aidd translate --to kimi --as marketplace` builds and the user-scope install hands
 * to Kimi's own plugin server: skills and agents under the plugin, the servers and hooks in the
 * manifest. */
export function buildKimiPluginContract({ agentTools, hooks }: KimiPluginSpec): ToolBuildContract {
  return {
    manifestFileRelative: PLUGIN_MANIFEST_RELATIVE,
    synthesizeManifest: kimiPluginManifest(hooks),
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
      hooks: pluginTreeHooksArtifact(hooks),
    },
    buildMarketplaceCatalog: null,
    buildMarketplaceEntry: null,
  };
}
