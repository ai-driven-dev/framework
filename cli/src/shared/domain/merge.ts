import type { FileReader } from "../ports/file-reader.js";
import type { FileWriter } from "../ports/file-writer.js";
import type { Hasher } from "../ports/hasher.js";
import { JsonParseError } from "./errors.js";
import type { FileHash } from "./file.js";
import { stripJsonComments } from "./reading/jsonc.js";

export type PerKeyMergeStrategy = {
  default: "framework-prime" | "user-prime";
  /** Keys where framework always wins, overriding the default strategy. */
  frameworkOverrideKeys: readonly string[];
};

export type MergeStrategy = "none" | "framework-prime" | "user-prime" | PerKeyMergeStrategy;

export function isPerKeyMergeStrategy(s: MergeStrategy): s is PerKeyMergeStrategy {
  return typeof s === "object" && s !== null;
}

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
    parsed = JSON.parse(stripJsonComments(jsonContent)) as Record<string, unknown>;
  } catch {
    return {};
  }
  const container = resolveContainer(parsed, sectionKey);
  if (container === null || typeof container !== "object" || Array.isArray(container)) return {};
  return hashJsonEntries(container as Record<string, unknown>, hasher);
}

export function hashJsonEntries(
  entries: Record<string, unknown>,
  hasher: Hasher
): Record<string, FileHash> {
  const result: Record<string, FileHash> = {};
  for (const [key, value] of Object.entries(entries)) {
    result[key] = hasher.hash(JSON.stringify(value));
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
  if (Object.keys(container).length === 0) {
    delete parsed[sectionKey];
  } else {
    parsed[sectionKey] = container;
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

  if (isPerKeyMergeStrategy(strategy)) {
    await files.writeFile(path, JSON.stringify(mergePerKey(existing, incoming, strategy), null, 2));
    return;
  }

  const merged =
    strategy === "user-prime" ? deepMerge(incoming, existing) : deepMerge(existing, incoming);
  await files.writeFile(path, JSON.stringify(merged, null, 2));
}

// Intentionally shallow: a nested object is replaced wholesale, never merged into.
function mergePerKey(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
  strategy: PerKeyMergeStrategy
): Record<string, unknown> {
  const allKeys = new Set([...Object.keys(existing), ...Object.keys(incoming)]);
  const result: Record<string, unknown> = {};
  for (const key of allKeys) {
    const isFrameworkPrime = strategy.frameworkOverrideKeys.includes(key);
    const effectiveStrategy = isFrameworkPrime ? "framework-prime" : strategy.default;
    if (effectiveStrategy === "framework-prime") {
      result[key] = key in incoming ? incoming[key] : existing[key];
    } else {
      result[key] = key in existing ? existing[key] : incoming[key];
    }
  }
  return result;
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
