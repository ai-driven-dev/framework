import { homedir } from "node:os";
import { join } from "node:path";
import { SearchPlugins } from "../contexts/distribution/application/search-plugins.js";
import type { MarketplaceRemover } from "../contexts/distribution/ports/marketplace-remover.js";
import { CleanUserScopeUseCase } from "../contexts/framework/application/clean/clean-user-scope-use-case.js";
import { CleanUseCase } from "../contexts/framework/application/clean-use-case.js";
import { DoctorLayoutUseCase } from "../contexts/framework/application/doctor/doctor-layout-use-case.js";
import { DoctorMergeFilesUseCase } from "../contexts/framework/application/doctor/doctor-merge-files-use-case.js";
import { DoctorPluginUseCase } from "../contexts/framework/application/doctor/doctor-plugin-use-case.js";
import { DoctorReferencesUseCase } from "../contexts/framework/application/doctor/doctor-references-use-case.js";
import { DoctorRegistrationUseCase } from "../contexts/framework/application/doctor/doctor-registration-use-case.js";
import { DoctorTrackedFilesUseCase } from "../contexts/framework/application/doctor/doctor-tracked-files-use-case.js";
import { DoctorUseCase } from "../contexts/framework/application/doctor/doctor-use-case.js";
import { MarketplaceCheckUseCase } from "../contexts/framework/application/flows/marketplace-check-use-case.js";
import { MarketplaceRemoveUseCase } from "../contexts/framework/application/flows/marketplace-remove-use-case.js";
import { MarketplaceSyncSettingsUseCase } from "../contexts/framework/application/flows/marketplace-sync-settings-use-case.js";
import { DoctorAllUseCase } from "../contexts/framework/application/global/doctor-all-use-case.js";
import { ResolveUpdateDecisionUseCase } from "../contexts/framework/application/global/resolve-update-decision-use-case.js";
import { RestoreAllUseCase } from "../contexts/framework/application/global/restore-all-use-case.js";
import { StatusAllUseCase } from "../contexts/framework/application/global/status-all-use-case.js";
import { UpdateAiToolsUseCase } from "../contexts/framework/application/global/update-ai-tools-use-case.js";
import { UpdateIdeToolsUseCase } from "../contexts/framework/application/global/update-ide-tools-use-case.js";
import { UpdateOneToolUseCase } from "../contexts/framework/application/global/update-one-tool-use-case.js";
import { InstallAiToolUseCase } from "../contexts/framework/application/install/install-ai-tool-use-case.js";
import { ProjectPluginCleanup } from "../contexts/framework/application/ownership/project-plugin-cleanup.js";
import { UserMarketplaceRemoveUseCase } from "../contexts/framework/application/ownership/user-marketplace-remove-use-case.js";
import { UserPluginFileUpdater } from "../contexts/framework/application/ownership/user-plugin-file-updater.js";
import { UserPluginUpdateUseCase } from "../contexts/framework/application/ownership/user-plugin-update-use-case.js";
import { PluginAddUseCase } from "../contexts/framework/application/plugin/plugin-add-use-case.js";
import { PluginInstallFromMarketplaceUseCase } from "../contexts/framework/application/plugin/plugin-install-from-marketplace-use-case.js";
import { PluginInstallUseCase } from "../contexts/framework/application/plugin/plugin-install-use-case.js";
import { PluginRemoveUseCase } from "../contexts/framework/application/plugin/plugin-remove-use-case.js";
import { InstallGlobalPluginsUseCase } from "../contexts/framework/application/setup/install-global-plugins-use-case.js";
import { ProjectContextDetectorUseCase } from "../contexts/framework/application/setup/project-context-detector-use-case.js";
import { SetupMachineScopeUseCase } from "../contexts/framework/application/setup/setup-machine-scope-use-case.js";
import { SetupMarketplaceSourceUseCase } from "../contexts/framework/application/setup/setup-marketplace-source-use-case.js";
import { SetupToolsUseCase } from "../contexts/framework/application/setup/setup-tools-use-case.js";
import { SetupMarketplaceRegistrationUseCase } from "../contexts/framework/application/shared/setup-marketplace-registration-use-case.js";
import { UninstallIdeUseCase } from "../contexts/framework/application/uninstall/uninstall-ide-use-case.js";
import { UninstallToolsUseCase } from "../contexts/framework/application/uninstall/uninstall-tools-use-case.js";
import { UninstallUseCase } from "../contexts/framework/application/uninstall/uninstall-use-case.js";
import { InspectHostRegistration } from "../contexts/host-registration/application/inspect-host-registration.js";
import { NativeHostRegistrationGate } from "../contexts/host-registration/application/native-host-registration-gate.js";
import { RefreshHostPlugin } from "../contexts/host-registration/application/refresh-host-plugin.js";
import { WithdrawFromHost } from "../contexts/host-registration/application/withdraw-from-host.js";
import { InstallIdeConfig } from "../contexts/installation/application/install/install-ide-config.js";
import { InstallIdeTool } from "../contexts/installation/application/install/install-ide-tool.js";
import { InstallRuntimeConfig } from "../contexts/installation/application/install/install-runtime-config.js";
import { RunPostInstallPipeline } from "../contexts/installation/application/install/run-post-install-pipeline.js";
import { ListInstalledRules } from "../contexts/installation/application/list-installed-rules.js";
import { ListPlugins } from "../contexts/installation/application/plugin/list-plugins.js";
import { PluginDistributionLoader } from "../contexts/installation/application/plugin/plugin-distribution-loader.js";
import { UpdatePlugin } from "../contexts/installation/application/plugin/update-plugin.js";
import { ReportStatus } from "../contexts/installation/application/report-status.js";
import { Restore } from "../contexts/installation/application/restore/restore.js";
import { DetectPluginDrift } from "../contexts/installation/application/shared/detect-plugin-drift.js";
import {
  EnsureBuiltMarketplace,
  type FrameworkBuildFor,
} from "../contexts/installation/application/shared/ensure-built-marketplace.js";
import { UpdateGitignore } from "../contexts/installation/application/update-gitignore.js";
import { BundledAssetProviderAdapter } from "../contexts/installation/infrastructure/assets/asset-loader.js";
import { HasherAdapter } from "../contexts/installation/infrastructure/hasher-adapter.js";
import { JsonFileMergerAdapter } from "../contexts/installation/infrastructure/json-file-merger-adapter.js";
import { ManifestRepositoryAdapter } from "../contexts/installation/infrastructure/manifest-repository-adapter.js";
import { PlatformAdapter } from "../contexts/installation/infrastructure/platform-adapter.js";
import { PluginDistributionReaderAdapter } from "../contexts/installation/infrastructure/plugin-distribution-reader-adapter.js";
import { UserManifestRepositoryAdapter } from "../contexts/installation/infrastructure/user-manifest-repository-adapter.js";
import { UserSourceReferencesAdapter } from "../contexts/machine-claims/infrastructure/user-source-references-adapter.js";
import type { ToolCatalog } from "../contexts/tools/contract/tool-catalog.js";
import { pluginManifestProbes } from "../contexts/translate/domain/plugin-format.js";
import type { Deps, DepsFactory, FactoryOptions, MenuDeps } from "../presentation/deps.js";
import { CLIOutput } from "../presentation/output.js";
import { PluginPickUseCase } from "../presentation/prompts/plugin-pick-use-case.js";
import { SetupPluginsPromptUseCase } from "../presentation/prompts/setup-plugins-prompt-use-case.js";
import { SetupToolsPromptUseCase } from "../presentation/prompts/setup-tools-prompt-use-case.js";
import { SyncConflictResolverUseCase } from "../presentation/prompts/sync-conflict-resolver-use-case.js";
import {
  InquirerPrompterAdapter,
  SilentPrompterAdapter,
} from "../presentation/terminal/prompter-adapter.js";

