import { homedir } from "node:os";
import { join } from "node:path";
import { AddMarketplace } from "../contexts/distribution/application/add-marketplace.js";
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
import { GitignoreUseCase } from "../contexts/framework/application/gitignore-use-case.js";
import { DoctorAllUseCase } from "../contexts/framework/application/global/doctor-all-use-case.js";
import { ResolveUpdateDecisionUseCase } from "../contexts/framework/application/global/resolve-update-decision-use-case.js";
import { RestoreAllUseCase } from "../contexts/framework/application/global/restore-all-use-case.js";
import { StatusAllUseCase } from "../contexts/framework/application/global/status-all-use-case.js";
import { UpdateAiToolsUseCase } from "../contexts/framework/application/global/update-ai-tools-use-case.js";
import { UpdateIdeToolsUseCase } from "../contexts/framework/application/global/update-ide-tools-use-case.js";
import { UpdateOneToolUseCase } from "../contexts/framework/application/global/update-one-tool-use-case.js";
import { InstallAiToolUseCase } from "../contexts/framework/application/install/install-ai-tool-use-case.js";
import { InstallIdeConfigUseCase } from "../contexts/framework/application/install/install-ide-config-use-case.js";
import { InstallIdeToolUseCase } from "../contexts/framework/application/install/install-ide-tool-use-case.js";
import { InstallRuntimeConfigUseCase } from "../contexts/framework/application/install/install-runtime-config-use-case.js";
import { PostInstallPipelineUseCase } from "../contexts/framework/application/install/post-install-pipeline-use-case.js";
import { ListInstalledRulesUseCase } from "../contexts/framework/application/list-installed-rules-use-case.js";
import { NativeHostRegistrationGate } from "../contexts/framework/application/ownership/native-host-registration-gate.js";
import { ProjectPluginCleanup } from "../contexts/framework/application/ownership/project-plugin-cleanup.js";
import { UserMarketplaceRemoveUseCase } from "../contexts/framework/application/ownership/user-marketplace-remove-use-case.js";
import { UserPluginFileUpdater } from "../contexts/framework/application/ownership/user-plugin-file-updater.js";
import { UserPluginUpdateUseCase } from "../contexts/framework/application/ownership/user-plugin-update-use-case.js";
import { PluginAddUseCase } from "../contexts/framework/application/plugin/plugin-add-use-case.js";
import { PluginDistributionLoader } from "../contexts/framework/application/plugin/plugin-distribution-loader.js";
import { PluginInstallFromMarketplaceUseCase } from "../contexts/framework/application/plugin/plugin-install-from-marketplace-use-case.js";
import { PluginInstallUseCase } from "../contexts/framework/application/plugin/plugin-install-use-case.js";
import { PluginListUseCase } from "../contexts/framework/application/plugin/plugin-list-use-case.js";
import { PluginRemoveUseCase } from "../contexts/framework/application/plugin/plugin-remove-use-case.js";
import { PluginSearchUseCase } from "../contexts/framework/application/plugin/plugin-search-use-case.js";
import { PluginUpdateUseCase } from "../contexts/framework/application/plugin/plugin-update-use-case.js";
import { RestoreUseCase } from "../contexts/framework/application/restore/restore-use-case.js";
import { InstallGlobalPluginsUseCase } from "../contexts/framework/application/setup/install-global-plugins-use-case.js";
import { ProjectContextDetectorUseCase } from "../contexts/framework/application/setup/project-context-detector-use-case.js";
import { SetupMachineScopeUseCase } from "../contexts/framework/application/setup/setup-machine-scope-use-case.js";
import { SetupMarketplaceSourceUseCase } from "../contexts/framework/application/setup/setup-marketplace-source-use-case.js";
import { SetupToolsUseCase } from "../contexts/framework/application/setup/setup-tools-use-case.js";
import { DetectPluginDriftUseCase } from "../contexts/framework/application/shared/detect-plugin-drift-use-case.js";
import {
  EnsureBuiltMarketplaceUseCase,
  type FrameworkBuildFor,
} from "../contexts/framework/application/shared/ensure-built-marketplace-use-case.js";
import { SetupMarketplaceRegistrationUseCase } from "../contexts/framework/application/shared/setup-marketplace-registration-use-case.js";
import { StatusUseCase } from "../contexts/framework/application/status-use-case.js";
import { UninstallIdeUseCase } from "../contexts/framework/application/uninstall/uninstall-ide-use-case.js";
import { UninstallToolsUseCase } from "../contexts/framework/application/uninstall/uninstall-tools-use-case.js";
import { UninstallUseCase } from "../contexts/framework/application/uninstall/uninstall-use-case.js";
import { BundledAssetProviderAdapter } from "../contexts/framework/infrastructure/assets/asset-loader.js";
import { HasherAdapter } from "../contexts/framework/infrastructure/hasher-adapter.js";
import { ManifestRepositoryAdapter } from "../contexts/framework/infrastructure/manifest-repository-adapter.js";
import { PlatformAdapter } from "../contexts/framework/infrastructure/platform-adapter.js";
import { PluginDistributionReaderAdapter } from "../contexts/framework/infrastructure/plugin-distribution-reader-adapter.js";
import { UserManifestRepositoryAdapter } from "../contexts/framework/infrastructure/user-manifest-repository-adapter.js";
import { UserSourceReferencesAdapter } from "../contexts/framework/infrastructure/user-source-references-adapter.js";
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
import { type MergeStrategy, mergeIntoJsonFile } from "../shared/domain/merge.js";
import { atomicWriteFile } from "../shared/infrastructure/atomic-write.js";
import { CurrentVersionAdapter } from "../shared/infrastructure/current-version-adapter.js";
import { EnvironmentAdapter } from "../shared/infrastructure/environment-adapter.js";
import { FileAdapter } from "../shared/infrastructure/file-adapter.js";
import { HttpClient } from "../shared/infrastructure/http-client.js";
import { userConfigDir } from "../shared/infrastructure/user-config-dir.js";
import type { Logger } from "../shared/ports/logger.js";
import { wireAuth } from "./auth.js";
import { wireDistribution } from "./distribution.js";
import { wireHostRegistration } from "./host-registration.js";
import { wireRecipes } from "./recipes.js";
import { wireTelemetry } from "./telemetry.js";
import { createFrameworkBuildUseCase } from "./translate.js";
import { wireUpdate } from "./update.js";

