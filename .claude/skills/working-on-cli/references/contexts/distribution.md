# distribution

Where a plugin's content comes from: which marketplaces are registered, trusted and cached, how a catalog or release is fetched, how a fetched distribution is read. Language: `src/contexts/distribution/glossary.md`. Internals: [distribution.md](../../../../../aidd_docs/memory/internal/cli/distribution.md).

## Ports

- `MarketplaceRegistry`, `MarketplaceTrustStore`, `MarketplaceCachePort`, `PluginFetcher`, `RawCatalogFetcher`: each contract kit in `tests/contexts/distribution/testing/` runs on the fake and the real adapter.
- `RepositoryVisibility`, `PluginDistributionReader`, `PluginCatalogRepository`: no contract kit yet.
- `updateVersion` has a caller (`RefreshMarketplace`) and no contract case. The registry case "keeps one user entry for every project" has no one-line plant: `userPath()` takes no project argument.

## Suppliers

- `auth/contract/token-provider.ts` for a private source (edge `distribution->auth`); `simple-git` in the plugin fetcher adapter.
- `shared/`: errors, `Logger`, `aidd-layout`, the source value, scope, tool, `FileReader`, `FileWriter`, `VersionReader`, `HttpGet`, `FileHash`.

## Never

- Import any context but auth: callers ask distribution, it never asks back.
- Branch on a catalog's origin above the domain: each foreign shape has a parser in `domain/catalog-parsers/` yielding the one catalog shape.
- Put a technical constant (base URL, TTL, error pattern) in a port, a command or the domain.
- Fix `marketplace add --overwrite` in passing: `tests/orchestration/marketplace/add-marketplace.use-case.unit.test.ts` pins it, and `distribution.md` says how.
