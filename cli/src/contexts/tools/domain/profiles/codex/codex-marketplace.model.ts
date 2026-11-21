import type { PluginPresence } from "../../../contract/build-contract.js";

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

export function buildCodexManifest(
  source: Record<string, unknown>,
  presence: PluginPresence
): Record<string, unknown> {
  const manifest: Record<string, unknown> = {};
  copyCodexManifestStringFields(source, manifest);
  // The agents field is omitted: the Codex plugin schema has no such key. `skills` must be a
  // STRING directory: the array form makes `codex plugin add` fail with "missing or invalid
  // plugin.json".
  if (presence.skillsList.length > 0) manifest.skills = "./skills";
  if (presence.hasHooksJson) manifest.hooks = "./hooks/hooks.json";
  if (presence.hasMcpJson) manifest.mcpServers = "./.mcp.json";
  return manifest;
}

// Codex-native marketplace catalog, for `codex plugin marketplace add`. Shape verified against
// OpenAI's own published plugins marketplace and its plugin-build documentation.

/** Default category when the source marketplace entry does not specify one. */
const CODEX_DEFAULT_CATEGORY = "Developer Tools";
/** Default per-plugin auth policy. AIDD plugins bundle skills/agents/hooks with no external
 * OAuth, so auth is deferred to first use rather than forced at install. */
const CODEX_DEFAULT_AUTHENTICATION = "ON_USE";
const CODEX_INSTALLATION_AVAILABLE = "AVAILABLE";

/** Build a Codex marketplace catalog. `displayName` falls back to the marketplace name when
 * the source omits it. */
export function buildCodexMarketplace(
  source: { name: string; displayName?: string },
  pluginEntries: readonly Record<string, unknown>[]
): Record<string, unknown> {
  const displayName = typeof source.displayName === "string" ? source.displayName : source.name;
  return { name: source.name, interface: { displayName }, plugins: pluginEntries };
}

/** Build a single Codex marketplace entry. `installation`, `authentication` and `category` are
 * required by the plugin-creator spec; the last two accept a source-entry override. */
export function buildCodexMarketplaceEntry(
  name: string,
  srcEntry: Record<string, unknown> | undefined
): Record<string, unknown> {
  const authentication =
    typeof srcEntry?.authentication === "string"
      ? srcEntry.authentication
      : CODEX_DEFAULT_AUTHENTICATION;
  const category =
    typeof srcEntry?.category === "string" ? srcEntry.category : CODEX_DEFAULT_CATEGORY;
  return {
    name,
    source: { source: "local", path: `./plugins/${name}` },
    policy: { installation: CODEX_INSTALLATION_AVAILABLE, authentication },
    category,
  };
}
