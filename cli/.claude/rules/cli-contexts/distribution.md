---
description: Apply when marketplace registration, catalog fetching or the marketplace registry, trust store and cache change; the distribution context owns where content comes from and how it is fetched.
paths:
  - "src/contexts/distribution/**/*.ts"
  - "src/composition/distribution.ts"
  - "tests/contexts/distribution/**/*.ts"
---

# Distribution

## Reason to change

- Where a plugin's content comes from: which marketplaces are registered, trusted and cached, and how a catalog or a release is fetched.
- Its language is `src/contexts/distribution/glossary.md`; a name in the code means what that page says.
- Its shape is the strict reference: `reference-context.md`, beside this page.

## Ports

- `MarketplaceRegistry`, `MarketplaceTrustStore`, `MarketplaceCachePort`: each contract kit in `tests/contexts/distribution/testing/` runs on the in-memory fake and on the real adapter, so a test over the fake can be trusted. The cases of the registry kit are the ones the adapter answers over a directory.
- `MarketplaceRemover`, `ReleaseLister`, `RepositoryVisibility`, `PluginFetcher`, `PluginCatalogRepository`, `RawCatalogFetcher`: no contract kit yet. The reservations are in `aidd_docs/memory/internal/distribution.md`.
- `MarketplaceRemover` is held here and implemented by framework's remove commands, handed in by the wiring.

## Suppliers

- `auth`: the `TokenProvider` contract, for the adapters that read a private source.
- `kernel/`: errors, `Logger`, paths and the source value.
- Nothing from `framework/` or `runtime/`: biome denies both, and `biome-guards-bite.arch.test.ts` plants each.

## Never

- Import `framework/` or `runtime/`: framework asks for a marketplace, distribution never asks back.
- Change what a command prints or writes: the use-case tests, the contract kits, the adapter integration tests and the e2e `marketplace-add-conflict.e2e.test.ts` freeze the behaviour; the goldens hold help text only.
- Fix `marketplace add --overwrite` in passing. It removes the old entry before it fetches the new one, so a fetch that fails leaves the old entry gone. `add-marketplace.unit.test.ts` pins that as it is (D1, `aidd_docs/memory/internal/distribution.md`), and the fix flips that test.

## Limits

- `updateVersion` is held by no contract case and the adapter's own lines are not reached by any test; the in-memory fake is the only arm. A case would be new behaviour, not a move.
- The registry case "keeps one user entry for every project" has no one-line break to plant in the adapter arm: `userPath()` takes no project argument, so there is nothing to bend. It is proven on the fake only.
