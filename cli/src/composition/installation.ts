import { homedir } from "node:os";
import {
  afterActivation,
  claimsOnMarketplace,
  isQualifiedRef,
  marketplaceOf,
  mergeCatalogueClaims,
  pluginRefsOf,
  refOf,
  refOnAnyHost,
  refOnHostName,
  refSelectedBy,
  refsOnHosts,
  registrationPreview,
  withoutClaimedRef,
  withoutMarketplace,
  withoutRef,
} from "../contexts/host-registration/domain/registration-record.js";
import { InstallIdeConfig } from "../contexts/installation/application/install/config/install-ide-config.js";
import { InstallRuntimeConfig } from "../contexts/installation/application/install/config/install-runtime-config.js";
import { TrackedConfigFiles } from "../contexts/installation/application/install/config/tracked-config-files.js";
import { RunPostInstallPipeline } from "../contexts/installation/application/install/run-post-install-pipeline.js";
import { ListInstalledRules } from "../contexts/installation/application/list-installed-rules.js";
import { CacheBuiltMarketplace } from "../contexts/installation/application/marketplace/cache-built-marketplace.js";
import { ListPlugins } from "../contexts/installation/application/plugin/list-plugins.js";
import { DetectPluginDrift } from "../contexts/installation/application/shared/detect-plugin-drift.js";
import type {
  BuiltMarketplaceEnsurer,
  FrameworkBuilds,
} from "../contexts/installation/application/shared/ensure-built-marketplace.js";
import { UpdateGitignore } from "../contexts/installation/application/update-gitignore.js";
import { AgentModelStoreAdapter } from "../contexts/installation/infrastructure/agent-model-store-adapter.js";
import type { AgentModelStore } from "../contexts/installation/ports/agent-model-store.js";
import type { RegistrationRecordRules } from "../contexts/installation/ports/native-host.js";
import type { PluginTranslation } from "../contexts/installation/ports/plugin/plugin-translation.js";
import type { ToolCatalog } from "../contexts/tools/contract/tool-catalog.js";
import { EnsureBuiltMarketplace } from "../orchestration/marketplace/ensure-built-marketplace.js";
import { BundledAssetProviderAdapter } from "../shared/infrastructure/asset-loader.js";
import { userConfigDir } from "../shared/infrastructure/user-config-dir.js";
import type { Logger } from "../shared/ports/logger.js";
import type { Base } from "./shared.js";
import {
  createFrameworkBuildUseCase,
  createPluginTranslation,
  type FrameworkBuildDeps,
} from "./translate.js";

/** The rules over a recorded registration, answered by the host registration that owns its meaning. */
export const registrationRecordRules: RegistrationRecordRules = {
  pluginRefsOf,
  marketplaceOf,
  claimsOnMarketplace,
  refOnAnyHost,
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
  return (target, mode, outDir, provider) =>
    createFrameworkBuildUseCase(tools, deps, {
      target,
      mode,
      outDir,
      force: true,
      ...(provider === undefined ? {} : { provider }),
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
    debug: (message) => logger.debug(message),
    info: (message) => logger.debug(message),
    warn: (message) => logger.debug(message),
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

/** The installation context's shared commands and the build cache they read. */
export function wireInstallation(base: Base) {
  const {
    tools,
    fs,
    hasher,
    logger,
    currentVersionProvider,
    manifestRepo,
    marketplaceRegistry,
    resolveMarketplaceUseCase,
  } = base;
  const assetProvider = new BundledAssetProviderAdapter(tools);
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
  const cacheBuiltMarketplace = new CacheBuiltMarketplace(
    fs,
    frameworkBuildsOf(tools, frameworkBuildFor, agentModelStore),
    currentVersionProvider,
    userConfigDir
  );
  const ensureBuiltMarketplaceUseCase = new EnsureBuiltMarketplace(
    resolveMarketplaceUseCase,
    cacheBuiltMarketplace
  );
  const detectPluginDriftUseCase = new DetectPluginDrift(fs, tools);
  const updateGitignore = new UpdateGitignore(fs);
  const runPostInstallPipeline = new RunPostInstallPipeline(manifestRepo, updateGitignore, tools);
  const trackedConfigFiles = new TrackedConfigFiles(fs, hasher, logger);
  const installRuntimeConfigUseCase = new InstallRuntimeConfig(
    trackedConfigFiles,
    fs,
    assetProvider,
    runPostInstallPipeline,
    tools
  );
  const installIdeConfig = new InstallIdeConfig(
    trackedConfigFiles,
    assetProvider,
    runPostInstallPipeline,
    tools
  );
  const listInstalledRulesUseCase = new ListInstalledRules(fs, process.platform, tools);
  const pluginListUseCase = new ListPlugins(manifestRepo, tools);
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
    updateGitignore,
    runPostInstallPipeline,
    installRuntimeConfigUseCase,
    installIdeConfig,
    listInstalledRulesUseCase,
    pluginListUseCase,
    builtMaterializationDeps,
    detectPluginDriftUseCase,
    registrationRecordRules,
  };
}

export type Installation = ReturnType<typeof wireInstallation>;