/** One graph per catalog, then per project root and token: two catalogs never share a graph. */
const _cache = new WeakMap<ToolCatalog, Map<string, Deps>>();

export function createMenuDeps(projectRoot: string): MenuDeps {
  return {
    manifestRepo: new ManifestRepositoryAdapter(projectRoot),
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
  const files = new FileAdapter(hasher, logger);
  const fs = Object.assign(files, {
    mergeJsonFile: (path: string, content: string, strategy: MergeStrategy) =>
      mergeIntoJsonFile(files, path, content, strategy),
  });
  const pluginDistributionReader = new PluginDistributionReaderAdapter(
    fs,
    pluginManifestProbes(tools)
  );
  const manifestRepo = new ManifestRepositoryAdapter(projectRoot);
  const userManifestRepo = new UserManifestRepositoryAdapter(userConfigDir, atomicWriteFile);
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
    nativePluginActivators,
    hostPluginRegistries,
    userSourceReferences,
    marketplaceRegistry,
    userManifestRepo,
    nativeSources
  );
  const pluginListUseCase = new PluginListUseCase(manifestRepo);
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
  // `marketplace add --overwrite` removes before it adds, and removing deletes installed
  // plugin files — framework work — so the orchestration belongs here rather than pulling
  // framework into distribution's own wiring.
  const addMarketplace = new AddMarketplace(
    marketplaceRegistry,
    marketplaceTrustStore,
    resolveMarketplaceUseCase,
    prompter,
    {
      remove: async (request) => {
        const removal = { ...request, tools };
        await (request.scope === "user"
          ? userMarketplaceRemoveUseCase.execute(removal)
          : marketplaceRemoveUseCase.execute(removal));
      },
    }
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
  const ensureBuiltMarketplaceUseCase = new EnsureBuiltMarketplaceUseCase(
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
  const gitignoreUseCase = new GitignoreUseCase(fs);
  const postInstallPipelineUseCase = new PostInstallPipelineUseCase(manifestRepo, gitignoreUseCase);
  const installRuntimeConfigUseCase = new InstallRuntimeConfigUseCase(
    fs,
    hasher,
    logger,
    assetProvider,
    postInstallPipelineUseCase
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
  const installIdeConfigUseCase = new InstallIdeConfigUseCase(
    fs,
    hasher,
    logger,
    assetProvider,
    postInstallPipelineUseCase
  );
  const installIdeToolUseCase = new InstallIdeToolUseCase(
    installIdeConfigUseCase,
    manifestRepo,
    fs,
    hasher,
    postInstallPipelineUseCase,
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
  const pluginSearchUseCase = new PluginSearchUseCase(
    marketplaceRegistry,
    resolveMarketplaceUseCase
  );
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
  const detectPluginDriftUseCase = new DetectPluginDriftUseCase(fs);
  const doctorPluginUseCase = new DoctorPluginUseCase(detectPluginDriftUseCase);
  const doctorReferencesUseCase = new DoctorReferencesUseCase(fs);
  const doctorLayoutUseCase = new DoctorLayoutUseCase(fs, tokenProvider);
  // Named so `doctor --scope user` reuses this instance: the check takes its manifest and
  // project root per call, so nothing about it is project-scope-specific.
  const doctorRegistrationUseCase = new DoctorRegistrationUseCase(
    fs,
    marketplaceRegistry,
    nativePluginActivators,
    hostPluginRegistries,
    hostMarketplaceRegistries,
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
    installIdeConfigUseCase
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
  const statusUseCase = new StatusUseCase(fs, manifestRepo, hasher, detectPluginDriftUseCase);
  const pluginUpdateUseCase = new PluginUpdateUseCase(
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
    nativeHostRegistrationGate
  );
  const restoreUseCase = new RestoreUseCase(
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
    installIdeConfigUseCase,
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
    gitignoreUseCase,
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
  const listInstalledRulesUseCase = new ListInstalledRulesUseCase(fs);
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
    pluginSearchUseCase,
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
