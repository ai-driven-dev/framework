# Distribution

Where a plugin's content comes from: the registered marketplaces, the trust given to a source, the cache and the fetch. The context's language is `src/contexts/distribution/glossary.md`; its shape is the `reference-context.md` rule.

## Known defect

- D1: `marketplace add --overwrite` removes the old entry before it fetches the new one (`AddMarketplace.assertNotRegistered`, then `resolveMarketplace`). A fetch that fails leaves the previous entry removed. `tests/contexts/distribution/application/add-marketplace.unit.test.ts` pins that, and the fix flips that test: fetch first, then remove and save. Vanishes with the next distribution PR, which flips the pinning test.

## Reserved

- D2: `ListMarketplaceReleases` and `AssertMarketplaceReadable` commands, absorbing the guard in framework's `setup-marketplace-registration-use-case.ts`. Vanishes with the framework split.
- D3: ports in `shared/ports`, once a second consumer context appears. Vanishes with a second consumer context appearing.
- D4: a `contract/` for distribution and its place in `HELD_BY_BIOME`, with the framework split (M8). Vanishes with the framework split (M8).
- D5: split `plugin-fetcher-adapter.ts` into a git source fetcher and an npm source fetcher. Vanishes with the next distribution PR.
- D6: `catalog.ts` into `catalog-parsers/claude-marketplace-catalog.ts`, and the catalog precedence into the domain. Vanishes with the next distribution PR.
- D7: the trust store over shared private storage. `marketplace-trust-store-adapter.ts:57-59` writes with `mkdir` and `writeFile` at the default mode, non-atomically, where `private-storage-adapter.ts:41,68-69` uses directory `0o700`, file `0o600` and temp-file-then-rename. Private storage lives in `contexts/telemetry/infrastructure/storage/` and the trust store does not import it, so no `distribution->telemetry` edge exists today. Vanishes with a dedicated PR that freezes the new mode in a characterization test first and switches the trust store to private storage; that PR makes telemetry and distribution (and auth, E9) its consumers, so private storage moves back to `shared/` in the same PR.
- D9: the release adapter merged into a shared GitHub adapter, and a rule pinning `api.github.com` to one file. Vanishes with D3.
- D11: the marketplace fakes, `fixture-plugin-fetcher.ts` and `fake-ensure-built-marketplace.ts` moved into `tests/contexts/distribution/testing/`. Vanishes with the framework split.
- D12: contract kits for `PluginFetcher`, `PluginCatalogRepository`, `RawCatalogFetcher`, `ReleaseLister`, `RepositoryVisibility` and `MarketplaceRemover`. Vanishes with D5 for `PluginFetcher`, D2 for the release ports.
- D13: the raw catalog fetcher over a `RepositoryReader` port. Vanishes with D3.
- D14: `AddMarketplace` composed in `composition/distribution.ts` (M11). Vanishes with the framework split.
