import { FetchMarketplaceSource } from "../../../../src/contexts/distribution/application/fetch-marketplace-source.js";
import { ResolveMarketplace } from "../../../../src/contexts/distribution/application/resolve-marketplace.js";
import type { PluginCatalog } from "../../../../src/contexts/distribution/contract/catalog.js";

/** Where a marketplace fetched from a repository lands in these tests. */
export function fetchedPathOf(repo: string): string {
  return `/fetched/${repo}`;
}

/**
 * A resolver over catalogs keyed by the path their marketplace resolves to: a local source's own
 * path, or `fetchedPathOf(repo)` for a repository. A catalog of `null` is a marketplace with none,
 * an `Error` is a fetch that fails.
 */
export function resolvingCatalogs(
  catalogs: Readonly<Record<string, PluginCatalog | Error | null>>
): ResolveMarketplace {
  const pathOf = (source: { kind: string; path?: string; repo?: string }): string =>
    source.kind === "local" ? String(source.path) : fetchedPathOf(String(source.repo));
  const fetcher = new FetchMarketplaceSource({
    pluginFetcher: {
      fetch: async (source) => {
        const path = pathOf(source);
        const catalog = catalogs[path];
        if (catalog instanceof Error) throw catalog;
        return path;
      },
    },
  });
  return new ResolveMarketplace(fetcher, {
    load: async (path) => {
      const catalog = catalogs[path];
      return catalog instanceof Error ? null : (catalog ?? null);
    },
  });
}
