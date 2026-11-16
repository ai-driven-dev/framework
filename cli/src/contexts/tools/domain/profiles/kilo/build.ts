/** Kilo's project distribution is flat. Its config and MCP format follow the OpenCode runtime,
 * but Kilo has its own .kilo/ discovery paths and bundled base configuration. */

import { parseFrontmatter, serializeFrontmatter } from "../../../../../kernel/markdown.js";
import {
  flatMcpKeyPrefix,
  genericFlatAgentPath,
  genericFlatRulePath,
  genericFlatSkillTreePath,
} from "../../../../../kernel/materialization/flat-paths.js";
import {
  relocateRelativeLinks,
  rewriteRelativeLinks,
} from "../../../../../kernel/materialization/relative-link-rewrite.js";
import type { ToolBuildContract } from "../../build-contract.js";
import { flatHooksArtifact } from "../../formats/hooks-descriptor.js";
import { buildOpencodeFlatConfig } from "../../formats/opencode-mcp-merge.js";
import { transformMcpToOpencode } from "../opencode/build.js";
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

function kiloFlatRulePath(plugin: string, rel: string): string {
  return genericFlatRulePath(`${KILO_DIRECTORY}rules/`, plugin, rel);
}

function kiloFlatEmittedTarget(plugin: string, rel: string): string | null {
  if (rel.startsWith("agents/")) return kiloFlatAgentPath(plugin, rel);
  if (rel.startsWith("skills/")) return kiloFlatSkillPath(plugin, rel);
  if (rel.startsWith("rules/") && rel.endsWith(".md")) return kiloFlatRulePath(plugin, rel);
  return null;
}

function kiloFlatResolveTarget(plugin: string, rel: string): string {
  return kiloFlatEmittedTarget(plugin, rel) ?? rel;
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

// Kilo loads `instructions` for every session: a `paths` scope would silently widen to all files.
function kiloRulePathScope(content: string): unknown {
  return parseFrontmatter(content).frontmatter.paths;
}

function transformKiloFlatRule(content: string, plugin: string, ruleRel: string): string {
  const sourceRel = `rules/${ruleRel}`;
  return relocateRelativeLinks(content, {
    sourceFilePluginRelative: sourceRel,
    materializedFileRelative: kiloFlatRulePath(plugin, sourceRel),
    resolveTargetPath: (rel) => kiloFlatEmittedTarget(plugin, rel),
  });
}

function collectKiloMcp(
  builtPlugins: readonly string[],
  pluginMcp: ReadonlyMap<string, string>
): Record<string, unknown> {
  const incoming: Record<string, unknown> = {};
  for (const plugin of builtPlugins) {
    const raw = pluginMcp.get(plugin);
    if (raw === undefined) continue;
    const transformed = JSON.parse(transformMcpToOpencode(raw)) as {
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
      rules: {
        supported: true,
        source: { kind: "filteredTree", srcDir: "rules", inputExt: ".md" },
        path: kiloFlatRulePath,
        inexpressibleScope: kiloRulePathScope,
        transform: transformKiloFlatRule,
      },
      commands: { supported: false },
    },
    buildMarketplaceCatalog: null,
    buildMarketplaceEntry: null,
    configArtifact: {
      reads: () => KILO_CONFIG_CANDIDATES,
      probes: () => [],
      assets: { tool: "kilo", names: ["kilo.json"] },
      emit: ({ builtPlugins, pluginMcp, rules, existing, assets }) => {
        const configPath = chooseKiloConfigPath((relPath) => existing.has(relPath));
        const incoming = collectKiloMcp(builtPlugins, pluginMcp);
        const asset = assets.get("kilo.json");
        const assetJson = typeof asset === "string" ? asset : JSON.stringify(asset);
        // Generated Rule paths follow the user's own `instructions`, never duplicated on rebuild.
        const base =
          rules.length > 0
            ? JSON.stringify({ ...JSON.parse(assetJson), instructions: rules })
            : assetJson;
        const mergedKeys = rules.length > 0 ? ["instructions"] : [];
        const config = buildOpencodeFlatConfig(
          base,
          existing.get(configPath) ?? null,
          incoming,
          mergedKeys
        );
        return [{ path: configPath, content: config }];
      },
    },
  };
}