import { atomicWriteFile } from "../shared/infrastructure/atomic-write.js";
import { CurrentVersionAdapter } from "../shared/infrastructure/current-version-adapter.js";
import { EnvironmentAdapter } from "../shared/infrastructure/environment-adapter.js";
import { FileAdapter } from "../shared/infrastructure/file-adapter.js";
import { HttpClient } from "../shared/infrastructure/http-client.js";
import { userConfigDir } from "../shared/infrastructure/user-config-dir.js";
import type { Logger } from "../shared/ports/logger.js";
import { wireAuth } from "./auth.js";
import { wireAddMarketplace, wireDistribution } from "./distribution.js";
import { wireHostRegistration } from "./host-registration.js";
import { wireRecipes } from "./recipes.js";
import { wireTelemetry } from "./telemetry.js";
import { createFrameworkBuildUseCase } from "./translate.js";
import { wireUpdate } from "./update.js";

/** One graph per catalog, then per project root and token: two catalogs never share a graph. */
const _cache = new WeakMap<ToolCatalog, Map<string, Deps>>();

export function createMenuDeps(projectRoot: string, tools: ToolCatalog): MenuDeps {
  return {
    manifestRepo: new ManifestRepositoryAdapter(projectRoot, (raw) => tools.toolId(raw)),
    prompter: process.stdout.isTTY ? new InquirerPrompterAdapter() : new SilentPrompterAdapter(),
  };
}

