import { FileHash } from "../../../../../shared/domain/file-hash.js";
import { stripJsonComments } from "../../../../../shared/domain/reading/jsonc.js";
import {
  McpServerEditedError,
  UnprovenMcpServerDigestError,
} from "../../../contract/errors/tools.error.js";

interface TypedMcpFile {
  mcp?: Record<string, unknown>;
}

const MCP_COLLISION_REASON =
  "server already exists in opencode.json (user-owned); plugin entry skipped";

/**
 * Merges incoming OpenCode-format MCP servers into the existing opencode.json.
 *
 * Keys this plugin contributed before are stripped first, so a re-install is idempotent; a
 * user-owned server is preserved, and an incoming server colliding with one is skipped and
 * returned as a collision. Both inputs must be JSON serialized with a two-space indent.
 */
export function mergeTypedMcp(
  existingContent: string | null,
  incomingTransformed: string,
  previousEntriesForThisPlugin: ReadonlyMap<string, string>
): {
  mergedContent: string;
  contributedEntries: ReadonlyMap<string, string>;
  collisions: ReadonlyArray<string>;
  editedPreviousEntries: ReadonlyArray<string>;
} {
  const { full, mcp } = parseExisting(existingContent);
  const incoming = parseIncoming(incomingTransformed);
  const { cleaned, editedPreviousEntries } = stripPreviousEntries(
    mcp,
    previousEntriesForThisPlugin
  );
  return { ...applyIncoming(full, cleaned, incoming), editedPreviousEntries };
}

/**
 * Builds the opencode.json the flat framework build emits: written even with zero MCP servers,
 * so the archive always ships a config, matching every sibling flat target.
 *
 * The framework-owned keys come from `baseConfig`, the same bundled asset the install path
 * writes, and win over a stale existing copy; any other top-level key is preserved. `mcp` is
 * omitted entirely when neither side contributes one, as is a `mergedKeys` list left empty, and
 * malformed `existing` content throws rather than being silently discarded.
 */
export function buildTypedMcpFlatConfig({
  baseConfig,
  existing,
  incoming,
  mergedKeys = [],
}: {
  baseConfig: string;
  existing: string | null;
  incoming: Record<string, unknown>;
  mergedKeys?: readonly string[];
}): string {
  const base = JSON.parse(baseConfig) as Record<string, unknown>;
  const { full, mcp } = parseExisting(existing);
  const userKeys = { ...full };
  for (const key of Object.keys(base)) delete userKeys[key];
  delete userKeys.mcp;
  const mergedMcp = { ...mcp };
  for (const [name, server] of Object.entries(incoming)) {
    if (!(name in mergedMcp)) mergedMcp[name] = server;
  }
  const result: Record<string, unknown> = { ...base, ...userKeys };
  for (const key of mergedKeys) {
    const existingValues = arrayEntries(full[key]);
    const baseValues = arrayEntries(base[key]);
    const generated = baseValues.filter((value) => !existingValues.includes(value));
    const listed = [...existingValues, ...generated];
    if (listed.length > 0) result[key] = listed;
  }
  delete result.mcp;
  if (Object.keys(mergedMcp).length > 0) result.mcp = mergedMcp;
  return JSON.stringify(result, null, 2);
}

function arrayEntries(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

/** Removes servers previously contributed by a plugin from opencode.json's mcp section. A key
 * absent from `entries` is left untouched. */
export function unmergeTypedMcp(
  existingContent: string,
  entries: ReadonlyMap<string, string>
): string {
  const parsed = JSON.parse(stripJsonComments(existingContent)) as TypedMcpFile;
  const mcp = { ...(parsed.mcp ?? {}) };
  for (const [name, digest] of entries) {
    if (!(name in mcp)) continue;
    assertContributedServerUnchanged(name, mcp[name], digest);
    delete mcp[name];
  }
  return JSON.stringify({ ...parsed, mcp }, null, 2);
}

function parseExisting(content: string | null): {
  full: Record<string, unknown>;
  mcp: Record<string, unknown>;
} {
  if (content === null) return { full: {}, mcp: {} };
  // opencode.json is user-owned and may be JSONC (comments / trailing commas).
  const parsed = JSON.parse(stripJsonComments(content)) as TypedMcpFile;
  return {
    full: parsed as Record<string, unknown>,
    mcp: (parsed.mcp as Record<string, unknown>) ?? {},
  };
}

function parseIncoming(transformed: string): Record<string, unknown> {
  const parsed = JSON.parse(transformed) as TypedMcpFile;
  return (parsed.mcp as Record<string, unknown>) ?? {};
}

function stripPreviousEntries(
  existing: Record<string, unknown>,
  previous: ReadonlyMap<string, string>
): { cleaned: Record<string, unknown>; editedPreviousEntries: readonly string[] } {
  const result = { ...existing };
  const editedPreviousEntries: string[] = [];
  for (const [name, digest] of previous) {
    if (!(name in result)) continue;
    const unedited =
      FileHash.isDigest(digest) &&
      FileHash.of(JSON.stringify(result[name])).equals(new FileHash(digest));
    if (unedited) delete result[name];
    else editedPreviousEntries.push(name);
  }
  return { cleaned: result, editedPreviousEntries };
}

function applyIncoming(
  full: Record<string, unknown>,
  cleanedMcp: Record<string, unknown>,
  incoming: Record<string, unknown>
): {
  mergedContent: string;
  contributedEntries: ReadonlyMap<string, string>;
  collisions: ReadonlyArray<string>;
} {
  const mcp = { ...cleanedMcp };
  const contributed = new Map<string, string>();
  const collisions: string[] = [];
  for (const [name, server] of Object.entries(incoming)) {
    if (name in cleanedMcp) {
      collisions.push(`${name}: ${MCP_COLLISION_REASON}`);
      continue;
    }
    mcp[name] = server;
    contributed.set(name, FileHash.of(JSON.stringify(server)).value);
  }
  const mergedContent = JSON.stringify({ ...full, mcp }, null, 2);
  return { mergedContent, contributedEntries: contributed, collisions };
}

function assertContributedServerUnchanged(name: string, server: unknown, digest: string): void {
  if (!FileHash.isDigest(digest)) throw new UnprovenMcpServerDigestError(name);
  if (!FileHash.of(JSON.stringify(server)).equals(new FileHash(digest))) {
    throw new McpServerEditedError(name);
  }
}
