import type { Hasher } from "../ports/hasher.js";
import { GeneratedFile } from "./generated-file.js";
import type { McpExclusion } from "./mcp-exclusion.js";
import type { MergeFileEntry } from "./merge-entry.js";
import { parseEntryKeys } from "./merge-entry.js";
import type { ConfigHandler } from "./tool-config.js";

// ── Win32 platform transform ─────────────────────────────────────────────────

interface McpServer {
  command?: string;
  args?: string[];
  [key: string]: unknown;
}

interface McpConfig {
  mcpServers?: Record<string, McpServer>;
  [key: string]: unknown;
}

export function transformFor(platform: string): ((content: string) => string) | undefined {
  return platform === "win32" ? transformMcpForWin32 : undefined;
}

// ── MCP server key extraction and filtering ──────────────────────────────────

/** Returns a map of file relative path → available MCP server keys for each MCP-capable merge file. */
export function extractMcpKeys(
  generated: GeneratedFile[],
  configHandler: ConfigHandler,
  lookup: Map<string, string>
): Map<string, string[]> {
  const result = new Map<string, string[]>();
  forEachMcpFile(generated, configHandler, lookup, (file, sectionKey) => {
    const keys = parseEntryKeys(file.content, sectionKey);
    if (keys.length > 0) result.set(file.relativePath, keys);
  });
  return result;
}

/** Filters MCP entries from generated file content, removing entries listed in exclusions. */
export function filterMcpExclusions(
  generated: GeneratedFile[],
  configHandler: ConfigHandler,
  lookup: Map<string, string>,
  exclusions: readonly McpExclusion[],
  hasher: Hasher
): GeneratedFile[] {
  if (exclusions.length === 0) return generated;
  return generated.map((file) => {
    if (file.mergeStrategy === "none") return file;
    const sectionKey = resolveSectionKey(file, configHandler, lookup);
    if (sectionKey === null) return file;
    const fileExclusions = exclusions.filter((e) => e.configPath === file.relativePath);
    if (fileExclusions.length === 0) return file;
    return filterFileContent(
      file,
      sectionKey,
      new Set(fileExclusions.map((e) => e.entryKey)),
      hasher
    );
  });
}

/** Returns exclusions for server keys present in generated files but absent from selectedKeys. */
export function computeMcpExclusions(
  generated: GeneratedFile[],
  configHandler: ConfigHandler,
  lookup: Map<string, string>,
  selectedKeys: Set<string>
): McpExclusion[] {
  const exclusions: McpExclusion[] = [];
  forEachMcpFile(generated, configHandler, lookup, (file, sectionKey) => {
    for (const key of parseEntryKeys(file.content, sectionKey)) {
      if (!selectedKeys.has(key)) exclusions.push({ configPath: file.relativePath, entryKey: key });
    }
  });
  return exclusions;
}

/**
 * Returns MCP entries present in the new distribution that are genuinely new:
 * not tracked in manifest merge entries, and not already excluded.
 */
export function detectNewMcpEntries(
  generated: GeneratedFile[],
  configHandler: ConfigHandler,
  lookup: Map<string, string>,
  manifestEntries: readonly MergeFileEntry[],
  excluded: readonly McpExclusion[]
): McpExclusion[] {
  const newEntries: McpExclusion[] = [];
  forEachMcpFile(generated, configHandler, lookup, (file, sectionKey) => {
    const manifestEntry = manifestEntries.find((m) => m.relativePath === file.relativePath);
    const knownKeys = manifestEntry
      ? new Set(Object.keys(manifestEntry.entries))
      : new Set<string>();
    for (const key of parseEntryKeys(file.content, sectionKey)) {
      if (knownKeys.has(key)) continue;
      if (excluded.some((e) => e.configPath === file.relativePath && e.entryKey === key)) continue;
      newEntries.push({ configPath: file.relativePath, entryKey: key });
    }
  });
  return newEntries;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function forEachMcpFile(
  generated: GeneratedFile[],
  configHandler: ConfigHandler,
  lookup: Map<string, string>,
  callback: (file: GeneratedFile, sectionKey: string) => void
): void {
  for (const file of generated) {
    if (file.mergeStrategy === "none") continue;
    const sectionKey = resolveSectionKey(file, configHandler, lookup);
    if (sectionKey !== null) callback(file, sectionKey);
  }
}

function resolveSectionKey(
  file: GeneratedFile,
  configHandler: ConfigHandler,
  lookup: Map<string, string>
): string | null {
  const configName = file.frameworkPath ? lookup.get(file.frameworkPath) : undefined;
  if (!configName) return null;
  return configHandler.entrySection(configName);
}

function filterFileContent(
  file: GeneratedFile,
  sectionKey: string,
  excludedKeys: Set<string>,
  hasher: Hasher
): GeneratedFile {
  try {
    const parsed = JSON.parse(file.content) as Record<string, unknown>;
    const section = parsed[sectionKey] as Record<string, unknown> | undefined;
    if (!section || typeof section !== "object") return file;
    const kept: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(section)) {
      if (!excludedKeys.has(key)) kept[key] = value;
    }
    parsed[sectionKey] = kept;
    const content = JSON.stringify(parsed, null, 2);
    return new GeneratedFile({
      relativePath: file.relativePath,
      content,
      hash: hasher.hash(content),
      mergeStrategy: file.mergeStrategy,
      frameworkPath: file.frameworkPath,
    });
  } catch {
    return file;
  }
}

function transformMcpForWin32(content: string): string {
  const config = JSON.parse(content) as McpConfig;

  if (!config.mcpServers) return JSON.stringify(config, null, 2);

  for (const server of Object.values(config.mcpServers)) {
    if (server.command === "npx") {
      server.args = ["/c", "npx", ...(server.args ?? [])];
      server.command = "cmd";
    } else if (server.command === "uvx") {
      server.command = "uvx.exe";
    } else if (server.command === "uv") {
      server.command = "uv.exe";
    }
  }

  return JSON.stringify(config, null, 2);
}
