import type { FileReader } from "../ports/file-reader.js";
import type { FileWriter } from "../ports/file-writer.js";
import { JsonParseError } from "./errors.js";
import { FileHash } from "./file.js";
import { stripJsonComments } from "./reading/jsonc.js";

export type MergeStrategy = "none" | "framework-prime" | "user-prime";

export interface MergeFileEntry {
  readonly relativePath: string;
  readonly sectionKey: string | null;
  readonly entries: Readonly<Record<string, FileHash>>;
}

export function extractMergeEntries(
  jsonContent: string,
  sectionKey: string | null
): Record<string, FileHash> {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(stripJsonComments(jsonContent)) as Record<string, unknown>;
  } catch {
    return {};
  }
  const container = resolveContainer(parsed, sectionKey);
  if (container === null || typeof container !== "object" || Array.isArray(container)) return {};
  return hashJsonEntries(container as Record<string, unknown>);
}

export function hashJsonEntries(entries: Record<string, unknown>): Record<string, FileHash> {
  const result: Record<string, FileHash> = {};
  for (const [key, value] of Object.entries(entries)) {
    result[key] = FileHash.of(JSON.stringify(value));
  }
  return result;
}

function resolveContainer(parsed: Record<string, unknown>, sectionKey: string | null): unknown {
  if (sectionKey === null) return parsed;
  return parsed[sectionKey] ?? null;
}

export function removeEntriesFromJson(
  content: string,
  sectionKey: string | null,
  keysToRemove: string[]
): string {
  const parsed = JSON.parse(content) as Record<string, unknown>;
  if (sectionKey === null) {
    for (const key of keysToRemove) delete parsed[key];
    return JSON.stringify(parsed, null, 2);
  }
  const container = (parsed[sectionKey] as Record<string, unknown> | undefined) ?? {};
  for (const key of keysToRemove) delete container[key];
  // An emptied section must vanish, not linger as `{}`: a settings file sharing its top
  // level with unrelated keys must come back byte-identical once every key we own is gone.
  if (Object.keys(container).length === 0) delete parsed[sectionKey];
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

export async function mergeIntoJsonFile(
  files: FileReader & FileWriter,
  path: string,
  content: string,
  strategy: MergeStrategy
): Promise<void> {
  let existing: Record<string, unknown> = {};

  try {
    const raw = await files.readFile(path);
    existing = JSON.parse(stripJsonComments(raw)) as Record<string, unknown>;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      throw new JsonParseError(path, (err as Error).message);
    }
  }

  const incoming = JSON.parse(stripJsonComments(content)) as Record<string, unknown>;

  const merged =
    strategy === "user-prime" ? deepMerge(incoming, existing) : deepMerge(existing, incoming);
  await files.writeFile(path, JSON.stringify(merged, null, 2));
}

const PROTOTYPE_POLLUTION_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...target };

  for (const [key, value] of Object.entries(source)) {
    if (PROTOTYPE_POLLUTION_KEYS.has(key)) continue;
    const existing = result[key];

    if (Array.isArray(value) && Array.isArray(existing)) {
      // A JSON-serialized key, so objects deduplicate as well as primitives.
      const combined = [...existing, ...value];
      result[key] = [...new Map(combined.map((v) => [JSON.stringify(v), v])).values()];
    } else if (isPlainObject(value) && isPlainObject(existing)) {
      result[key] = deepMerge(
        existing as Record<string, unknown>,
        value as Record<string, unknown>
      );
    } else {
      result[key] = value;
    }
  }

  return result;
}

function isPlainObject(value: unknown): boolean {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
