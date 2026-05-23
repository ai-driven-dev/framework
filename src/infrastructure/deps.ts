import "../domain/tools/ai/claude.js";
import "../domain/tools/ai/codex.js";
import "../domain/tools/ai/copilot.js";
import "../domain/tools/ai/cursor.js";
import "../domain/tools/ai/opencode.js";
import "../domain/tools/ide/vscode.js";
import { CLIOutput } from "../application/output.js";
import { DoctorLayoutUseCase } from "../application/use-cases/doctor/doctor-layout-use-case.js";
import { DoctorMergeFilesUseCase } from "../application/use-cases/doctor/doctor-merge-files-use-case.js";
import { DoctorPluginUseCase } from "../application/use-cases/doctor/doctor-plugin-use-case.js";
import { DoctorReferencesUseCase } from "../application/use-cases/doctor/doctor-references-use-case.js";
import { DoctorTrackedFilesUseCase } from "../application/use-cases/doctor/doctor-tracked-files-use-case.js";
import { DoctorUseCase } from "../application/use-cases/doctor/doctor-use-case.js";
import { InstallAiToolUseCase } from "../application/use-cases/install/install-ai-tool-use-case.js";
import { InstallIdeConfigUseCase } from "../application/use-cases/install/install-ide-config-use-case.js";
import { InstallIdeToolUseCase } from "../application/use-cases/install/install-ide-tool-use-case.js";
import { InstallRuntimeConfigUseCase } from "../application/use-cases/install/install-runtime-config-use-case.js";
import { MarketplaceAddUseCase } from "../application/use-cases/marketplace/marketplace-add-use-case.js";
import { MarketplaceCheckUseCase } from "../application/use-cases/marketplace/marketplace-check-use-case.js";
import { MarketplaceListUseCase } from "../application/use-cases/marketplace/marketplace-list-use-case.js";
import { MarketplaceRefreshUseCase } from "../application/use-cases/marketplace/marketplace-refresh-use-case.js";
import { MarketplaceRegisterFrameworkUseCase } from "../application/use-cases/marketplace/marketplace-register-framework-use-case.js";
import { MarketplaceRemoveUseCase } from "../application/use-cases/marketplace/marketplace-remove-use-case.js";
import { MarketplaceSyncSettingsUseCase } from "../application/use-cases/marketplace/marketplace-sync-settings-use-case.js";
import { MigrateBackupUseCase } from "../application/use-cases/migrate/migrate-backup-use-case.js";
import { MigrateRewirePluginsUseCase } from "../application/use-cases/migrate/migrate-rewire-plugins-use-case.js";
import { MigrateStripDeadFilesUseCase } from "../application/use-cases/migrate/migrate-strip-dead-files-use-case.js";
import { PluginAddUseCase } from "../application/use-cases/plugin/plugin-add-use-case.js";
import { PluginInstallFromMarketplaceUseCase } from "../application/use-cases/plugin/plugin-install-from-marketplace-use-case.js";
import { PluginInstallUseCase } from "../application/use-cases/plugin/plugin-install-use-case.js";
import { PluginListUseCase } from "../application/use-cases/plugin/plugin-list-use-case.js";
import { PluginPickUseCase } from "../application/use-cases/plugin/plugin-pick-use-case.js";
import { PluginRemoveUseCase } from "../application/use-cases/plugin/plugin-remove-use-case.js";
import { PluginSearchUseCase } from "../application/use-cases/plugin/plugin-search-use-case.js";
import { PluginUpdateUseCase } from "../application/use-cases/plugin/plugin-update-use-case.js";
import { FetchMarketplaceSourceUseCase } from "../application/use-cases/shared/fetch-marketplace-source-use-case.js";
import { ResolveMarketplaceUseCase } from "../application/use-cases/shared/resolve-marketplace-use-case.js";
import { SyncConflictResolverUseCase } from "../application/use-cases/sync/sync-conflict-resolver-use-case.js";
import { SyncFilePropagationUseCase } from "../application/use-cases/sync/sync-file-propagation-use-case.js";
import { SyncSourceResolverUseCase } from "../application/use-cases/sync/sync-source-resolver-use-case.js";
import { UninstallIdeUseCase } from "../application/use-cases/uninstall/uninstall-ide-use-case.js";
import type { AssetProvider } from "../domain/ports/asset-provider.js";
import type { FileMerger } from "../domain/ports/file-merger.js";
import type { FileReader } from "../domain/ports/file-reader.js";
import type { FileWriter } from "../domain/ports/file-writer.js";
import type { Hasher } from "../domain/ports/hasher.js";
import type { Logger } from "../domain/ports/logger.js";
import type { ManifestRepository } from "../domain/ports/manifest-repository.js";
import type { MarketplaceRegistry } from "../domain/ports/marketplace-registry.js";
import type { MarketplaceTrustStore } from "../domain/ports/marketplace-trust-store.js";
import type { Platform } from "../domain/ports/platform.js";
import type { PluginCatalogRepository } from "../domain/ports/plugin-catalog-repository.js";
import type { PluginDistributionReader } from "../domain/ports/plugin-distribution-reader.js";
import type { PluginFetcher } from "../domain/ports/plugin-fetcher.js";
import type { Prompter } from "../domain/ports/prompter.js";
import type { SelfUpdater } from "../domain/ports/self-updater.js";
import type { VersionControl } from "../domain/ports/version-control.js";
import type { VersionReader } from "../domain/ports/version-reader.js";
import { AuthReader } from "./adapters/auth-reader.js";
import { AuthStorage } from "./adapters/auth-storage.js";
import { CurrentVersionAdapter } from "./adapters/current-version-adapter.js";
import { FileAdapter } from "./adapters/file-adapter.js";
import { GhCliAdapter } from "./adapters/gh-cli-adapter.js";
import { GitAdapter } from "./adapters/git-adapter.js";
import { GitHubRawFetcherAdapter } from "./adapters/github-raw-fetcher-adapter.js";
import { HasherAdapter } from "./adapters/hasher-adapter.js";
import { HttpClient } from "./adapters/http-client.js";
import { ManifestRepositoryAdapter } from "./adapters/manifest-repository-adapter.js";
import { MarketplaceRegistryAdapter } from "./adapters/marketplace-registry-adapter.js";
import { MarketplaceTrustStoreAdapter } from "./adapters/marketplace-trust-store-adapter.js";
import { PlatformAdapter } from "./adapters/platform-adapter.js";
import { PluginCatalogRepositoryAdapter } from "./adapters/plugin-catalog-repository-adapter.js";
import { PluginDistributionReaderAdapter } from "./adapters/plugin-distribution-reader-adapter.js";
import { PluginFetcherAdapter } from "./adapters/plugin-fetcher-adapter.js";
import { InquirerPrompterAdapter, SilentPrompterAdapter } from "./adapters/prompter-adapter.js";
import { SelfUpdaterAdapter } from "./adapters/self-updater-adapter.js";
import { BundledAssetProviderAdapter } from "./assets/asset-loader.js";

