import { errorMessage } from "./describe-error.js";
import { FileHash } from "./file-hash.js";
import { isErrnoException, tryParseJson } from "./reading/json-file.js";
import { stripJsonComments } from "./reading/jsonc.js";
import { asPlainObject } from "./reading/plain-object.js";
import { JsonParseError } from "./shared.error.js";

export type MergeStrategy = "none" | "framework-prime" | "user-prime";

export interface MergeFileEntry {
  readonly relativePath: string;
  readonly sectionKey: string | null;
  readonly entries: Readonly<Record<string, FileHash>>;
}

export type MergeEntriesRead =
  | { readonly ok: true; readonly entries: Record<string, FileHash> }
  | { readonly ok: false; readonly reason: string };

/** An unreadable file is not an empty one: the reason comes back instead of an empty map. */
export function readMergeEntries(jsonContent: string, sectionKey: string | null): MergeEntriesRead {
  const parsed = tryParseJson(stripJsonComments(jsonContent));
  if (!parsed.ok) {
    return {
      ok: false,
      reason: errorMessage(parsed.error),
    };
  }
  const root = asPlainObject(parsed.value);
  if (root === null) return { ok: true, entries: {} };
  const container = asPlainObject(sectionKey === null ? root : root[sectionKey]);
  return { ok: true, entries: container === null ? {} : hashJsonEntries(container) };
}

/** Throws `JsonParseError` naming `path` when the content is not JSON. */
export function extractMergeEntries(
  jsonContent: string,
  sectionKey: string | null,
  path: string
): Record<string, FileHash> {
  const read = readMergeEntries(jsonContent, sectionKey);
  if (!read.ok) throw new JsonParseError(path, read.reason);
  return read.entries;
}

export function hashJsonEntries(entries: Record<string, unknown>): Record<string, FileHash> {
  const result: Record<string, FileHash> = {};
  for (const [key, value] of Object.entries(entries)) {
    result[key] = FileHash.of(JSON.stringify(value));
  }
  return result;
}

export function removeEntriesFromJson(
  content: string,
  sectionKey: string | null,
  keysToRemove: string[]
): string {
  const value: unknown = JSON.parse(content);
  const parsed = asPlainObject(value);
  // A root that is not an object holds none of the keys we track: it is written back as it is.
  if (parsed === null) return JSON.stringify(value, null, 2);
  if (sectionKey === null) {
    deleteKeys(parsed, keysToRemove);
    return JSON.stringify(parsed, null, 2);
  }
  const section = parsed[sectionKey] ?? {};
  deleteKeys(asPlainObject(section), keysToRemove);
  // An emptied section must vanish, not linger as `{}`: a settings file sharing its top
  // level with unrelated keys must come back byte-identical once every key we own is gone.
  if (Object.keys(section).length === 0) delete parsed[sectionKey];
  return JSON.stringify(parsed, null, 2);
}

function deleteKeys(container: Record<string, unknown> | null, keys: readonly string[]): void {
  if (container === null) return;
  for (const key of keys) delete container[key];
}

export function isMergeContentEmpty(content: string, sectionKey: string | null): boolean {
  // biome-ignore lint/plugin: content that does not parse is not empty, so the file is kept
  try {
    const parsed = asPlainObject(JSON.parse(content));
    // Limit: a root that is not an object is never empty here, not even `[]`; no merge file
    // with such a root has been seen.
    if (parsed === null) return false;
    if (sectionKey === null) return Object.keys(parsed).length === 0;
    const otherKeys = Object.keys(parsed).filter((k) => k !== sectionKey);
    if (otherKeys.length > 0) return false;
    const section = parsed[sectionKey];
    return !section || Object.keys(section).length === 0;
  } catch {
    return false;
  }
}

/** The two file operations a merge needs; any file adapter satisfies it. */
export interface MergeTarget {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
}

export interface JsonMerge {
  readonly path: string;
  readonly content: string;
  readonly strategy: MergeStrategy;
}

export async function mergeIntoJsonFile(
  files: MergeTarget,
  { path, content, strategy }: JsonMerge
): Promise<void> {
  const existing = await readExistingJson(files, path);
  const incoming = asPlainObject(JSON.parse(stripJsonComments(content))) ?? {};

  const merged =
    strategy === "user-prime" ? deepMerge(incoming, existing) : deepMerge(existing, incoming);
  await files.writeFile(path, JSON.stringify(merged, null, 2));
}

/** Limit: a file whose root is not an object merges as an empty one; no such file has been seen. */
async function readExistingJson(
  files: MergeTarget,
  path: string
): Promise<Record<string, unknown>> {
  try {
    const raw = await files.readFile(path);
    return asPlainObject(JSON.parse(stripJsonComments(raw))) ?? {};
  } catch (err) {
    rethrowUnlessMissing(path, err);
    return {};
  }
}

function rethrowUnlessMissing(path: string, err: unknown): void {
  const code = isErrnoException(err) ? err.code : undefined;
  if (code === "ENOENT") return;
  throw new JsonParseError(path, errorMessage(err));
}

const PROTOTYPE_POLLUTION_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...target };

  for (const [key, value] of Object.entries(source)) {
    if (PROTOTYPE_POLLUTION_KEYS.has(key)) continue;
    result[key] = mergeValue(result[key], value);
  }

  return result;
}

function mergeValue(existing: unknown, value: unknown): unknown {
  if (Array.isArray(value) && Array.isArray(existing)) {
    // A JSON-serialized key, so objects deduplicate as well as primitives.
    const combined = [...existing, ...value];
    return [...new Map(combined.map((v) => [JSON.stringify(v), v])).values()];
  }
  if (isPlainObject(value) && isPlainObject(existing)) return deepMerge(existing, value);
  return value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return asPlainObject(value) !== null;
}
