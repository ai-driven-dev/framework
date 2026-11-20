---
description: Apply when marketplace registration, catalog fetching, or the registry, trust store or cache changes.
paths:
  - "src/contexts/distribution/**/*.ts"
  - "src/composition/distribution.ts"
  - "tests/contexts/distribution/**/*.ts"
---

# Distribution

## Reason to change

- Where a plugin's content comes from: which marketplaces are registered, trusted and cached, and how a catalog or a release is fetched.
- Its language is `src/contexts/distribution/glossary.md`, its shape `reference-context.md`.

## Ports

- `MarketplaceRegistry`, `MarketplaceTrustStore`, `MarketplaceCachePort`: each contract kit in `tests/contexts/distribution/testing/` runs on the fake and on the real adapter.
- `updateVersion` has a caller, `RefreshMarketplace`, and no contract case: no test reaches the adapter's own lines.
- The registry case "keeps one user entry for every project" has no one-line break to plant in the adapter arm: `userPath()` takes no project argument.
- `MarketplaceRemover`, `RepositoryVisibility`, `PluginFetcher`, `PluginCatalogRepository`, `RawCatalogFetcher`: no contract kit yet.
- `MarketplaceRemover` is answered by `src/composition/orchestration/marketplace.ts`, which hands it to the add command.
- Outside importers reach only the modules listed for distribution in `context-boundary.arch.test.ts`.

## Suppliers

- `auth/contract/token-provider.ts`: the token for a private source (edge `distribution->auth`).
- `shared/`: errors, `Logger`, `aidd-layout`, the source value, scope, tool, `FileReader`, `FileWriter`, `VersionReader`, `HttpGet`, `Prompter`, `FileHash`.
- `simple-git`: the git fetch, in the plugin fetcher adapter.

## Never

- Import any context but auth: callers ask distribution, it never asks back.
- Branch on a catalog's origin above the domain: each foreign shape has a parser in `domain/catalog-parsers/` yielding the one catalog shape.
- Put a technical constant in a port, a command or the domain: base URLs, TTLs and error patterns belong to the adapter, and an adapter catches only to type a raw error.
- Change what a command prints or writes: the use-case tests, the contract kits and `marketplace-add-conflict.e2e.test.ts` freeze it.
- Fix `marketplace add --overwrite` in passing: `add-marketplace.unit.test.ts` pins it, and `aidd_docs/memory/internal/distribution.md` says how.
