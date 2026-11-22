import { homedir, tmpdir } from "node:os";
import type { RegistrationRecordRules } from "../contexts/host-registration/contract/registration-record-rules.js";
import { mergeCatalogueClaims } from "../contexts/host-registration/domain/record/catalogue-claims.js";
import { refOnHostName } from "../contexts/host-registration/domain/record/host-ref.js";
import { afterActivation } from "../contexts/host-registration/domain/record/registration-projection.js";
import {
  claimsOnMarketplace,
  isQualifiedRef,
  marketplaceOf,
  pluginRefsOf,
  refOf,
  refSelectedBy,
  refsOnHosts,
  registrationPreview,
  withoutClaimedRef,
  withoutMarketplace,
  withoutRef,
} from "../contexts/host-registration/domain/record/registration-record.js";
import { ReadMachineInstallation } from "../contexts/installation/application/doctor/read-machine-installation.use-case.js";
import { InstallIdeConfig } from "../contexts/installation/application/install/config/install-ide-config.use-case.js";
import { InstallRuntimeConfig } from "../contexts/installation/application/install/config/install-runtime-config.use-case.js";
import { TrackedConfigFiles } from "../contexts/installation/application/install/config/tracked-config-files.use-case.js";
import { PropagateAiSettingsToIde } from "../contexts/installation/application/install/propagate-ai-settings-to-ide.use-case.js";
import { RunPostInstallPipeline } from "../contexts/installation/application/install/run-post-install-pipeline.use-case.js";
import { ListInstalledRules } from "../contexts/installation/application/list-installed-rules.use-case.js";
import {
  CacheBuiltMarketplace,
  type FrameworkBuilds,
} from "../contexts/installation/application/marketplace/cache-built-marketplace.use-case.js";
import { ListPlugins } from "../contexts/installation/application/plugin/list-plugins.use-case.js";
import { DetectPluginDrift } from "../contexts/installation/application/shared/detect-plugin-drift.use-case.js";
import { UpdateGitignore } from "../contexts/installation/application/update-gitignore.use-case.js";
import type { BuiltMarketplaceEnsurer } from "../contexts/installation/contract/built-marketplace.js";
import type { ProjectSetupState } from "../contexts/installation/contract/project-setup-state.js";
import { AgentModelStoreAdapter } from "../contexts/installation/infrastructure/agent-model-store-adapter.js";
import type { AgentModelStore } from "../contexts/installation/ports/agent-model-store.js";
import type { ManifestRepository } from "../contexts/installation/ports/manifest-repository.js";
import type { PluginTranslation } from "../contexts/installation/ports/plugin/plugin-translation.js";
import type { ToolCatalog } from "../contexts/tools/contract/tool-catalog.js";
import { EnsureBuiltMarketplace } from "../orchestration/marketplace/ensure-built-marketplace.use-case.js";
import { BundledAssetProviderAdapter } from "../shared/infrastructure/asset-loader.js";
import type { Logger } from "../shared/ports/logger.js";
import type { Base } from "./shared.js";
import {
  createFrameworkBuildUseCase,
  createPluginTranslation,
  type FrameworkBuildDeps,
} from "./translate.js";
import { userConfigDir } from "./user-config-dir.js";

/** A project is set up once the installation has recorded a manifest for it. */
export function projectSetupOf(manifestRepo: ManifestRepository): ProjectSetupState {
  return { isSetUp: async () => (await manifestRepo.load()) !== null };
}

/** The rules over a recorded registration, answered by the host registration that owns its meaning. */
export const registrationRecordRules: RegistrationRecordRules = {
  pluginRefsOf,
  marketplaceOf,
  claimsOnMarketplace,
  refOnHostName,
  isQualifiedRef,
  refSelectedBy,
  refOf,
  refsOnHosts,
  registrationPreview,
  withoutRef,
  withoutClaimedRef,
  withoutMarketplace,
  afterActivation,
  mergeCatalogueClaims,
};

/** Builds a distribution into the aidd-owned cache, overwriting what a previous build left there. */
export function cacheBuildFor(
  tools: ToolCatalog,
  deps: FrameworkBuildDeps
): FrameworkBuilds["buildFor"] {
  return ({ target, mode, outDir, variant }) =>
    createFrameworkBuildUseCase(tools, deps, {
      target,
      mode,
      outDir,
      force: true,
      ...(variant === undefined ? {} : { provider: variant }),
    });
}

/** The cache builds, each tool's tree carrying the provider its agents run on, the variant a
 * changed provider makes stale. */