interface GlobalOptions {
  verbose: boolean;
}

interface Deps {
  fs: FileReader & FileWriter & FileMerger;
  manifestRepo: ManifestRepository;
  hasher: Hasher;
  logger: Logger;
  cliUpdater: SelfUpdater;
  currentVersionProvider: VersionReader;
  git: VersionControl;
  platform: Platform;
  prompter: Prompter;
  authReader: AuthReader;
  authStorage: AuthStorage;
  http: HttpClient;
  pluginCatalogRepository: PluginCatalogRepository;
  pluginFetcher: PluginFetcher;
  pluginDistributionReader: PluginDistributionReader;
  marketplaceRegistry: MarketplaceRegistry;
  marketplaceTrustStore: MarketplaceTrustStore;
  pluginAddUseCase: PluginAddUseCase;
  pluginRemoveUseCase: PluginRemoveUseCase;
  pluginListUseCase: PluginListUseCase;
  pluginUpdateUseCase: PluginUpdateUseCase;
  marketplaceAddUseCase: MarketplaceAddUseCase;
  marketplaceListUseCase: MarketplaceListUseCase;
  marketplaceRemoveUseCase: MarketplaceRemoveUseCase;
  marketplaceRefreshUseCase: MarketplaceRefreshUseCase;
  marketplaceCheckUseCase: MarketplaceCheckUseCase;
  pluginInstallFromMarketplaceUseCase: PluginInstallFromMarketplaceUseCase;
  resolveMarketplaceUseCase: ResolveMarketplaceUseCase;
  installRuntimeConfigUseCase: InstallRuntimeConfigUseCase;
  installAiToolUseCase: InstallAiToolUseCase;
  installIdeConfigUseCase: InstallIdeConfigUseCase;
  installIdeToolUseCase: InstallIdeToolUseCase;
  uninstallIdeUseCase: UninstallIdeUseCase;
  assetProvider: AssetProvider;
  pluginSearchUseCase: PluginSearchUseCase;
  marketplaceRegisterFrameworkUseCase: MarketplaceRegisterFrameworkUseCase;
  pluginPickUseCase: PluginPickUseCase;
  pluginInstallUseCase: PluginInstallUseCase;
  marketplaceSyncSettingsUseCase: MarketplaceSyncSettingsUseCase;
  migrateBackupUseCase: MigrateBackupUseCase;
  migrateStripDeadFilesUseCase: MigrateStripDeadFilesUseCase;
  migrateRewirePluginsUseCase: MigrateRewirePluginsUseCase;
  syncConflictResolverUseCase: SyncConflictResolverUseCase;
  syncFilePropagationUseCase: SyncFilePropagationUseCase;
  syncSourceResolverUseCase: SyncSourceResolverUseCase;
  doctorUseCase: DoctorUseCase;
}

