/**
 * Marketplace catalog and manifest shaping shared by more than one tool's build contract.
 *
 * A tool's build contract otherwise lives entirely inside that tool's own profile directory;
 * these are the exception, since claude and cursor emit byte-identical plugin manifests and
 * catalog entries. One tool importing another's directory would break the boundary, so both
 * reach this instead.
 */
import { join } from "node:path";
import { InvalidSourceMarketplaceError } from "../../../kernel/errors.js";
import type { BuildFileReader, PluginPresence } from "../contract/build-contract.js";

type SrcEntry =
  | {
      version?: string;
      description?: string;
      strict?: boolean;
      metadata?: { recommended?: boolean };
    }
  | undefined;

export interface SynthesizeSharedManifestOpts {
  /** When true, include `agents` as a list of `./agents/*.md` file paths if agents are present. */
  readonly agentsField: boolean;
  /**
   * When true, point `hooks` at `./hooks/hooks.json` if the plugin ships one. Declared per tool
   * because Claude Code loads that path by its own convention and rejects a plugin whose
   * manifest names it too — "Duplicate hooks file detected", while the hooks fired anyway, so
   * the plugin read as failed while working. Codex and the others still need the pointer.
   */
  readonly hooksField: boolean;
}

/** Synthesize a Claude-style plugin manifest, shared by the claude, cursor and copilot
 * strategies. Key insertion order is part of the output shape. */
export function synthesizeSharedManifest(
  source: Record<string, unknown>,
  presence: PluginPresence,
  opts: SynthesizeSharedManifestOpts
): Record<string, unknown> {
  const manifest: Record<string, unknown> = {};
  if (typeof source.name === "string") manifest.name = source.name;
  if (typeof source.description === "string") manifest.description = source.description;
  if (typeof source.version === "string") manifest.version = source.version;
  if (typeof source.author === "string" || typeof source.author === "object")
    manifest.author = source.author;
  if (typeof source.homepage === "string") manifest.homepage = source.homepage;
  if (typeof source.repository === "string") manifest.repository = source.repository;
  if (typeof source.license === "string") manifest.license = source.license;
  if (Array.isArray(source.keywords)) manifest.keywords = source.keywords;
  if (opts.agentsField && presence.agentsList.length > 0)
    manifest.agents = presence.agentsList.map((n) => `./agents/${n}`);
  if (presence.skillsList.length > 0)
    manifest.skills = presence.skillsList.map((n) => `./skills/${n}`);
  if (opts.hooksField && presence.hasHooksJson) manifest.hooks = "./hooks/hooks.json";
  if (presence.hasMcpJson) manifest.mcpServers = "./.mcp.json";
  return manifest;
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

export function buildSharedCatalogEntry(
  name: string,
  description: string,
  version: string,
  srcEntry: Record<string, unknown> | undefined
): Record<string, unknown> {
  const entry: Record<string, unknown> = {
    name,
    source: `./plugins/${name}`,
    description,
    version,
  };
  if (typeof srcEntry?.strict === "boolean") entry.strict = srcEntry.strict;
  const metadata = srcEntry?.metadata;
  const recommended =
    metadata !== null && typeof metadata === "object"
      ? (metadata as { recommended?: unknown }).recommended
      : undefined;
  if (typeof recommended === "boolean") entry.metadata = { recommended };
  return entry;
}

export async function resolveVersion(
  fs: BuildFileReader,
  name: string,
  srcEntry: { version?: string } | undefined,
  outDir: string,
  outputManifestRelative: string
): Promise<string> {
  if (srcEntry?.version) return srcEntry.version;
  const manifestPath = join(outDir, "plugins", name, outputManifestRelative);
  const raw = await fs.readFile(manifestPath);
  const manifest = JSON.parse(raw) as Record<string, unknown>;
  if (typeof manifest.version === "string") return manifest.version;
  throw new InvalidSourceMarketplaceError(
    `plugin '${name}' has no version in marketplace entry or plugin.json`
  );
}

export async function resolveDescription(
  fs: BuildFileReader,
  name: string,
  srcEntry: { description?: string } | undefined,
  outDir: string,
  outputManifestRelative: string
): Promise<string> {
  if (srcEntry?.description) return srcEntry.description;
  const manifestPath = join(outDir, "plugins", name, outputManifestRelative);
  const raw = await fs.readFile(manifestPath);
  const manifest = JSON.parse(raw) as Record<string, unknown>;
  if (typeof manifest.description === "string" && manifest.description.length > 0) {
    return manifest.description;
  }
  throw new InvalidSourceMarketplaceError(
    `plugin '${name}' has no description in marketplace entry or plugin.json`
  );
}

/** Resolve version and description, then shape the catalog entry — the marketplace-entry
 * builder claude and cursor both hand to `ToolBuildContract.buildMarketplaceEntry`. */
export async function buildSharedEntry(
  name: string,
  outDir: string,
  srcEntry: SrcEntry,
  manifestRelative: string,
  fs: BuildFileReader
): Promise<Record<string, unknown>> {
  const args = [fs, name, srcEntry, outDir, manifestRelative] as const;
  const version = await resolveVersion(...args);
  const description = await resolveDescription(...args);
  return buildSharedCatalogEntry(
    name,
    description,
    version,
    srcEntry as Record<string, unknown> | undefined
  );
}
