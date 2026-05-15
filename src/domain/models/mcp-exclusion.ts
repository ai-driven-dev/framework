import type { Hasher } from "../ports/hasher.js";
import { InstallationFile } from "./file.js";
import type { MergeFileEntry } from "./merge.js";
import { parseEntryKeys } from "./merge.js";

// ── Win32 platform transform ─────────────────────────────────────────────────

interface McpServerWin32 {
  command?: string;
  args?: string[];
  [key: string]: unknown;
}

interface McpConfigWin32 {
  mcpServers?: Record<string, McpServerWin32>;
  [key: string]: unknown;
}

function transformMcpForWin32(content: string): string {
  const config = JSON.parse(content) as McpConfigWin32;
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

export function transformFor(platform: string): ((content: string) => string) | undefined {
  return platform === "win32" ? transformMcpForWin32 : undefined;
}

// ── McpExclusion VO ──────────────────────────────────────────────────────────

export interface McpExclusion {
  readonly configPath: string;
  readonly entryKey: string;
}

export function mcpExclusionEquals(a: McpExclusion, b: McpExclusion): boolean {
  return a.configPath === b.configPath && a.entryKey === b.entryKey;
}

// ── MCP server key extraction and filtering ──────────────────────────────────

/** Returns a map of file relative path → available MCP server keys for each MCP-capable merge file. */
export function extractMcpKeys(
  generated: InstallationFile[],
  getEntrySection: (frameworkPath: string) => string | null
): Map<string, string[]> {
  const result = new Map<string, string[]>();
  forEachMcpFile(generated, getEntrySection, (file, sectionKey) => {
    const keys = parseEntryKeys(file.content, sectionKey);
    if (keys.length > 0) result.set(file.relativePath, keys);
  });
  return result;
}

/** Filters MCP entries from generated file content, removing entries listed in exclusions. */
export function filterMcpExclusions(
  generated: InstallationFile[],
  getEntrySection: (frameworkPath: string) => string | null,
  exclusions: readonly McpExclusion[],
  hasher: Hasher
): InstallationFile[] {
  if (exclusions.length === 0) return generated;
  return generated.map((file) => {
    if (file.mergeStrategy === "none") return file;
    const sectionKey = resolveSectionKey(file, getEntrySection);
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
  generated: InstallationFile[],
  getEntrySection: (frameworkPath: string) => string | null,
  selectedKeys: Set<string>
): McpExclusion[] {
  const exclusions: McpExclusion[] = [];
  forEachMcpFile(generated, getEntrySection, (file, sectionKey) => {
    for (const key of parseEntryKeys(file.content, sectionKey)) {
      if (!selectedKeys.has(key)) exclusions.push({ configPath: file.relativePath, entryKey: key });
    }
  });
  return exclusions;
}

/** Returns MCP entries present in generated files but not tracked in known entries and not already excluded. */
export function detectNewMcpEntries(
  generated: InstallationFile[],
  getEntrySection: (frameworkPath: string) => string | null,
  knownEntries: readonly MergeFileEntry[],
  excluded: readonly McpExclusion[]
): McpExclusion[] {
  const newEntries: McpExclusion[] = [];
  forEachMcpFile(generated, getEntrySection, (file, sectionKey) => {
    const known = findKnownEntries(knownEntries, file.relativePath, sectionKey);
    const excludedKeys = excludedKeysFor(excluded, file.relativePath);
    for (const key of parseEntryKeys(file.content, sectionKey)) {
      if (known.has(key) || excludedKeys.has(key)) continue;
      newEntries.push({ configPath: file.relativePath, entryKey: key });
    }
  });
  return newEntries;
}

function findKnownEntries(
  knownEntries: readonly MergeFileEntry[],
  relativePath: string,
  sectionKey: string
): Set<string> {
  const match = knownEntries.find(
    (e) => e.relativePath === relativePath && e.sectionKey === sectionKey
  );
  return new Set(match ? Object.keys(match.entries) : []);
}

function excludedKeysFor(excluded: readonly McpExclusion[], relativePath: string): Set<string> {
  return new Set(excluded.filter((e) => e.configPath === relativePath).map((e) => e.entryKey));
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function forEachMcpFile(
  generated: InstallationFile[],
  getEntrySection: (frameworkPath: string) => string | null,
  callback: (file: InstallationFile, sectionKey: string) => void
): void {
  for (const file of generated) {
    if (file.mergeStrategy === "none") continue;
    const sectionKey = resolveSectionKey(file, getEntrySection);
    if (sectionKey !== null) callback(file, sectionKey);
  }
}

function resolveSectionKey(
  file: InstallationFile,
  getEntrySection: (frameworkPath: string) => string | null
): string | null {
  if (!file.frameworkPath) return null;
  return getEntrySection(file.frameworkPath);
}

function filterFileContent(
  file: InstallationFile,
  sectionKey: string,
  excludedKeys: Set<string>,
  hasher: Hasher
): InstallationFile {
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
    return new InstallationFile({
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