const _cache = new Map<string, Deps>();

export function createMenuDeps(projectRoot: string): {
  manifestRepo: ManifestRepository;
  prompter: Prompter;
} {
  return {
    manifestRepo: new ManifestRepositoryAdapter(projectRoot),
    prompter: process.stdout.isTTY ? new InquirerPrompterAdapter() : new SilentPrompterAdapter(),
  };
}

export async function createDeps(
  projectRoot: string,
  options: GlobalOptions,
  output?: CLIOutput
): Promise<Deps> {
  const cached = _cache.get(projectRoot);
  if (cached !== undefined) return cached;
  const hasher = new HasherAdapter();
  const fs = new FileAdapter(hasher);
  const pluginCatalogRepository = new PluginCatalogRepositoryAdapter(fs);
  const pluginDistributionReader = new PluginDistributionReaderAdapter(fs);
  const marketplaceRegistry = new MarketplaceRegistryAdapter();
  const marketplaceTrustStore = new MarketplaceTrustStoreAdapter(hasher);
  const logger = output ?? new CLIOutput(options.verbose);
  const manifestRepo = new ManifestRepositoryAdapter(projectRoot);
  const http = new HttpClient();
  const authStorage = new AuthStorage();
  const ghCliAdapter = new GhCliAdapter();
  const authReader = new AuthReader(authStorage, projectRoot, logger, ghCliAdapter);
  const pluginFetcher = new PluginFetcherAdapter(fs, authReader);
  const rawCatalogFetcher = new GitHubRawFetcherAdapter(http, authReader);
  const cliUpdater = new SelfUpdaterAdapter(http, { tokenProvider: authReader });
  const currentVersionProvider = new CurrentVersionAdapter();
  const git = new GitAdapter(fs);
  const platform = new PlatformAdapter();
  const prompter = process.stdout.isTTY
    ? new InquirerPrompterAdapter()
    : new SilentPrompterAdapter();
  const marketplaceSyncSettingsUseCase = new MarketplaceSyncSettingsUseCase(
    fs,
    manifestRepo,
    marketplaceRegistry,
    pluginCatalogRepository,
    hasher
  );
  const pluginAddUseCase = new PluginAddUseCase(
    fs,
    manifestRepo,
    pluginFetcher,
    pluginDistributionReader,
    hasher,
    logger,
    marketplaceRegistry
  );
  const pluginRemoveUseCase = new PluginRemoveUseCase(fs, manifestRepo);
  const pluginListUseCase = new PluginListUseCase(manifestRepo);
  const pluginUpdateUseCase = new PluginUpdateUseCase(
    fs,
    manifestRepo,
    pluginFetcher,
    pluginDistributionReader,
    hasher
  );
  const fetchMarketplaceSource = new FetchMarketplaceSourceUseCase(
    pluginFetcher,
    rawCatalogFetcher
  );
  const marketplaceListUseCase = new MarketplaceListUseCase(
    marketplaceRegistry,
    pluginCatalogRepository,
    fetchMarketplaceSource
  );
  const marketplaceRemoveUseCase = new MarketplaceRemoveUseCase(
    fs,
    manifestRepo,
    marketplaceRegistry,
    prompter
  );
  const marketplaceAddUseCase = new MarketplaceAddUseCase(
    pluginCatalogRepository,
    marketplaceRegistry,
    marketplaceTrustStore,
    fetchMarketplaceSource,
    prompter,
    marketplaceRemoveUseCase
  );
  const marketplaceRefreshUseCase = new MarketplaceRefreshUseCase(
    pluginCatalogRepository,
    marketplaceRegistry,
    fetchMarketplaceSource,
    logger
  );
  const marketplaceCheckUseCase = new MarketplaceCheckUseCase(
    manifestRepo,
    pluginCatalogRepository,
    marketplaceRegistry,
    fetchMarketplaceSource
  );
  const resolveMarketplaceUseCase = new ResolveMarketplaceUseCase(
    fetchMarketplaceSource,
    pluginCatalogRepository
  );
  const assetProvider = new BundledAssetProviderAdapter();
  const installRuntimeConfigUseCase = new InstallRuntimeConfigUseCase(
    fs,
    manifestRepo,
    hasher,
    logger,
    assetProvider
  );
  const installIdeConfigUseCase = new InstallIdeConfigUseCase(
    fs,
    manifestRepo,
    hasher,
    logger,
    assetProvider
  );
  const installIdeToolUseCase = new InstallIdeToolUseCase(
    installIdeConfigUseCase,
    manifestRepo,
    fs,
    hasher,
    assetProvider
  );
  const uninstallIdeUseCase = new UninstallIdeUseCase(fs, manifestRepo);
  const pluginInstallFromMarketplaceUseCase = new PluginInstallFromMarketplaceUseCase(
    resolveMarketplaceUseCase,
    marketplaceRegistry,
    pluginAddUseCase,
    prompter
  );
  const pluginSearchUseCase = new PluginSearchUseCase(
    pluginCatalogRepository,
    marketplaceRegistry,
    fetchMarketplaceSource
  );
  const marketplaceRegisterFrameworkUseCase = new MarketplaceRegisterFrameworkUseCase(
    marketplaceRegistry
  );
  const pluginPickUseCase = new PluginPickUseCase(
    pluginCatalogRepository,
    marketplaceRegistry,
    fetchMarketplaceSource,
    pluginAddUseCase,
    prompter
  );
  const pluginInstallUseCase = new PluginInstallUseCase(
    pluginPickUseCase,
    pluginAddUseCase,
    pluginInstallFromMarketplaceUseCase,
    manifestRepo
  );
  const installAiToolUseCase = new InstallAiToolUseCase(
    installRuntimeConfigUseCase,
    manifestRepo,
    pluginInstallFromMarketplaceUseCase,
    marketplaceSyncSettingsUseCase,
    logger
  );
  const migrateBackupUseCase = new MigrateBackupUseCase(fs);
  const migrateStripDeadFilesUseCase = new MigrateStripDeadFilesUseCase(fs, logger);
  const migrateRewirePluginsUseCase = new MigrateRewirePluginsUseCase(
    pluginInstallFromMarketplaceUseCase,
    logger
  );
  const syncConflictResolverUseCase = new SyncConflictResolverUseCase(fs);
  const syncFilePropagationUseCase = new SyncFilePropagationUseCase(
    fs,
    syncConflictResolverUseCase,
    logger
  );
  const syncSourceResolverUseCase = new SyncSourceResolverUseCase(fs, prompter);
  const doctorTrackedFilesUseCase = new DoctorTrackedFilesUseCase(fs);
  const doctorMergeFilesUseCase = new DoctorMergeFilesUseCase(fs, hasher);
  const doctorPluginUseCase = new DoctorPluginUseCase(fs);
  const doctorReferencesUseCase = new DoctorReferencesUseCase(fs);
  const doctorLayoutUseCase = new DoctorLayoutUseCase(fs, authReader);
  const doctorUseCase = new DoctorUseCase(
    manifestRepo,
    doctorTrackedFilesUseCase,
    doctorMergeFilesUseCase,
    doctorPluginUseCase,
    doctorReferencesUseCase,
    doctorLayoutUseCase
  );
  const deps: Deps = {
    fs,
    manifestRepo,
    hasher,
    logger,
    cliUpdater,
    currentVersionProvider,
    git,
    platform,
    prompter,
    authReader,
    authStorage,
    http,
    pluginCatalogRepository,
    pluginFetcher,
    pluginDistributionReader,
    marketplaceRegistry,
    marketplaceTrustStore,
    pluginAddUseCase,
    pluginRemoveUseCase,
    pluginListUseCase,
    pluginUpdateUseCase,
    marketplaceAddUseCase,
    marketplaceListUseCase,
    marketplaceRemoveUseCase,
    marketplaceRefreshUseCase,
    marketplaceCheckUseCase,
    pluginInstallFromMarketplaceUseCase,
    resolveMarketplaceUseCase,
    installRuntimeConfigUseCase,
    installAiToolUseCase,
    installIdeConfigUseCase,
    installIdeToolUseCase,
    uninstallIdeUseCase,
    assetProvider,
    pluginSearchUseCase,
    marketplaceRegisterFrameworkUseCase,
    pluginPickUseCase,
    pluginInstallUseCase,
    marketplaceSyncSettingsUseCase,
    migrateBackupUseCase,
    migrateStripDeadFilesUseCase,
    migrateRewirePluginsUseCase,
    syncConflictResolverUseCase,
    syncFilePropagationUseCase,
    syncSourceResolverUseCase,
    doctorUseCase,
  };
  _cache.set(projectRoot, deps);
  return deps;
}
