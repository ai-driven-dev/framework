# Distribution glossary

The language of the `distribution` context. A name in the code means what this page says.

| Term | Meaning | In the code |
| --- | --- | --- |
| Marketplace | A named registration of a source plugins are read from, in a scope | `Marketplace`, `MarketplaceData` |
| Source mode | Whether a marketplace is read from a remote repository or a local path | `MarketplaceSourceMode` |
| Framework marketplace | The reserved `aidd-framework` entry registered for every project of the machine | `FRAMEWORK_MARKETPLACE_NAME`, `RegisterFrameworkMarketplace` |
| Scope | Where a registration is kept: one project, or the user for every project | `MarketplaceScope` |
| Registry | The saved list of marketplaces, a project's and the user's | `MarketplaceRegistry` |
| Trust | The recorded consent to read a source, kept per project | `MarketplaceTrustStore` |
| Catalog | The list of plugins a marketplace offers, in the shape its host writes | `PluginCatalog`, `parsePluginCatalog`, `catalog-parsers/` |
| Cache | The local copy of a fetched marketplace, reused until it is stale | `MarketplaceCachePort`, `isMarketplaceStale` |
| Staleness | A marketplace fetched longer ago than the allowed days | `STALE_MAX_DAYS_DEFAULT` |
| Resolution | Turning a marketplace into its local path and its catalog, fetching only when needed | `ResolveMarketplace` |
| Refresh | Fetching every registered marketplace again and recording the version it now carries | `RefreshMarketplace` |
| Release | A tag of the framework repository that names a published version, root tags only | `ReleaseLister` |
| Repository visibility | Whether a repository answers without a credential | `RepositoryVisibility` |
| Remover | What takes a registered marketplace away, which this context asks of its caller | `MarketplaceRemover` |
