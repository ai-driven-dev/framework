# Distribution

Where a plugin's content comes from: the registered marketplaces, the trust given to a source, the cache and the fetch. The context's language is `src/contexts/distribution/glossary.md`; its shape is the `reference-context.md` rule.

## Known defect

- D1: `marketplace add --overwrite` removes the old entry before it fetches the new one (`AddMarketplace.assertNotRegistered`, then `resolveMarketplace`). A fetch that fails leaves the previous entry removed. `tests/contexts/distribution/application/add-marketplace.unit.test.ts` pins that, and the fix flips that test: fetch first, then remove and save.

## Reserved

- D2: `ListMarketplaceReleases` and `AssertMarketplaceReadable` commands, absorbing the guard in framework's `setup-marketplace-registration-use-case.ts`.
- D3: ports in `shared/ports`, once a second consumer context appears.
- D4: a `contract/` for distribution and its place in `HELD_BY_BIOME`, with the framework split (M8).
- D5: split `plugin-fetcher-adapter.ts` into a git source fetcher and an npm source fetcher.
- D6: `catalog.ts` into `catalog-parsers/claude-marketplace-catalog.ts`, and the catalog precedence into the domain.
- D7: the trust store over shared private storage.
- D8: `atomic-write.ts` into `shared/infrastructure/`.
- D9: the release adapter merged into a shared GitHub adapter, and a rule pinning `api.github.com` to one file.
- D10: the `Deps` keys (`releaseResolver`, `marketplaceAddUseCase`) renamed.
- D11: the marketplace fakes, `fixture-plugin-fetcher.ts` and `fake-ensure-built-marketplace.ts` moved into `tests/contexts/distribution/testing/`.
- D12: contract kits for `PluginFetcher`, `PluginCatalogRepository`, `RawCatalogFetcher`, `ReleaseLister`, `RepositoryVisibility` and `MarketplaceRemover`.
- D13: the raw catalog fetcher over a `RepositoryReader` port.
- D14: `AddMarketplace` composed in `composition/distribution.ts` (M11).
