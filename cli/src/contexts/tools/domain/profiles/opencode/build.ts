/**
 * Opencode's build contract: flat only — opencode has no marketplace mode.
 */

import { parseFrontmatter, serializeFrontmatter } from "../../../../../kernel/markdown.js";
import {
  flatMcpKeyPrefix,
  genericFlatAgentPath,
  genericFlatSkillTreePath,
} from "../../../../../kernel/materialization/flat-paths.js";
import { rewriteRelativeLinks } from "../../../../../kernel/materialization/relative-link-rewrite.js";
import type {
  ConfigArtifactFile,
  ConfigArtifactInput,
  ToolBuildContract,
} from "../../build-contract.js";
import { flatHooksArtifact, hooksBridgePath } from "../../formats/hooks-descriptor.js";
import { buildOpencodeFlatConfig, toTypedMcpSection } from "../../formats/opencode-mcp-merge.js";
import { OPENCODE_HOOKS } from "./hooks.js";
import { opencodeAgentFrontmatter } from "./opencode-agent.js";
import { generateOpencodeHooksBridge } from "./opencode-hooks-bridge.js";

function opencodeFlatAgentPath(plugin: string, rel: string): string {
  return genericFlatAgentPath(".opencode/agents/", plugin, rel.replace(/^agents\//, ""), ".md");
}

function opencodeFlatSkillPath(plugin: string, rel: string): string {
  return genericFlatSkillTreePath(".opencode/skills/", plugin, rel.replace(/^skills\//, ""));
}

function opencodeFlatResolveTarget(plugin: string, rel: string): string {
  if (rel.startsWith("agents/")) return opencodeFlatAgentPath(plugin, rel);
  if (rel.startsWith("skills/")) return opencodeFlatSkillPath(plugin, rel);
  return rel;
}

function transformOpencodeFlatAgent(content: string, plugin: string, outName: string): string {
  const { frontmatter, body } = parseFrontmatter(content);
  const flatRelPath = opencodeFlatAgentPath(plugin, `agents/${outName}`);
  const rewrittenBody = rewriteRelativeLinks(body, {
    currentFilePluginRelative: flatRelPath,
    resolveTargetPath: (rel) => opencodeFlatResolveTarget(plugin, rel),
  });
  return serializeFrontmatter(opencodeAgentFrontmatter(frontmatter), rewrittenBody);
}

const OPENCODE_JSONC = "opencode.jsonc";
const OPENCODE_JSON = "opencode.json";

function collectOpencodeMcp(
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
    const prefix = flatMcpKeyPrefix(plugin);
    for (const [k, v] of Object.entries(transformed.mcp ?? {})) {
      incoming[`${prefix}${k}`] = v;
    }
  }
  return incoming;
}

/** A built plugin's own loader or its generated bridge: either means OpenCode will run hooks. */
function pluginLoaders(plugin: string): readonly string[] {
  const { loaderEntry } = OPENCODE_HOOKS.flat;
  return [`${loaderEntry.dir}${plugin}.js`, hooksBridgePath(loaderEntry, plugin)];
}

function emitOpencodeConfig({
  builtPlugins,
  pluginMcp,
  existing,
  present,
  assets,
}: ConfigArtifactInput): readonly ConfigArtifactFile[] {
  const configPath = existing.has(OPENCODE_JSONC) ? OPENCODE_JSONC : OPENCODE_JSON;
  const incoming = collectOpencodeMcp(builtPlugins, pluginMcp);
  const baseAsset = assets.get(OPENCODE_JSON);
  const base = typeof baseAsset === "string" ? baseAsset : JSON.stringify(baseAsset);
  const config = {
    path: configPath,
    content: buildOpencodeFlatConfig(base, existing.get(configPath) ?? null, incoming),
  };
  const runsHooks = builtPlugins.some((plugin) =>
    pluginLoaders(plugin).some((loader) => present.has(loader))
  );
  if (!runsHooks) return [config];
  const runtime = OPENCODE_HOOKS.bridgeRuntime;
  const events = assets.get(runtime.asset);
  if (typeof events !== "string") throw new TypeError("OpenCode event adapter must be source text");
  return [config, { path: runtime.path, content: events }];
}

export function buildOpencodeFlatContract(): ToolBuildContract {
  return {
    manifestFileRelative: null,
    synthesizeManifest: null,
    manifestSchemaName: null,
    artifacts: {
      skills: {
        supported: true,
        source: { kind: "fullTree", srcDir: "skills" },
        path: opencodeFlatSkillPath,
        rewriteSkillName: true,
      },
      agents: {
        supported: true,
        source: { kind: "filteredTree", srcDir: "agents", inputExt: ".md" },
        path: opencodeFlatAgentPath,
        transform: transformOpencodeFlatAgent,
      },
      mcp: { supported: false }, // handled by configArtifact (opencode.json mcp)
      hooks: flatHooksArtifact(OPENCODE_HOOKS, { bridge: generateOpencodeHooksBridge }),
      rules: { supported: false },
      commands: { supported: false },
    },
    buildMarketplaceCatalog: null,
    buildMarketplaceEntry: null,
    configArtifact: {
      reads: () => [OPENCODE_JSONC, OPENCODE_JSON],
      probes: (builtPlugins) => builtPlugins.flatMap(pluginLoaders),
      assets: { tool: "opencode", names: [OPENCODE_JSON, OPENCODE_HOOKS.bridgeRuntime.asset] },
      emit: emitOpencodeConfig,
    },
  };
}
