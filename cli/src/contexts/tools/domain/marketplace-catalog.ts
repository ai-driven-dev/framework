/**
 * Marketplace catalog and manifest shaping shared by more than one tool's build contract.
 *
 * A tool's build contract otherwise lives entirely inside that tool's own profile directory;
 * these are the exception, since claude and cursor emit byte-identical plugin manifests and
 * catalog entries. One tool importing another's directory would break the boundary, so both
 * reach this instead.
 */
import { join } from "node:path";
import type { BuildFileReader } from "../../../shared/domain/materialization/build-contract.js";
import type { PluginPresence } from "../../../shared/domain/materialization/plugin-presence.js";
import { asPlainObject } from "../../../shared/domain/reading/plain-object.js";
import { InvalidSourceMarketplaceError } from "../../../shared/domain/shared.error.js";

type SrcEntry =
  | {
      version?: string;
      description?: string;
      strict?: boolean;
      metadata?: { recommended?: boolean };
    }
  | undefined;

export interface SynthesizeSharedManifestOpts {
  /** When true, include `agents` as a list of `./agents/*` file paths, in the extension the tool reads, if agents are present. */
  readonly agentsField: boolean;
  /**
   * When true, point `hooks` at `./hooks/hooks.json` if the plugin ships one. Declared per tool
   * because Claude Code loads that path by its own convention and rejects a plugin whose
   * manifest names it too: "Duplicate hooks file detected", while the hooks fired anyway, so
   * the plugin read as failed while working. Codex and the others still need the pointer.
   */
  readonly hooksField: boolean;
  /** The file the manifest's `mcpServers` points at, relative to the plugin: `.mcp.json` unless
   * the tool reads its MCP servers from another file. */
  readonly mcpRelative?: string;
  /** The extension the tool reads an agent file by, when it is not the source's `.md`. */
  readonly agentExt?: string;
}

const isText = (value: unknown): value is string => typeof value === "string";
const isFilledText = (value: unknown): value is string => isText(value) && value.length > 0;

/** The source manifest's identity fields, in the order the output keeps them. */
const IDENTITY: readonly (readonly [string, (value: unknown) => boolean])[] = [
  ["name", isText],
  ["description", isText],
  ["version", isText],
  ["author", (value) => typeof value === "string" || typeof value === "object"],
  ["homepage", isText],
  ["repository", isText],
  ["license", isText],
  ["keywords", Array.isArray],
];

/** The source manifest's identity fields a tool keeps, in the order the output keeps them. */
export function identityFields(source: Record<string, unknown>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const [key, accepts] of IDENTITY) if (accepts(source[key])) fields[key] = source[key];
  return fields;
}

const withExt = (name: string, ext: string | undefined): string =>
  ext === undefined ? name : name.replace(/\.md$/, ext);

/** The skills, agents, hooks and MCP paths the built plugin ships. */
function shippedPaths(
  presence: PluginPresence,
  opts: SynthesizeSharedManifestOpts
): Record<string, unknown> {
  const paths: Record<string, unknown> = {};
  if (opts.agentsField && presence.agentsList.length > 0) {
    paths.agents = presence.agentsList.map((n) => `./agents/${withExt(n, opts.agentExt)}`);
  }
  if (presence.skillsList.length > 0) {
    paths.skills = presence.skillsList.map((n) => `./skills/${n}`);
  }
  if (opts.hooksField && presence.hasHooksJson) paths.hooks = "./hooks/hooks.json";
  if (presence.hasMcpJson) paths.mcpServers = `./${opts.mcpRelative ?? ".mcp.json"}`;
  return paths;
}

/** Synthesize the plugin manifest shared by the claude, cursor and copilot strategies: the
 * source manifest's identity fields, then the skills, agents, hooks and MCP paths the built
 * plugin ships, all as `./`-relative paths. Key insertion order is part of the output shape. */
export function synthesizeSharedManifest(
  source: Record<string, unknown>,
  presence: PluginPresence,
  opts: SynthesizeSharedManifestOpts
): Record<string, unknown> {
  return { ...identityFields(source), ...shippedPaths(presence, opts) };
}

export function buildSharedMarketplace(
  source: { name: string; version?: string; description?: string; owner?: unknown },
  pluginEntries: readonly Record<string, unknown>[]
): Record<string, unknown> {
  const obj: Record<string, unknown> = { name: source.name };
  if (typeof source.version === "string") obj.version = source.version;
  if (typeof source.description === "string") obj.description = source.description;
  if (source.owner !== undefined) obj.owner = source.owner;
  obj.plugins = pluginEntries;
  return obj;
}

export function buildSharedCatalogEntry({
  name,
  description,
  version,
  srcEntry,
}: {
  name: string;
  description: string;
  version: string;
  srcEntry: Record<string, unknown> | undefined;
}): Record<string, unknown> {
  const entry: Record<string, unknown> = {
    name,
    source: `./plugins/${name}`,
    description,
    version,
  };
  if (typeof srcEntry?.strict === "boolean") entry.strict = srcEntry.strict;
  const metadata = srcEntry?.metadata;
  const recommended = asPlainObject(metadata)?.recommended;
  if (typeof recommended === "boolean") entry.metadata = { recommended };
  return entry;
}

/** What a marketplace entry is resolved from: the source entry, else the plugin's built manifest. */
export interface EntrySource {
  readonly fs: BuildFileReader;
  readonly name: string;
  readonly srcEntry: SrcEntry;
  readonly outDir: string;
  readonly outputManifestRelative: string;
}

/** The entry's own `field`, else the plugin's built manifest's, read as `accepted` says. */
async function resolveField(
  { fs, name, srcEntry, outDir, outputManifestRelative }: EntrySource,
  field: "version" | "description",
  accepted: (value: unknown) => value is string
): Promise<string> {
  const own = srcEntry?.[field];
  if (own) return own;
  const raw = await fs.readFile(join(outDir, "plugins", name, outputManifestRelative));
  const value = (JSON.parse(raw) as Record<string, unknown>)[field];
  if (accepted(value)) return value;
  throw new InvalidSourceMarketplaceError(
    `plugin '${name}' has no ${field} in marketplace entry or plugin.json`
  );
}

export const resolveVersion = (source: EntrySource): Promise<string> =>
  resolveField(source, "version", isText);

export const resolveDescription = (source: EntrySource): Promise<string> =>
  resolveField(source, "description", isFilledText);

/** Resolve version and description, then shape the catalog entry: the marketplace-entry
 * builder claude and cursor both hand to `ToolBuildContract.buildMarketplaceEntry`. */
export async function buildSharedEntry(source: EntrySource): Promise<Record<string, unknown>> {
  const version = await resolveVersion(source);
  const description = await resolveDescription(source);
  return buildSharedCatalogEntry({
    name: source.name,
    description,
    version,
    srcEntry: source.srcEntry as Record<string, unknown> | undefined,
  });
}
