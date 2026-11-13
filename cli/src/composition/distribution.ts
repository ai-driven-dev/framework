import type { TokenProvider } from "../contexts/auth/contract/token-provider.js";
import { FetchMarketplaceSource } from "../contexts/distribution/application/fetch-marketplace-source.js";
import { ListMarketplaces } from "../contexts/distribution/application/list-marketplaces.js";
import { RefreshMarketplace } from "../contexts/distribution/application/refresh-marketplace.js";
import { RegisterFrameworkMarketplace } from "../contexts/distribution/application/register-framework-marketplace.js";
import { ResolveMarketplace } from "../contexts/distribution/application/resolve-marketplace.js";
import { GitHubRawFetcherAdapter } from "../contexts/distribution/infrastructure/github-raw-fetcher-adapter.js";
import { GitHubReleaseAdapter } from "../contexts/distribution/infrastructure/github-release-adapter.js";
import { MarketplaceCacheAdapter } from "../contexts/distribution/infrastructure/marketplace-cache-adapter.js";
import { MarketplaceRegistryAdapter } from "../contexts/distribution/infrastructure/marketplace-registry-adapter.js";
import { MarketplaceTrustStoreAdapter } from "../contexts/distribution/infrastructure/marketplace-trust-store-adapter.js";
import { PluginCatalogRepositoryAdapter } from "../contexts/distribution/infrastructure/plugin-catalog-repository-adapter.js";
import { PluginFetcherAdapter } from "../contexts/distribution/infrastructure/plugin-fetcher-adapter.js";
import type { MarketplaceRegistry } from "../contexts/distribution/ports/marketplace-registry.js";
import type { MarketplaceTrustStore } from "../contexts/distribution/ports/marketplace-trust-store.js";
import type { PluginCatalogRepository } from "../contexts/distribution/ports/plugin-catalog-repository.js";
import type { PluginFetcher } from "../contexts/distribution/ports/plugin-fetcher.js";
import type { ReleaseLister } from "../contexts/distribution/ports/release-lister.js";
import type { RepositoryVisibility } from "../contexts/distribution/ports/repository-visibility.js";
import type { FileReader } from "../kernel/ports/file-reader.js";
import type { FileWriter } from "../kernel/ports/file-writer.js";
import type { Hasher } from "../kernel/ports/hasher.js";
import type { Logger } from "../kernel/ports/logger.js";
import { atomicWriteFile } from "../shared/infrastructure/atomic-write.js";
import type { HttpClient } from "../shared/infrastructure/http-client.js";
import { userConfigDir } from "../shared/infrastructure/user-config-dir.js";
import type { FileMerger } from "../shared/ports/file-merger.js";

export interface DistributionWiringShared {
  fs: FileReader & FileWriter & FileMerger;
  hasher: Hasher;
  http: HttpClient;
  tokenProvider: TokenProvider;
  logger: Logger;
  projectRoot: string;
}

export interface DistributionDeps {
  pluginCatalogRepository: PluginCatalogRepository;
  pluginFetcher: PluginFetcher;
  marketplaceRegistry: MarketplaceRegistry;
  marketplaceTrustStore: MarketplaceTrustStore;
  releaseResolver: ReleaseLister & RepositoryVisibility;
  resolveMarketplaceUseCase: ResolveMarketplace;
  listMarketplaces: ListMarketplaces;
  refreshMarketplace: RefreshMarketplace;
  registerFrameworkMarketplace: RegisterFrameworkMarketplace;
}

/** `addMarketplace` is deliberately absent: it takes framework's
 * `marketplaceRemoveUseCase`, so it is composed in `runtime/wiring/framework.ts` rather than pulling
 * framework in here. */
export function wireDistribution(shared: DistributionWiringShared): DistributionDeps {
  const pluginCatalogRepository = new PluginCatalogRepositoryAdapter(shared.fs);
  const marketplaceCache = new MarketplaceCacheAdapter(shared.projectRoot);
  const marketplaceRegistry = new MarketplaceRegistryAdapter(userConfigDir, atomicWriteFile);
  const marketplaceTrustStore = new MarketplaceTrustStoreAdapter(shared.hasher);
  const pluginFetcher = new PluginFetcherAdapter(shared.fs, shared.tokenProvider);
  const releaseResolver = new GitHubReleaseAdapter(shared.http, shared.tokenProvider);
  const rawCatalogFetcher = new GitHubRawFetcherAdapter(shared.http, shared.tokenProvider);
  const fetchMarketplaceSource = new FetchMarketplaceSource(
    pluginFetcher,
    rawCatalogFetcher,
    shared.fs,
    shared.logger
  );
  const resolveMarketplaceUseCase = new ResolveMarketplace(
    fetchMarketplaceSource,
    pluginCatalogRepository,
    userConfigDir
  );
  const listMarketplaces = new ListMarketplaces(
    marketplaceRegistry,
    resolveMarketplaceUseCase,
    shared.logger
  );
  const refreshMarketplace = new RefreshMarketplace(
    marketplaceRegistry,
    resolveMarketplaceUseCase,
    marketplaceCache,
    shared.logger,
    shared.fs
  );
  const registerFrameworkMarketplace = new RegisterFrameworkMarketplace(marketplaceRegistry);
  return {
    pluginCatalogRepository,
    pluginFetcher,
    marketplaceRegistry,
    marketplaceTrustStore,
    releaseResolver,
    resolveMarketplaceUseCase,
    listMarketplaces,
    refreshMarketplace,
    registerFrameworkMarketplace,
  };
}
