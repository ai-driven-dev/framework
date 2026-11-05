/**
 * Codex's build contracts: marketplace (a native plugin tree) and flat (direct workspace
 * materialization). `mergeCodexConfigToml` and `stripCodexSkillFrontmatter` live here because
 * both contracts need them as much as the installed-content capabilities do; the profile
 * imports them back from here.
 */

import { parseFrontmatter, serializeFrontmatter } from "../../../../../kernel/markdown.js";
import {
  flatMcpKeyPrefix,
  genericFlatSkillPath,
} from "../../../../../kernel/materialization/flat-paths.js";
import type { PluginPresence, ToolBuildContract } from "../../build-contract.js";
import { flatHooksArtifact, pluginTreeHooksArtifact } from "../../formats/hooks-descriptor.js";
import { buildCodexMarketplace, buildCodexMarketplaceEntry } from "../../marketplace-catalog.js";
import { codexAgentMarkdownToToml } from "./codex-agent-toml.js";
import {
  OUTPUT_CODEX_AGENTS_DIR,
  OUTPUT_CODEX_MANIFEST_RELATIVE,
  OUTPUT_CODEX_MARKETPLACE_RELATIVE,
} from "./codex-paths.js";
import { CODEX_HOOKS } from "./hooks.js";
import { parseToml, stringifyToml } from "./toml.js";

type TomlRecord = Record<string, unknown>;

const MIN_PROJECT_DOC_MAX_BYTES = 262144;

function parseSafe(content: string): TomlRecord {
  if (!content.trim()) return {};
  try {
    return parseToml(content);
  } catch {
    return {};
  }
}

function mergeMcpServers(existing: TomlRecord, incoming: TomlRecord): void {
  const incomingServers = incoming.mcp_servers as TomlRecord | undefined;
  if (!incomingServers) return;
  const existingServers = (existing.mcp_servers ?? {}) as TomlRecord;
  for (const [name, value] of Object.entries(incomingServers)) {
    if (!(name in existingServers)) {
      existingServers[name] = value;
    }
  }
  existing.mcp_servers = existingServers;
}

function ensureProjectDocMaxBytes(existing: TomlRecord, incoming: TomlRecord): void {
  const existingVal =
    typeof existing.project_doc_max_bytes === "number" ? existing.project_doc_max_bytes : 0;
  const incomingVal =
    typeof incoming.project_doc_max_bytes === "number"
      ? incoming.project_doc_max_bytes
      : MIN_PROJECT_DOC_MAX_BYTES;
  if (existingVal >= MIN_PROJECT_DOC_MAX_BYTES) return;
  existing.project_doc_max_bytes = Math.max(existingVal, incomingVal, MIN_PROJECT_DOC_MAX_BYTES);
}

function ensureCodexHooks(existing: TomlRecord): void {
  const features = existing.features as TomlRecord | undefined;
  if (features?.hooks !== undefined || features?.codex_hooks !== undefined) return;
  existing.features = { ...(features ?? {}), hooks: true };
}

export function mergeCodexConfigToml(existing: string, aiddPayload: string): string {
  const result = parseSafe(existing);
  const payload = parseSafe(aiddPayload);
  mergeMcpServers(result, payload);
  ensureProjectDocMaxBytes(result, payload);
  ensureCodexHooks(result);
  return stringifyToml(result);
}

export function stripCodexSkillFrontmatter(fm: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (fm.name !== undefined) result.name = fm.name;
  if (fm.description !== undefined) result.description = fm.description;
  if (fm.allowed_tools !== undefined) result.allowed_tools = fm.allowed_tools;
  return result;
}

const CODEX_MANIFEST_STRING_KEYS = [
  "name",
  "description",
  "version",
  "homepage",
  "repository",
  "license",
] as const;

function copyCodexManifestStringFields(
  source: Record<string, unknown>,
  manifest: Record<string, unknown>
): void {
  for (const key of CODEX_MANIFEST_STRING_KEYS) {
    if (typeof source[key] === "string") manifest[key] = source[key];
  }
  if (typeof source.author === "string" || typeof source.author === "object") {
    manifest.author = source.author;
  }
  if (Array.isArray(source.keywords)) manifest.keywords = source.keywords;
}

function buildCodexManifest(
  source: Record<string, unknown>,
  presence: PluginPresence
): Record<string, unknown> {
  const manifest: Record<string, unknown> = {};
  copyCodexManifestStringFields(source, manifest);
  // The agents field is omitted: the Codex plugin schema has no such key. `skills` must be a
  // STRING directory — the array form makes `codex plugin add` fail with "missing or invalid
  // plugin.json".
  if (presence.skillsList.length > 0) manifest.skills = "./skills";
  if (presence.hasHooksJson) manifest.hooks = "./hooks/hooks.json";
  if (presence.hasMcpJson) manifest.mcpServers = "./.mcp.json";
  return manifest;
}

function transformCodexSkill(content: string): string {
  const { frontmatter, body } = parseFrontmatter(content);
  return serializeFrontmatter(stripCodexSkillFrontmatter(frontmatter), body);
}

