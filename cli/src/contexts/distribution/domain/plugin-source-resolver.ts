import { pathRulesOf, posixRelative } from "../../../shared/domain/paths.model.js";
import type { PluginSource, PluginSourceGitSubdir } from "../../../shared/domain/plugin/source.js";
import type { PluginCatalogEntry } from "../contract/catalog.js";
import type { PluginSourceMatch } from "../contract/plugin-source-match.js";
import type { Marketplace } from "./marketplace.js";

/** Where a marketplace is checked out on this machine, and the platform whose path rules spell it. */
export interface MarketplaceCheckout {
  readonly path: string;
  readonly platform: string;
}

/** `entry` of `marketplace`'s catalog, read from `checkout`, with the source an installer fetches it from. */
export function pluginSourceMatch(
  marketplace: Marketplace,
  checkout: MarketplaceCheckout,
  entry: PluginCatalogEntry
): PluginSourceMatch {
  return {
    marketplaceName: marketplace.name,
    githubMarketplace: marketplace.source.kind === "github",
    entry,
    source: resolvePluginSourceFromMarketplace(entry.source, marketplace, checkout),
  };
}

export function resolvePluginSourceFromMarketplace(
  entrySource: PluginSource,
  marketplace: Marketplace,
  checkout: MarketplaceCheckout
): PluginSource {
  if (entrySource.kind !== "local") return entrySource;
  if (marketplace.source.kind !== "github") return entrySource;

  const normalizedPath = toRelativePath(entrySource.path, checkout);
  if (normalizedPath === null) return entrySource;

  const resolved: PluginSourceGitSubdir = {
    kind: "git-subdir",
    url: `https://github.com/${marketplace.source.repo}.git`,
    path: normalizedPath,
    ref: marketplace.source.ref,
  };
  return resolved;
}

// `git sparse-checkout set` always reads a "/"-separated path, whichever OS wrote it.
function toRelativePath(sourcePath: string, checkout: MarketplaceCheckout): string | null {
  if (!pathRulesOf(checkout.platform).isAbsolute(sourcePath)) {
    const stripped = sourcePath.startsWith("./") ? sourcePath.slice(2) : sourcePath;
    return stripped.length > 0 ? stripped : null;
  }
  const rel = posixRelative(checkout.path, sourcePath, checkout.platform);
  if (rel.startsWith("..") || rel === "") return null;
  return rel;
}
