import type { Hasher } from "../ports/hasher.js";
import type { FileHash } from "./file-hash.js";
import type { ConfigRef } from "./framework-descriptor.js";
import type { GeneratedFile } from "./generated-file.js";
import type { ConfigHandler } from "./tool-config.js";

export interface MergeFileEntry {
  readonly relativePath: string;
  readonly sectionKey: string | null;
  readonly entries: Readonly<Record<string, FileHash>>;
}

export function extractMergeEntries(
  jsonContent: string,
  sectionKey: string | null,
  hasher: Hasher
): Record<string, FileHash> {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(stripComments(jsonContent)) as Record<string, unknown>;
  } catch {
    return {};
  }
  const container = resolveContainer(parsed, sectionKey);
  if (container === null || typeof container !== "object" || Array.isArray(container)) return {};
  const result: Record<string, FileHash> = {};
  for (const [key, value] of Object.entries(container as Record<string, unknown>)) {
    result[key] = hasher.hash(JSON.stringify(value));
  }
  return result;
}

function resolveContainer(parsed: Record<string, unknown>, sectionKey: string | null): unknown {
  if (sectionKey === null) return parsed;
  return parsed[sectionKey] ?? null;
}

function stripComments(content: string): string {
  let result = "";
  let i = 0;
  let inString = false;
  while (i < content.length) {
    const ch = content[i];
    if (inString) {
      if (ch === "\\" && i + 1 < content.length) {
        result += ch + content[i + 1];
        i += 2;
        continue;
      }
      if (ch === '"') inString = false;
      result += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inString = true;
      result += ch;
      i++;
      continue;
    }
    if (ch === "/" && content[i + 1] === "/") {
      while (i < content.length && content[i] !== "\n") i++;
      continue;
    }
    if (ch === "/" && content[i + 1] === "*") {
      i += 2;
      while (i < content.length && !(content[i] === "*" && content[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    if (ch === ",") {
      let j = i + 1;
      while (j < content.length && " \t\n\r".includes(content[j])) j++;
      if (content[j] === "}" || content[j] === "]") {
        i++;
        continue;
      }
    }
    result += ch;
    i++;
  }
  return result;
}

export function parseEntryKeys(content: string, sectionKey: string): string[] {
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const section = parsed[sectionKey];
    if (section === null || typeof section !== "object" || Array.isArray(section)) return [];
    return Object.keys(section as Record<string, unknown>);
  } catch {
    return [];
  }
}

export function removeEntriesFromJson(
  content: string,
  sectionKey: string | null,
  keysToRemove: string[]
): string {
  const parsed = JSON.parse(content) as Record<string, unknown>;
  const container =
    sectionKey !== null
      ? ((parsed[sectionKey] as Record<string, unknown> | undefined) ?? {})
      : parsed;
  for (const key of keysToRemove) {
    delete (container as Record<string, unknown>)[key];
  }
  return JSON.stringify(parsed, null, 2);
}

export function isMergeContentEmpty(content: string, sectionKey: string | null): boolean {
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    if (sectionKey === null) return Object.keys(parsed).length === 0;
    const otherKeys = Object.keys(parsed).filter((k) => k !== sectionKey);
    if (otherKeys.length > 0) return false;
    const section = parsed[sectionKey] as Record<string, unknown> | undefined;
    return !section || Object.keys(section).length === 0;
  } catch {
    return false;
  }
}

export function buildConfigNameLookup(configRefs: readonly ConfigRef[]): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const ref of configRefs) lookup.set(ref.path, ref.name);
  return lookup;
}

export function buildMergeFileEntries(
  distribution: GeneratedFile[],
  configHandler: ConfigHandler,
  configNameLookup: Map<string, string>,
  hasher: Hasher
): MergeFileEntry[] {
  const grouped = new Map<string, MergeFileEntry>();
  for (const file of distribution) {
    if (file.mergeStrategy === "none") continue;
    const configName = file.frameworkPath ? configNameLookup.get(file.frameworkPath) : undefined;
    const sectionKey = configName ? configHandler.entrySection(configName) : null;
    const hashes = extractMergeEntries(file.content, sectionKey, hasher);
    const key = `${file.relativePath}::${sectionKey ?? ""}`;
    const previous = grouped.get(key);
    grouped.set(key, {
      relativePath: file.relativePath,
      sectionKey,
      entries: { ...(previous?.entries ?? {}), ...hashes },
    });
  }
  return [...grouped.values()];
}
