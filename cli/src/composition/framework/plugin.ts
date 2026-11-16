import { join } from "node:path";
import { ResolvePluginSource } from "../../contexts/distribution/application/plugin-source/resolve-plugin-source.js";
import { SearchPlugins } from "../../contexts/distribution/application/plugin-source/search-plugins.js";
import { TrustPluginSource } from "../../contexts/distribution/application/plugin-source/trust-plugin-source.js";
import { RefreshHostPlugin } from "../../contexts/host-registration/application/refresh-host-plugin.js";
import { AddPlugin } from "../../contexts/installation/application/plugin/add-plugin.js";
import { PlanPluginInstall } from "../../contexts/installation/application/plugin/plan-plugin-install.js";
import { PluginDistributionLoader } from "../../contexts/installation/application/plugin/plugin-distribution-loader.js";
import {
  type BoundPluginMaterializer,
  PluginMaterializer,
  type UserScopeFileGuard,
} from "../../contexts/installation/application/plugin/plugin-materializer.js";
import { UpdatePlugin } from "../../contexts/installation/application/plugin/update-plugin.js";
import { UpdateUserPluginFiles } from "../../contexts/installation/application/plugin/update-user-plugin-files.js";
import { RemovePlugin } from "../../contexts/installation/application/removal/remove-plugin.js";
import { pluginRemovalClaims } from "../../contexts/machine-claims/application/plugin-removal-claims.js";
import { PurgeDeclaredCache } from "../../contexts/machine-claims/application/purge-declared-cache.js";
import {
  assertUserScopeWriteBoundary,
  userScopeFilesSafeToDelete,
  withoutMissingFiles,
} from "../../contexts/machine-claims/application/user-scope-plugin-files.js";
import { isStrictlyWithinUserScope } from "../../contexts/machine-claims/domain/user-scope-containment.js";
import { InstallFromMarketplace } from "../../orchestration/plugin/install-from-marketplace.js";
import { InstallPlugin } from "../../orchestration/plugin/install-plugin.js";
import { UpdateUserPlugin } from "../../orchestration/plugin/update-user-plugin.js";
import { PluginPickUseCase } from "../../presentation/prompts/plugin-pick-use-case.js";
import { resolveHomeDir } from "../../shared/infrastructure/home-dir.js";
import { userConfigDir } from "../../shared/infrastructure/user-config-dir.js";
import type { Base } from "./base.js";
import type { Installation } from "./installation.js";

/** Where a fetched plugin distribution is kept between runs. */
export function pluginCacheDir(): string {
  return join(userConfigDir(), "cache", "plugin-cache");
}

/** The materializer with the machine-scope containment rule bound, and no rebuild unless asked. */
export function withinUserScope(
  materializer: Pick<PluginMaterializer, "planUpdate" | "applyUpdate">
): BoundPluginMaterializer {
  return {
    planUpdate: (plugin, tool, projectRoot, log, rebuild = false) =>
      materializer.planUpdate(plugin, tool, projectRoot, log, rebuild, isStrictlyWithinUserScope),
    applyUpdate: (plan, log) => materializer.applyUpdate(plan, log, isStrictlyWithinUserScope),
  };
}

/** Resolves a cache path a removal may delete, through the purge that owns the rule. */
export function purgeCandidateResolverOf(purge: Pick<PurgeDeclaredCache, "resolveCandidate">) {
  return (...args: Parameters<PurgeDeclaredCache["resolveCandidate"]>) =>
    purge.resolveCandidate(...args);
}

// One writer for a machine-scope plugin's files, whether setup installs it or update rebuilds it.
export const userScopeFileGuard: UserScopeFileGuard = {
  safeToDelete: userScopeFilesSafeToDelete,
  withoutMissing: withoutMissingFiles,
  assertWriteBoundary: assertUserScopeWriteBoundary,
};

/** The plugin lifecycle: add, install, update and remove. */
export function wirePlugin(base: Base, inst: Installation) {
  const {
    fs,
    hasher,
    logger,
    prompter,
    manifestRepo,
    userManifestRepo,
    pluginDistributionReader,
    nativePluginActivators,
    hostPluginRegistries,
    nativeSources,
    userSourceReferences,
    pluginFetcher,
    marketplaceRegistry,
    marketplaceTrustStore,
    resolveMarketplaceUseCase,
    withdrawFromHost,
  } = base;
  const { ensureBuiltMarketplaceUseCase, installRuntimeConfigUseCase, builtMaterializationDeps } =
    inst;
  const pluginRemoveUseCase = new RemovePlugin(
    fs,
    { project: manifestRepo, user: userManifestRepo },
    withdrawFromHost,
    pluginRemovalClaims({
      repo: userManifestRepo,
      fs,
      logger,
      home: resolveHomeDir(),
      userSourceReferences,
      marketplaceRegistry,
      resolveCacheCandidate: purgeCandidateResolverOf(new PurgeDeclaredCache(fs, logger)),
    })
  );
  const pluginAddUseCase = new AddPlugin(
    { fs: fs, hasher: hasher, logger: logger },
    { project: manifestRepo, user: userManifestRepo },
    {
      distributionLoader: new PluginDistributionLoader(pluginFetcher, pluginDistributionReader),
      marketplaceRegistry: marketplaceRegistry,
      ensureBuilt: ensureBuiltMarketplaceUseCase,
    },
    installRuntimeConfigUseCase
  );
  const pluginInstallFromMarketplaceUseCase = new InstallFromMarketplace(
    new ResolvePluginSource(marketplaceRegistry, resolveMarketplaceUseCase),
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
  const pluginInstallUseCase = new InstallPlugin(
    new PlanPluginInstall(manifestRepo),
    pluginPickUseCase,
    pluginAddUseCase,
    pluginInstallFromMarketplaceUseCase,
    new TrustPluginSource(marketplaceTrustStore, prompter)
  );
  const pluginMaterializer = new PluginMaterializer(
    fs,
    new PluginDistributionLoader(pluginFetcher, pluginDistributionReader, pluginCacheDir),
    hasher,
    userScopeFileGuard,
    builtMaterializationDeps
  );
  const userPluginFileUpdater = withinUserScope(pluginMaterializer);
  const pluginUpdateUseCase = new UpdatePlugin(
    fs,
    manifestRepo,
    new PluginDistributionLoader(pluginFetcher, pluginDistributionReader),
    hasher,
    builtMaterializationDeps,
    installRuntimeConfigUseCase
  );
  const userPluginUpdateUseCase = new UpdateUserPlugin(
    new UpdateUserPluginFiles(userManifestRepo, pluginMaterializer, logger),
    new RefreshHostPlugin(nativePluginActivators, hostPluginRegistries, nativeSources),
    isStrictlyWithinUserScope
  );
  return {
    pluginRemoveUseCase,
    pluginUpdateUseCase,
    userPluginUpdateUseCase,
    pluginInstallUseCase,
    searchPlugins,
    pluginInstallFromMarketplaceUseCase,
    pluginPickUseCase,
    userPluginFileUpdater,
  };
}

export type Plugin = ReturnType<typeof wirePlugin>;