export function buildCodexContract(): ToolBuildContract {
  const manifestRelative = OUTPUT_CODEX_MANIFEST_RELATIVE;
  const marketplaceRelative = OUTPUT_CODEX_MARKETPLACE_RELATIVE;
  return {
    pluginRootToken: CODEX_HOOKS.rootToken,
    manifestFileRelative: manifestRelative,
    synthesizeManifest: buildCodexManifest,
    manifestSchemaName: "codex-plugin-manifest",
    artifacts: {
      skills: {
        supported: true,
        source: { kind: "fullTree", srcDir: "skills" },
        path: (_p, rel) => rel,
        transform: transformCodexSkill,
      },
      agents: {
        supported: true,
        source: { kind: "filteredTree", srcDir: "agents", inputExt: ".md" },
        path: (_p, rel) =>
          `${OUTPUT_CODEX_AGENTS_DIR}/${rel.replace(/^agents\//, "").replace(/\.md$/, ".toml")}`,
        transform: codexAgentMarkdownToToml,
      },
      mcp: {
        supported: true,
        source: { kind: "configFile", srcPath: ".mcp.json" },
        path: () => ".mcp.json",
      },
      hooks: pluginTreeHooksArtifact(CODEX_HOOKS),
      rules: { supported: false },
      commands: { supported: false },
    },
    buildMarketplaceCatalog: async (source, entries, _fs) => ({
      catalog: buildCodexMarketplace(
        source as Parameters<typeof buildCodexMarketplace>[0],
        entries
      ),
      schemaName: "codex-marketplace",
      destRelPath: marketplaceRelative,
    }),
    buildMarketplaceEntry: async (name, _src, _outDir, srcEntry, _fs) =>
      buildCodexMarketplaceEntry(name, srcEntry as Record<string, unknown> | undefined),
  };
}

// Codex scans `.agents/skills/` (cwd to repo root) for workspace skills, the documented project
// skill root; verified live, a SKILL.md there appears in Codex's "Available skills" context.
// `.codex/skills/` also resolves but is undocumented, so the documented root is what is used.
const CODEX_SKILLS_PREFIX = ".agents/skills/";

function codexFlatSkillPath(plugin: string, rel: string): string {
  return genericFlatSkillPath(CODEX_SKILLS_PREFIX, plugin, rel.replace(/^skills\//, ""));
}

function codexFlatAgentPath(plugin: string, rel: string): string {
  const base = rel.replace(/^agents\//, "").replace(/\.md$/, ".toml");
  return `.codex/agents/${plugin}-${base}`;
}

function collectPrefixedMcpServers(
  builtPlugins: readonly string[],
  pluginMcp: ReadonlyMap<string, string>
): Record<string, unknown> {
  const mcpServers: Record<string, unknown> = {};
  for (const plugin of builtPlugins) {
    const raw = pluginMcp.get(plugin);
    if (raw === undefined) continue;
    const parsed = JSON.parse(raw) as { mcpServers?: Record<string, unknown> };
    const prefix = flatMcpKeyPrefix(plugin);
    for (const [k, v] of Object.entries(parsed.mcpServers ?? {})) {
      mcpServers[`${prefix}${k}`] = v;
    }
  }
  return mcpServers;
}

const CODEX_FLAT_CONFIG = ".codex/config.toml";

function buildCodexConfigPayload(mcpServers: Record<string, unknown>): string {
  if (Object.keys(mcpServers).length === 0) return "";
  return stringifyToml({ mcp_servers: mcpServers } as Record<string, unknown>);
}

export function buildCodexFlatContract(): ToolBuildContract {
  return {
    manifestFileRelative: null,
    synthesizeManifest: null,
    manifestSchemaName: null,
    artifacts: {
      skills: {
        supported: true,
        source: { kind: "fullTree", srcDir: "skills" },
        path: codexFlatSkillPath,
        rewriteSkillName: true,
      },
      agents: {
        supported: true,
        source: { kind: "filteredTree", srcDir: "agents", inputExt: ".md" },
        path: codexFlatAgentPath,
        transform: codexAgentMarkdownToToml,
      },
      mcp: { supported: false }, // handled by configArtifact (config.toml mcp_servers)
      hooks: flatHooksArtifact(CODEX_HOOKS, { tool: "codex" }),
      rules: { supported: false },
      commands: { supported: false },
    },
    buildMarketplaceCatalog: null,
    buildMarketplaceEntry: null,
    configArtifact: {
      reads: () => [CODEX_FLAT_CONFIG],
      assets: { tool: "codex", names: [] },
      emit: ({ builtPlugins, pluginMcp, existing }) => {
        const mcpServers = collectPrefixedMcpServers(builtPlugins, pluginMcp);
        const aiddPayload = buildCodexConfigPayload(mcpServers);
        const merged = mergeCodexConfigToml(existing.get(CODEX_FLAT_CONFIG) ?? "", aiddPayload);
        return [{ path: CODEX_FLAT_CONFIG, content: merged }];
      },
    },
  };
}