export function frameworkBuildsOf(
  tools: ToolCatalog,
  buildFor: FrameworkBuilds["buildFor"],
  store: AgentModelStore
): FrameworkBuilds {
  return {
    variant: async (target) => {
      const id = tools.aiToolId(target);
      if (id === null || tools.aiProfile(id).agentModels() === null) return undefined;
      return (await store.loadProviders())[id];
    },
    buildFor,
  };
}

/** A logger whose every level lands at debug, for work that runs behind almost every command. */
export function debugOnly(logger: Logger): Logger {
  return {
    debug: (message, cause) => logger.debug(message, cause),
    info: (message) => logger.debug(message),
    warn: (message, cause) => logger.debug(message, cause),
  };
}

/** What a restore needs to rebuild through the build pipeline. */
export function builtMaterializationDepsOf(
  ensureBuilt: BuiltMarketplaceEnsurer,
  marketplaceRegistry: Base["marketplaceRegistry"],
  translate: PluginTranslation
) {
  return { ensureBuilt, marketplaceRegistry, homedir, translate, platform: process.platform };
}

/** What installing a tool's configuration writes, and the steps that follow each install. */
function wireConfigInstallation(base: Base, assetProvider: BundledAssetProviderAdapter) {
  const { tools, fs, logger, manifestRepo } = base;
  const updateGitignore = new UpdateGitignore(fs);
  const runPostInstallPipeline = new RunPostInstallPipeline(manifestRepo, updateGitignore, tools);
  const trackedConfigFiles = new TrackedConfigFiles(fs, logger);
  const installRuntimeConfigUseCase = new InstallRuntimeConfig(
    { trackedConfigFiles, fs, assets: assetProvider, runPostInstallPipeline },
    tools
  );
  const installIdeConfig = new InstallIdeConfig(
    { trackedConfigFiles, assets: assetProvider, runPostInstallPipeline },
    tools
  );
  const propagateAiSettingsToIde = new PropagateAiSettingsToIde(
    { manifestRepo, trackedConfigFiles, runPostInstallPipeline, assetProvider },
    tools
  );
  return {
    updateGitignore,
    runPostInstallPipeline,
    installRuntimeConfigUseCase,
    installIdeConfig,
    propagateAiSettingsToIde,
  };
}

/** The build cache a marketplace is materialized through, and the agent models it bakes in. */
function wireBuiltMarketplace(base: Base, assetProvider: BundledAssetProviderAdapter) {
  const { tools, fs, logger, currentVersionProvider, resolveMarketplaceUseCase } = base;
  // `force: true` is safe here: `outDir` is always an aidd-owned disposable cache, never a
  // user-owned directory, so a collision only means a previous build's cache exists. Its
  // diagnostics drop to debug because this build runs behind almost every command, where
  // they would report an implementation detail as news; `--verbose` still shows them.
  const frameworkBuildFor = cacheBuildFor(tools, {
    fs,
    assetProvider,
    logger: debugOnly(logger),
  });
  const agentModelStore = new AgentModelStoreAdapter(fs, userConfigDir);
  const cacheBuiltMarketplace = new CacheBuiltMarketplace({
    fs,
    builds: frameworkBuildsOf(tools, frameworkBuildFor, agentModelStore),
    version: currentVersionProvider,
    userCacheRoot: userConfigDir,
    tmpdir,
  });
  const ensureBuiltMarketplaceUseCase = new EnsureBuiltMarketplace(
    resolveMarketplaceUseCase,
    cacheBuiltMarketplace
  );
  return { agentModelStore, ensureBuiltMarketplaceUseCase };
}

/** The installation context's shared commands and the build cache they read. */
export function wireInstallation(base: Base) {
  const { tools, fs, manifestRepo, userManifestRepo, marketplaceRegistry } = base;
  const assetProvider = new BundledAssetProviderAdapter(tools);
  const { agentModelStore, ensureBuiltMarketplaceUseCase } = wireBuiltMarketplace(
    base,
    assetProvider
  );
  // Restore re-materializes through the build pipeline, matching what install wrote:
  // rewriting raw content instead would itself be drift.
  const builtMaterializationDeps = builtMaterializationDepsOf(
    ensureBuiltMarketplaceUseCase,
    marketplaceRegistry,
    createPluginTranslation(tools)
  );
  return {
    assetProvider,
    agentModelStore,
    ensureBuiltMarketplaceUseCase,
    ...wireConfigInstallation(base, assetProvider),
    listInstalledRulesUseCase: new ListInstalledRules(fs, process.platform, tools),
    readMachineInstallation: new ReadMachineInstallation(userManifestRepo),
    pluginListUseCase: new ListPlugins(manifestRepo, tools),
    builtMaterializationDeps,
    detectPluginDriftUseCase: new DetectPluginDrift(fs, tools, homedir),
    registrationRecordRules,
  };
}

export type Installation = ReturnType<typeof wireInstallation>;
