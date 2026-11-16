/**
 * Opencode's build contract: flat only — opencode has no marketplace mode.
 * `transformMcpToOpencode` lives here because the flat contract's config-artifact step needs it
 * as much as the installed-content mcp capability does; the profile imports it back.
 */

import { InvalidMcpServerConfigError, McpConfigError } from "../../../../../kernel/errors.js";
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
import { buildOpencodeFlatConfig } from "../../formats/opencode-mcp-merge.js";
import { OPENCODE_HOOKS } from "./hooks.js";
import { opencodeAgentFrontmatter } from "./opencode-agent.js";
import { generateOpencodeHooksBridge } from "./opencode-hooks-bridge.js";

type RawServer =
  | { command: string; args?: string[]; env?: Record<string, string>; disabled?: boolean }
  | { url: string; disabled?: boolean };

interface OpencodeMcpLocalServer {
  type: "local";
  command: string[];
  enabled: boolean;
  environment?: Record<string, string>;
}

interface OpencodeMcpRemoteServer {
  type: "remote";
  url: string;
  enabled: boolean;
}

type OpencodeMcpServer = OpencodeMcpLocalServer | OpencodeMcpRemoteServer;

function convertRawServer(name: string, server: RawServer): OpencodeMcpServer {
  const enabled = server.disabled !== true;
  if ("command" in server) {
    const { command, args = [], env } = server;
    const local: OpencodeMcpLocalServer = { type: "local", command: [command, ...args], enabled };
    if (env && Object.keys(env).length > 0) local.environment = env;
    return local;
  }
  if ("url" in server) {
    return { type: "remote", url: server.url, enabled };
  }
  throw new InvalidMcpServerConfigError(name);
}

export function transformMcpToOpencode(content: string): string {
  let parsed: { mcpServers?: Record<string, RawServer> };
  try {
    parsed = JSON.parse(content) as typeof parsed;
  } catch (err) {
    throw new McpConfigError(
      `Cannot parse MCP config: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new McpConfigError("MCP config must be a JSON object");
  }
  const mcp: Record<string, OpencodeMcpServer> = {};
  for (const [name, server] of Object.entries(parsed.mcpServers ?? {})) {
    mcp[name] = convertRawServer(name, server);
  }
  return JSON.stringify({ mcp }, null, 2);
}

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
    const transformed = JSON.parse(transformMcpToOpencode(raw)) as {
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
