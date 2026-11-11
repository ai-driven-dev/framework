/** Kilo's project distribution is flat. Its config and MCP format follow the OpenCode runtime,
 * but Kilo has its own .kilo/ discovery paths and bundled base configuration. */

import { parseFrontmatter, serializeFrontmatter } from "../../../../../kernel/markdown.js";
import {
  flatMcpKeyPrefix,
  genericFlatAgentPath,
  genericFlatSkillTreePath,
} from "../../../../../kernel/materialization/flat-paths.js";
import { rewriteRelativeLinks } from "../../../../../kernel/materialization/relative-link-rewrite.js";
import type { ToolBuildContract } from "../../build-contract.js";
import { flatHooksArtifact } from "../../formats/hooks-descriptor.js";
import { buildOpencodeFlatConfig, toTypedMcpSection } from "../../formats/opencode-mcp-merge.js";
import { KILO_HOOKS } from "./hooks.js";
import { kiloAgentFrontmatter } from "./kilo-agent.js";
import { generateKiloHooksBridge } from "./kilo-hooks-bridge.js";
import { chooseKiloConfigPath, KILO_CONFIG_CANDIDATES, KILO_DIRECTORY } from "./kilo-paths.js";

function kiloFlatAgentPath(plugin: string, rel: string): string {
  return genericFlatAgentPath(
    `${KILO_DIRECTORY}agents/`,
    plugin,
    rel.replace(/^agents\//, ""),
    ".md"
  );
}

function kiloFlatSkillPath(plugin: string, rel: string): string {
  return genericFlatSkillTreePath(`${KILO_DIRECTORY}skills/`, plugin, rel.replace(/^skills\//, ""));
}

function kiloFlatResolveTarget(plugin: string, rel: string): string {
  if (rel.startsWith("agents/")) return kiloFlatAgentPath(plugin, rel);
  if (rel.startsWith("skills/")) return kiloFlatSkillPath(plugin, rel);
  return rel;
}

function transformKiloFlatAgent(content: string, plugin: string, outName: string): string {
  const { frontmatter, body } = parseFrontmatter(content);
  const flatRelPath = kiloFlatAgentPath(plugin, `agents/${outName}`);
  const rewrittenBody = rewriteRelativeLinks(body, {
    currentFilePluginRelative: flatRelPath,
    resolveTargetPath: (rel) => kiloFlatResolveTarget(plugin, rel),
  });
  return serializeFrontmatter(kiloAgentFrontmatter(frontmatter), rewrittenBody);
}

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

export function buildKiloFlatContract(): ToolBuildContract {
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
        transform: transformKiloFlatAgent,
      },
      mcp: { supported: false },
      hooks: flatHooksArtifact(KILO_HOOKS, { bridge: generateKiloHooksBridge }),
      rules: { supported: false },
      commands: { supported: false },
    },
    buildMarketplaceCatalog: null,
    buildMarketplaceEntry: null,
    configArtifact: {
      reads: () => KILO_CONFIG_CANDIDATES,
      probes: () => [],
      assets: { tool: "kilo", names: ["kilo.json"] },
      emit: ({ builtPlugins, pluginMcp, existing, assets }) => {
        const configPath = chooseKiloConfigPath((relPath) => existing.has(relPath));
        const incoming = collectKiloMcp(builtPlugins, pluginMcp);
        const asset = assets.get("kilo.json");
        const base = typeof asset === "string" ? asset : JSON.stringify(asset);
        const config = buildOpencodeFlatConfig(base, existing.get(configPath) ?? null, incoming);
        return [{ path: configPath, content: config }];
      },
    },
  };
}
