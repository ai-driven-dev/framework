import { join } from "node:path";
import { SearchPlugins } from "../../contexts/distribution/application/search-plugins.js";
import { UserPluginFileUpdater } from "../../contexts/framework/application/ownership/user-plugin-file-updater.js";
import { UserPluginUpdateUseCase } from "../../contexts/framework/application/ownership/user-plugin-update-use-case.js";
import { PluginAddUseCase } from "../../contexts/framework/application/plugin/plugin-add-use-case.js";
import { PluginInstallFromMarketplaceUseCase } from "../../contexts/framework/application/plugin/plugin-install-from-marketplace-use-case.js";
import { PluginInstallUseCase } from "../../contexts/framework/application/plugin/plugin-install-use-case.js";
import { PluginRemoveUseCase } from "../../contexts/framework/application/plugin/plugin-remove-use-case.js";
import { RefreshHostPlugin } from "../../contexts/host-registration/application/refresh-host-plugin.js";
import { PluginDistributionLoader } from "../../contexts/installation/application/plugin/plugin-distribution-loader.js";
import { UpdatePlugin } from "../../contexts/installation/application/plugin/update-plugin.js";
import { isStrictlyWithinUserScope } from "../../contexts/machine-claims/domain/user-scope-containment.js";
import { PluginPickUseCase } from "../../presentation/prompts/plugin-pick-use-case.js";
import { userConfigDir } from "../../shared/infrastructure/user-config-dir.js";
import type { Base } from "./base.js";
import type { Installation } from "./installation.js";

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
  const pluginRemoveUseCase = new PluginRemoveUseCase(
    fs,
    manifestRepo,
    logger,
    withdrawFromHost,
    userSourceReferences,
    marketplaceRegistry,
    userManifestRepo
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
  // One writer for a machine-scope plugin's files, whether setup installs it or update rebuilds it.
  const userPluginFileUpdater = new UserPluginFileUpdater(
    fs,
    new PluginDistributionLoader(pluginFetcher, pluginDistributionReader, () =>
      join(userConfigDir(), "cache", "plugin-cache")
    ),
    hasher,
    isStrictlyWithinUserScope,
    builtMaterializationDeps
  );
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
