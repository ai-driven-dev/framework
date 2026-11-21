import type { TokenProvider } from "../contexts/auth/contract/token-provider.js";
import { FetchMarketplaceSource } from "../contexts/distribution/application/fetch-marketplace-source.js";
import { ListMarketplaces } from "../contexts/distribution/application/list-marketplaces.js";
import { RefreshMarketplace } from "../contexts/distribution/application/refresh-marketplace.js";
import { RegisterFrameworkMarketplace } from "../contexts/distribution/application/register-framework-marketplace.js";
import { ResolveMarketplace } from "../contexts/distribution/application/resolve-marketplace.js";
import { MarketplaceCacheAdapter } from "../contexts/distribution/infrastructure/marketplace-cache-adapter.js";
import { MarketplaceRegistryAdapter } from "../contexts/distribution/infrastructure/marketplace-registry-adapter.js";
import { MarketplaceTrustStoreAdapter } from "../contexts/distribution/infrastructure/marketplace-trust-store-adapter.js";
import { PluginCatalogRepositoryAdapter } from "../contexts/distribution/infrastructure/plugin-catalog-repository-adapter.js";
import { PluginFetcherAdapter } from "../contexts/distribution/infrastructure/plugin-fetcher-adapter.js";
import type { MarketplaceCachePort } from "../contexts/distribution/ports/marketplace-cache.js";
import type { MarketplaceRegistry } from "../contexts/distribution/ports/marketplace-registry.js";
import type { MarketplaceTrustStore } from "../contexts/distribution/ports/marketplace-trust-store.js";
import type { PluginCatalogRepository } from "../contexts/distribution/ports/plugin-catalog-repository.js";
import type { PluginFetcher } from "../contexts/distribution/ports/plugin-fetcher.js";
import type { RawCatalogFetcher } from "../contexts/distribution/ports/raw-catalog-fetcher.js";
import type { RepositoryVisibility } from "../contexts/distribution/ports/repository-visibility.js";
import { atomicWriteFile } from "../shared/infrastructure/atomic-write.js";
import { GitHubAdapter } from "../shared/infrastructure/github-adapter.js";
import type { HttpClient } from "../shared/infrastructure/http-client.js";
import { userConfigDir } from "../shared/infrastructure/user-config-dir.js";
import type { FileReader } from "../shared/ports/file-reader.js";
import type { FileWriter } from "../shared/ports/file-writer.js";
import type { Logger } from "../shared/ports/logger.js";
import type { ReleaseLister } from "../shared/ports/release-lister.js";

export interface DistributionWiringShared {
  fs: FileReader & FileWriter;
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

interface MarketplaceUseCaseInputs {
  shared: DistributionWiringShared;
  pluginFetcher: PluginFetcher;
  rawCatalogFetcher: RawCatalogFetcher;
  pluginCatalogRepository: PluginCatalogRepository;
  marketplaceRegistry: MarketplaceRegistry;
  marketplaceCache: MarketplaceCachePort;
}

type MarketplaceUseCases = Pick<
  DistributionDeps,
  | "resolveMarketplaceUseCase"
  | "listMarketplaces"
  | "refreshMarketplace"
  | "registerFrameworkMarketplace"
>;

function marketplaceUseCasesOf(inputs: MarketplaceUseCaseInputs): MarketplaceUseCases {
  const { shared, marketplaceRegistry } = inputs;
  const fetchMarketplaceSource = new FetchMarketplaceSource({
    pluginFetcher: inputs.pluginFetcher,
    rawCatalog: { fetcher: inputs.rawCatalogFetcher, fs: shared.fs },
    logger: shared.logger,
  });
  const resolveMarketplaceUseCase = new ResolveMarketplace(
    fetchMarketplaceSource,
    inputs.pluginCatalogRepository,
    userConfigDir
  );
  const listMarketplaces = new ListMarketplaces(
    marketplaceRegistry,
    resolveMarketplaceUseCase,
    shared.logger
  );
  const refreshMarketplace = new RefreshMarketplace({
    registry: marketplaceRegistry,
    resolveMarketplace: resolveMarketplaceUseCase,
    cache: inputs.marketplaceCache,
    logger: shared.logger,
    fs: shared.fs,
  });
  const registerFrameworkMarketplace = new RegisterFrameworkMarketplace(marketplaceRegistry);
  return {
    resolveMarketplaceUseCase,
    listMarketplaces,
    refreshMarketplace,
    registerFrameworkMarketplace,
  };
}

export function wireDistribution(shared: DistributionWiringShared): DistributionDeps {
  const pluginCatalogRepository = new PluginCatalogRepositoryAdapter(shared.fs);
  const marketplaceCache = new MarketplaceCacheAdapter(shared.projectRoot);
  const marketplaceRegistry = new MarketplaceRegistryAdapter(userConfigDir, atomicWriteFile);
  const marketplaceTrustStore = new MarketplaceTrustStoreAdapter();
  const pluginFetcher = new PluginFetcherAdapter(shared.fs, shared.tokenProvider);
  const github = new GitHubAdapter(shared.http, { tokenProvider: shared.tokenProvider });
  const releaseResolver = github;
  const rawCatalogFetcher = github;
  const useCases = marketplaceUseCasesOf({
    shared,
    pluginFetcher,
    rawCatalogFetcher,
    pluginCatalogRepository,
    marketplaceRegistry,
    marketplaceCache,
  });
  return {
    pluginCatalogRepository,
    pluginFetcher,
    marketplaceRegistry,
    marketplaceTrustStore,
    releaseResolver,
    ...useCases,
  };
}