/** The factory the commands receive: it binds the catalog the commands were registered with. */
export function bindCatalog(tools: ToolCatalog): DepsFactory {
  return (projectRoot, options, output) => createDeps(projectRoot, options, output, tools);
}

export async function createDeps(
  projectRoot: string,
  options: FactoryOptions,
  output: CLIOutput | undefined,
  tools: ToolCatalog
): Promise<Deps> {
  const cacheKey = `${projectRoot}\u0000${options.token ?? ""}`;
  const graphs = _cache.get(tools) ?? new Map<string, Deps>();
  _cache.set(tools, graphs);
  const cached = graphs.get(cacheKey);
  if (cached !== undefined) return cached;
  const hasher = new HasherAdapter();
  const logger = output ?? new CLIOutput(options.verbose);
  const fs = new JsonFileMergerAdapter(new FileAdapter(hasher, logger));
  const pluginDistributionReader = new PluginDistributionReaderAdapter(
    fs,
    pluginManifestProbes(tools)
  );
  const resolveToolId = (raw: string) => tools.toolId(raw);
  const manifestRepo = new ManifestRepositoryAdapter(projectRoot, resolveToolId);
  const userManifestRepo = new UserManifestRepositoryAdapter(
    userConfigDir,
    atomicWriteFile,
    resolveToolId
  );
  const http = new HttpClient();
  const environment = new EnvironmentAdapter();
  const { tokenProvider, logIn, logOut, checkStatus } = wireAuth({
    projectRoot,
    logger,
    http,
    environment,
    explicitToken: options.token,
  });
  const currentVersionProvider = new CurrentVersionAdapter();
  const platform = new PlatformAdapter();
  const prompter = process.stdout.isTTY
    ? new InquirerPrompterAdapter()
    : new SilentPrompterAdapter();
  // Read once, reused wherever a use case needs the scope a plugin is actually registered
  // at: removal, clean, and doctor's own registration check.
  const {
    hostActions: nativePluginActivators,
    marketplaceRegistries: hostMarketplaceRegistries,
    marketplaceSources: nativeSources,
    pluginRegistries: hostPluginRegistries,
  } = wireHostRegistration(tools);
  // Built ahead of every use case that reads a shared-source claim: it depends only on `fs`
  // and `userConfigDir`, neither of which distribution's own wiring produces.
  const userSourceReferences = new UserSourceReferencesAdapter(fs, userConfigDir);
  const {
    pluginFetcher,
    marketplaceRegistry,
    marketplaceTrustStore,
    releaseResolver,
    resolveMarketplaceUseCase,
    listMarketplaces,
    refreshMarketplace,
    registerFrameworkMarketplace,
  } = wireDistribution({ fs, hasher, http, tokenProvider, logger, projectRoot });
  const pluginRemoveUseCase = new PluginRemoveUseCase(
    fs,
    manifestRepo,
    logger,
    new WithdrawFromHost(fs, logger, nativePluginActivators, hostPluginRegistries, nativeSources),
    userSourceReferences,
    marketplaceRegistry,
    userManifestRepo
  );
  const pluginListUseCase = new ListPlugins(manifestRepo);
  const nativeHostRegistrationGate = new NativeHostRegistrationGate(
    nativePluginActivators,
    hostPluginRegistries,
    nativeSources
  );
  const marketplaceRemoveUseCase = new MarketplaceRemoveUseCase(
    new ProjectPluginCleanup(fs, userManifestRepo),
    manifestRepo,
    marketplaceRegistry,
    prompter
  );
  const userMarketplaceRemoveUseCase = new UserMarketplaceRemoveUseCase(
    fs,
    userManifestRepo,
    marketplaceRegistry,
    nativeHostRegistrationGate
  );
  // Removing deletes installed plugin files, which is framework work: framework's two remove
  // commands answer distribution's `MarketplaceRemover`.
  const marketplaceRemover: MarketplaceRemover = {
    remove: async (request) => {
      const removal = { ...request, tools };
      await (request.scope === "user"
        ? userMarketplaceRemoveUseCase.execute(removal)
        : marketplaceRemoveUseCase.execute(removal));
    },
  };
  const addMarketplace = wireAddMarketplace(
    { marketplaceRegistry, marketplaceTrustStore, resolveMarketplaceUseCase },
    prompter,
    marketplaceRemover
  );
  const marketplaceCheckUseCase = new MarketplaceCheckUseCase(
    manifestRepo,
    marketplaceRegistry,
    resolveMarketplaceUseCase
  );
  const assetProvider = new BundledAssetProviderAdapter(tools);
  // `force: true` is safe here: `outDir` is always an aidd-owned disposable cache, never a
  // user-owned directory, so a collision only means a previous build's cache exists. Its
  // diagnostics drop to debug because this build runs behind almost every command, where
  // they would report an implementation detail as news; `--verbose` still shows them.
  const cacheBuildLogger: Logger = {
    debug: (message) => logger.debug(message),
    info: (message) => logger.debug(message),
    warn: (message) => logger.debug(message),
  };
  const frameworkBuildFor: FrameworkBuildFor = (target, mode, outDir) =>
    createFrameworkBuildUseCase(
      tools,
      { fs, assetProvider, logger: cacheBuildLogger },
      { target, mode, outDir, force: true }
    );
  const ensureBuiltMarketplaceUseCase = new EnsureBuiltMarketplace(
    fs,
    resolveMarketplaceUseCase,
    frameworkBuildFor,
    currentVersionProvider,
    userConfigDir
  );
  const marketplaceSyncSettingsUseCase = new MarketplaceSyncSettingsUseCase(
    fs,
    manifestRepo,
    marketplaceRegistry,
    hasher,
    logger,
    nativePluginActivators,
    ensureBuiltMarketplaceUseCase,
    hostMarketplaceRegistries,
    userConfigDir,
    registerFrameworkMarketplace,
    userSourceReferences,
    currentVersionProvider,
    hostPluginRegistries,
    userManifestRepo,
    nativeSources
  );
  const updateGitignore = new UpdateGitignore(fs);
  const runPostInstallPipeline = new RunPostInstallPipeline(manifestRepo, updateGitignore);
  const installRuntimeConfigUseCase = new InstallRuntimeConfig(
    fs,
    hasher,
    logger,
    assetProvider,
    runPostInstallPipeline
  );
  const pluginAddUseCase = new PluginAddUseCase(
    fs,
    manifestRepo,
    new PluginDistributionLoader(pluginFetcher, pluginDistributionReader),
    hasher,
    logger,
    marketplaceRegistry,
    ensureBuiltMarketplaceUseCase,
    userManifestRepo,
    installRuntimeConfigUseCase
  );
  const installIdeConfig = new InstallIdeConfig(
    fs,
    hasher,
    logger,
    assetProvider,
    runPostInstallPipeline
  );
  const installIdeToolUseCase = new InstallIdeTool(
    installIdeConfig,
    manifestRepo,
    fs,
    hasher,
    runPostInstallPipeline,
    assetProvider
  );
  const uninstallIdeUseCase = new UninstallIdeUseCase(
    manifestRepo,
    new UninstallToolsUseCase(fs, logger)
  );
  const pluginInstallFromMarketplaceUseCase = new PluginInstallFromMarketplaceUseCase(
    resolveMarketplaceUseCase,
    marketplaceRegistry,
    pluginAddUseCase,
    prompter,
    logger
  );
  const searchPlugins = new SearchPlugins(marketplaceRegistry, resolveMarketplaceUseCase);
  const pluginPickUseCase = new PluginPickUseCase(
    marketplaceRegistry,
    resolveMarketplaceUseCase,
    pluginAddUseCase,
    prompter
  );
  const pluginInstallUseCase = new PluginInstallUseCase(
    pluginPickUseCase,
    pluginAddUseCase,
    pluginInstallFromMarketplaceUseCase,
    manifestRepo,
    marketplaceTrustStore,
    prompter
  );
  const installAiToolUseCase = new InstallAiToolUseCase(
    installRuntimeConfigUseCase,
    manifestRepo,
    pluginInstallFromMarketplaceUseCase,
    marketplaceSyncSettingsUseCase,
    logger
  );
  const syncConflictResolverUseCase = new SyncConflictResolverUseCase(fs);
  const doctorTrackedFilesUseCase = new DoctorTrackedFilesUseCase(fs);
  const doctorMergeFilesUseCase = new DoctorMergeFilesUseCase(fs, hasher);
  const detectPluginDriftUseCase = new DetectPluginDrift(fs);
  const doctorPluginUseCase = new DoctorPluginUseCase(detectPluginDriftUseCase);
  const doctorReferencesUseCase = new DoctorReferencesUseCase(fs);
  const doctorLayoutUseCase = new DoctorLayoutUseCase(fs, tokenProvider);
  // Named so `doctor --scope user` reuses this instance: the check takes its manifest and
  // project root per call, so nothing about it is project-scope-specific.
  const doctorRegistrationUseCase = new DoctorRegistrationUseCase(
    fs,
    marketplaceRegistry,
    nativePluginActivators,
    new InspectHostRegistration(fs, hostPluginRegistries, hostMarketplaceRegistries),
    userConfigDir,
    currentVersionProvider
  );
  const doctorUseCase = new DoctorUseCase(
    manifestRepo,
    doctorTrackedFilesUseCase,
    doctorMergeFilesUseCase,
    doctorPluginUseCase,
    doctorReferencesUseCase,
    doctorLayoutUseCase,
    doctorRegistrationUseCase
  );
  const setupMarketplaceSourceUseCase = new SetupMarketplaceSourceUseCase(
    prompter,
    releaseResolver
  );
  const setupToolsUseCase = new SetupToolsUseCase(
    manifestRepo,
    installRuntimeConfigUseCase,
    installIdeConfig
  );
  const setupPluginsPromptUseCase = new SetupPluginsPromptUseCase(
    pluginPickUseCase,
    pluginInstallFromMarketplaceUseCase,
    marketplaceRegistry,
    resolveMarketplaceUseCase
  );
  const setupToolsPromptUseCase = new SetupToolsPromptUseCase(prompter);
  const projectContextDetector = new ProjectContextDetectorUseCase(fs);
  const setupMarketplaceRegistration = new SetupMarketplaceRegistrationUseCase(
    fs,
    setupMarketplaceSourceUseCase,
    registerFrameworkMarketplace,
    refreshMarketplace,
    currentVersionProvider,
    logger,
    environment,
    tokenProvider,
    releaseResolver,
    userSourceReferences
  );
  // Restore re-materializes through the build pipeline, matching what install wrote:
  // rewriting raw content instead would itself be drift.
  const builtMaterializationDeps = {
    ensureBuilt: ensureBuiltMarketplaceUseCase,
    marketplaceRegistry,
    homedir,
  };
  // One writer for a machine-scope plugin's files, whether setup installs it or update rebuilds it.
  const userPluginFileUpdater = new UserPluginFileUpdater(
    fs,
    new PluginDistributionLoader(pluginFetcher, pluginDistributionReader, () =>
      join(userConfigDir(), "cache", "plugin-cache")
    ),
    hasher,
    builtMaterializationDeps
  );
  const setupMachineScopeUseCase = new SetupMachineScopeUseCase(
    userManifestRepo,
    setupMarketplaceRegistration,
    marketplaceSyncSettingsUseCase,
    currentVersionProvider,
    new InstallGlobalPluginsUseCase(
      marketplaceRegistry,
      resolveMarketplaceUseCase,
      userPluginFileUpdater,
      logger
    )
  );
  const statusUseCase = new ReportStatus(fs, manifestRepo, hasher, detectPluginDriftUseCase);
  const pluginUpdateUseCase = new UpdatePlugin(
    fs,
    manifestRepo,
    new PluginDistributionLoader(pluginFetcher, pluginDistributionReader),
    hasher,
    builtMaterializationDeps,
    installRuntimeConfigUseCase
  );
  const userPluginUpdateUseCase = new UserPluginUpdateUseCase(
    userManifestRepo,
    userPluginFileUpdater,
    logger,
    new RefreshHostPlugin(nativePluginActivators, hostPluginRegistries, nativeSources)
  );
  const restoreUseCase = new Restore(
    fs,
    manifestRepo,
    hasher,
    logger,
    platform,
    prompter,
    pluginFetcher,
    pluginDistributionReader,
    assetProvider,
    builtMaterializationDeps
  );
  const uninstallUseCase = new UninstallUseCase(fs, manifestRepo, logger, userManifestRepo);
  const statusAllUseCase = new StatusAllUseCase(statusUseCase);
  const restoreAllUseCase = new RestoreAllUseCase(
    manifestRepo,
    prompter,
    statusUseCase,
    restoreUseCase
  );
  const resolveUpdateDecisionUseCase = new ResolveUpdateDecisionUseCase(prompter);
  const updateOneToolUseCase = new UpdateOneToolUseCase(
    installRuntimeConfigUseCase,
    installIdeConfig,
    syncConflictResolverUseCase,
    resolveUpdateDecisionUseCase,
    fs
  );
  const updateAiToolsUseCase = new UpdateAiToolsUseCase(
    manifestRepo,
    currentVersionProvider,
    updateOneToolUseCase
  );
  const updateIdeToolsUseCase = new UpdateIdeToolsUseCase(
    manifestRepo,
    currentVersionProvider,
    updateOneToolUseCase
  );
  const cleanUseCase = new CleanUseCase(
    fs,
    manifestRepo,
    logger,
    updateGitignore,
    nativePluginActivators,
    marketplaceRegistry,
    prompter,
    hostMarketplaceRegistries,
    undefined,
    userSourceReferences,
    hostPluginRegistries,
    userManifestRepo,
    nativeSources
  );
  const cleanUserScopeUseCase = new CleanUserScopeUseCase(
    fs,
    userManifestRepo,
    logger,
    marketplaceRegistry,
    userConfigDir,
    nativePluginActivators,
    hostMarketplaceRegistries,
    homedir,
    userSourceReferences,
    prompter,
    nativeSources,
    hostPluginRegistries
  );
  const doctorAllUseCase = new DoctorAllUseCase(doctorUseCase);
  const listInstalledRulesUseCase = new ListInstalledRules(fs);
  const update = wireUpdate({
    logger,
    http,
    fs,
    environment,
    tokenProvider,
    version: currentVersionProvider,
  });
  const deps: Deps = {
    validateRecipes: wireRecipes().validateRecipes,
    fs,
    manifestRepo,
    userManifestRepo,
    homedir,
    environment,
    logger,
    currentVersionProvider,
    prompter,
    logIn,
    logOut,
    checkStatus,
    pluginRemoveUseCase,
    pluginListUseCase,
    pluginUpdateUseCase,
    userPluginUpdateUseCase,
    addMarketplace,
    listMarketplaces,
    marketplaceRemoveUseCase,
    userMarketplaceRemoveUseCase,
    refreshMarketplace,
    marketplaceCheckUseCase,
    userSourceReferences,
    installAiToolUseCase,
    installIdeToolUseCase,
    uninstallIdeUseCase,
    assetProvider,
    searchPlugins,
    registerFrameworkMarketplace,
    pluginInstallUseCase,
    marketplaceSyncSettingsUseCase,
    doctorUseCase,
    doctorRegistrationUseCase,
    setupMarketplaceSourceUseCase,
    setupToolsUseCase,
    setupPluginsPromptUseCase,
    setupToolsPromptUseCase,
    projectContextDetector,
    setupMarketplaceRegistration,
    setupMachineScopeUseCase,
    selfUpdate: update.selfUpdate,
    statusUseCase,
    restoreUseCase,
    uninstallUseCase,
    statusAllUseCase,
    restoreAllUseCase,
    updateAiToolsUseCase,
    updateIdeToolsUseCase,
    cleanUseCase,
    cleanUserScopeUseCase,
    doctorAllUseCase,
    listInstalledRulesUseCase,
    printUpdateNotice: update.printUpdateNotice,
    refreshUpdateCheck: update.refreshUpdateCheck,
    telemetry: wireTelemetry(homedir),
    frameworkBuild: (ctx) => createFrameworkBuildUseCase(tools, { fs, assetProvider, logger }, ctx),
  };
  graphs.set(cacheKey, deps);
  return deps;
}
