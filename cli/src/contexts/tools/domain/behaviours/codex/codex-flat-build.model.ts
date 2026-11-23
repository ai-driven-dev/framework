/**
 * Codex's flat build contract: direct workspace materialization; what it merges lives in the
 * sibling models.
 */

import { agentsIn, skillsIn } from "../../../../../shared/domain/materialization/artifact-path.js";
import type { ToolBuildContract } from "../../../../../shared/domain/materialization/build-contract.js";
import type { FlatArtifactLayout } from "../../../../../shared/domain/materialization/flat-paths.js";
import { tomlAgentMarkdownToToml } from "../../formats/agents/toml-agent.js";
import type { FlatHooksRoute, HooksRouting } from "../../formats/hooks/descriptor.js";
import { flatHooksArtifact } from "../../formats/hooks/flat-routes.js";
import type { TomlCodec } from "../../formats/toml.js";
import { mergeCodexConfigToml } from "./codex-config.model.js";

type FlatHooks = HooksRouting & { readonly flat: FlatHooksRoute };

function serversOf(parsed: unknown): object {
  if (typeof parsed !== "object" || parsed === null) return {};
  const servers = Reflect.get(parsed, "mcpServers");
  return typeof servers === "object" && servers !== null ? servers : {};
}

function collectMcpServers(
  builtPlugins: readonly string[],
  pluginMcp: ReadonlyMap<string, string>
): Record<string, unknown> {
  const mcpServers: Record<string, unknown> = {};
  for (const plugin of builtPlugins) {
    const raw = pluginMcp.get(plugin);
    if (raw === undefined) continue;
    Object.assign(mcpServers, serversOf(JSON.parse(raw)));
  }
  return mcpServers;
}

function buildCodexConfigPayload(toml: TomlCodec, mcpServers: Record<string, unknown>): string {
  if (Object.keys(mcpServers).length === 0) return "";
  return toml.stringify({ mcp_servers: mcpServers });
}

function codexFlatArtifacts(
  toml: TomlCodec,
  hooks: FlatHooks,
  layout: FlatArtifactLayout
): ToolBuildContract["artifacts"] {
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
      transform: tomlAgentMarkdownToToml(toml),
    },
    mcp: { supported: false, reason: "carried by the config artifact (config.toml mcp_servers)" },
    hooks: flatHooksArtifact(hooks, { tool: "codex" }),
  };
}

export function buildCodexFlatContract(
  toml: TomlCodec,
  hooks: FlatHooks,
  { layout, configPath }: { readonly layout: FlatArtifactLayout; readonly configPath: string }
): ToolBuildContract {
  return {
    manifestFileRelative: null,
    synthesizeManifest: null,
    manifestSchemaName: null,
    artifacts: codexFlatArtifacts(toml, hooks, layout),
    buildMarketplaceCatalog: null,
    buildMarketplaceEntry: null,
    configArtifact: {
      reads: () => [configPath],
      probes: () => [],
      assets: { tool: "codex", names: [] },
      emit: ({ builtPlugins, pluginMcp, existing }) => {
        const mcpServers = collectMcpServers(builtPlugins, pluginMcp);
        const aiddPayload = buildCodexConfigPayload(toml, mcpServers);
        const merged = mergeCodexConfigToml(toml)(existing.get(configPath) ?? "", aiddPayload);
        return [{ path: configPath, content: merged }];
      },
    },
  };
}
