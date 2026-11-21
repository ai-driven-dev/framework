/** Kilo's project distribution is flat. Its config and MCP format follow the OpenCode runtime,
 * but Kilo has its own .kilo/ discovery paths and bundled base configuration. */

import type { FlatHooksLoaderEntry } from "../../../../../shared/domain/materialization/flat-paths.js";
import {
  flatMcpKeyPrefix,
  genericFlatAgentPath,
  genericFlatSkillTreePath,
} from "../../../../../shared/domain/materialization/flat-paths.js";
import type {
  AgentMarkdown,
  ConfigArtifactFile,
  ConfigArtifactInput,
  ToolBuildContract,
} from "../../../contract/build-contract.js";
import type { FlatHooksRoute, HooksRouting } from "../../formats/hooks/descriptor.js";
import { flatHooksArtifact } from "../../formats/hooks/flat-routes.js";
import { buildTypedMcpFlatConfig } from "../../formats/typed-mcp-merge.js";
import { toTypedMcpSection } from "../../formats/typed-mcp-section.js";
import { kiloAgentFrontmatter } from "./kilo-agent.model.js";
import { generateKiloHooksBridge } from "./kilo-hooks-bridge.model.js";
import {
  chooseKiloConfigPath,
  KILO_CONFIG_CANDIDATES,
  KILO_DIRECTORY,
} from "./kilo-paths.model.js";

/** Kilo's hooks as the profile declares them: a loader with no hooks file. */
type KiloHooks = HooksRouting & {
  readonly file?: never;
  readonly flat: FlatHooksRoute & { readonly loaderEntry: FlatHooksLoaderEntry };
};

function kiloFlatAgentPath(plugin: string, rel: string): string {
  return genericFlatAgentPath({
    agentsPrefix: `${KILO_DIRECTORY}agents/`,
    plugin,
    agentBaseName: rel.replace(/^agents\//, ""),
    outputExt: ".md",
  });
}

function kiloFlatSkillPath(plugin: string, rel: string): string {
  return genericFlatSkillTreePath(`${KILO_DIRECTORY}skills/`, plugin, rel.replace(/^skills\//, ""));
}

const kiloAgentMarkdown: AgentMarkdown = {
  frontmatter: (frontmatter) => kiloAgentFrontmatter(frontmatter),
};

function collectKiloMcp(
  builtPlugins: readonly string[],
  pluginMcp: ReadonlyMap<string, string>
): Record<string, unknown> {
  const incoming: Record<string, unknown> = {};
  for (const plugin of builtPlugins) {
    const raw = pluginMcp.get(plugin);
    if (raw === undefined) continue;
    const transformed = JSON.parse(toTypedMcpSection(raw)) as {
      mcp?: Record<string, unknown>;
    };
    for (const [key, value] of Object.entries(transformed.mcp ?? {})) {
      incoming[`${flatMcpKeyPrefix(plugin)}${key}`] = value;
    }
  }
  return incoming;
}

function emitKiloConfig({
  builtPlugins,
  pluginMcp,
  existing,
  assets,
}: ConfigArtifactInput): readonly ConfigArtifactFile[] {
  const configPath = chooseKiloConfigPath((relPath) => existing.has(relPath));
  const incoming = collectKiloMcp(builtPlugins, pluginMcp);
  const asset = assets.get("kilo.json");
  const base = typeof asset === "string" ? asset : JSON.stringify(asset);
  const config = buildTypedMcpFlatConfig({
    baseConfig: base,
    existing: existing.get(configPath) ?? null,
    incoming,
  });
  return [{ path: configPath, content: config }];
}

export function buildKiloFlatContract(hooks: KiloHooks): ToolBuildContract {
  return {
    manifestFileRelative: null,
    synthesizeManifest: null,
    manifestSchemaName: null,
    artifacts: {
      skills: {
        supported: true,
        source: { kind: "fullTree", srcDir: "skills" },
        path: kiloFlatSkillPath,
        rewriteSkillName: true,
      },
      agents: {
        supported: true,
        source: { kind: "filteredTree", srcDir: "agents", inputExt: ".md" },
        path: kiloFlatAgentPath,
        agentMarkdown: kiloAgentMarkdown,
      },
      mcp: { supported: false },
      hooks: flatHooksArtifact(hooks, { bridge: generateKiloHooksBridge }),
      rules: { supported: false },
      commands: { supported: false },
    },
    buildMarketplaceCatalog: null,
    buildMarketplaceEntry: null,
    configArtifact: {
      reads: () => KILO_CONFIG_CANDIDATES,
      probes: () => [],
      assets: { tool: "kilo", names: ["kilo.json"] },
      emit: emitKiloConfig,
    },
  };
}
