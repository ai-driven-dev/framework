import { CheckMarketplaces } from "../../contexts/distribution/application/check-marketplaces.js";
import { ChooseMarketplaceSource } from "../../contexts/distribution/application/choose-marketplace-source.js";
import { EnsureFrameworkMarketplace } from "../../contexts/distribution/application/ensure-framework-marketplace.js";
import { FindMarketplaceToRemove } from "../../contexts/distribution/application/remove/find-marketplace-to-remove.js";
import { FindUserMarketplace } from "../../contexts/distribution/application/remove/find-user-marketplace.js";
import { RemoveMarketplace } from "../../contexts/distribution/application/remove/remove-marketplace.js";
import type { MarketplaceRemover } from "../../contexts/distribution/ports/marketplace-remover.js";
import { NativeHostRegistrationGate } from "../../contexts/host-registration/application/native-host-registration-gate.js";
import { RegisterPluginWithHost } from "../../contexts/host-registration/application/register-plugin-with-host.js";
import { ListPluginSources } from "../../contexts/installation/application/marketplace/list-plugin-sources.js";
import { PurgeMarketplacePlugins } from "../../contexts/installation/application/marketplace/purge-marketplace-plugins.js";
import { RemovePluginsFromMarketplace } from "../../contexts/installation/application/marketplace/remove-plugins-from-marketplace.js";
import { RemoveProjectPlugin } from "../../contexts/installation/application/removal/remove-project-plugin.js";
import { ActivateNativeTools } from "../../contexts/installation/application/sync/activate-native-tools.js";
import { BuildMarketplaceForTool } from "../../contexts/installation/application/sync/build-marketplace-for-tool.js";
import { LoadSyncContext } from "../../contexts/installation/application/sync/load-sync-context.js";
import { RecordActivation } from "../../contexts/installation/application/sync/record-activation.js";
import { SyncToolSettingsFiles } from "../../contexts/installation/application/sync/sync-tool-settings-files.js";
import { PurgeDeclaredCache } from "../../contexts/machine-claims/application/purge-declared-cache.js";
import { RecordSourceReference } from "../../contexts/machine-claims/application/record-source-reference.js";
import { removalClaims } from "../../contexts/machine-claims/application/removal-claims.js";
import { SharedFrameworkSource } from "../../contexts/machine-claims/application/shared-source/shared-framework-source.js";
import { userScopeFilesSafeToDelete } from "../../contexts/machine-claims/application/user-scope-plugin-files.js";
import { CheckMarketplaceUpstream } from "../../orchestration/marketplace/check.js";
import { RemoveProjectMarketplace } from "../../orchestration/marketplace/remove.js";
import { RemoveUserMarketplace } from "../../orchestration/marketplace/remove-user.js";
import { AskMarketplaceSource } from "../../orchestration/setup/ask-marketplace-source.js";
import { RegisterMarketplace } from "../../orchestration/setup/register-marketplace.js";
import {
  type RegisterFrameworkSource,
  SetupMarketplaceRegistration,
} from "../../orchestration/setup/setup-marketplace-registration.js";
import { SyncSettings } from "../../orchestration/sync/sync-settings.js";
import { resolveHomeDir } from "../../shared/infrastructure/home-dir.js";
import { userConfigDir } from "../../shared/infrastructure/user-config-dir.js";
import { wireAddMarketplace } from "../distribution.js";
import type { Base } from "./base.js";
import type { Installation } from "./installation.js";

/** Detaches what a removal's plugins held on the machine, from the removal's own summary. */
export function detachClaimsOf(cleanup: Pick<RemoveProjectPlugin, "detachClaims">) {
  return (
    projectRoot: string,
    removed: {
      readonly nativeRefs: Parameters<RemoveProjectPlugin["detachClaims"]>[1];
      readonly plugins: Parameters<RemoveProjectPlugin["detachClaims"]>[2];
    }
  ) => cleanup.detachClaims(projectRoot, removed.nativeRefs, removed.plugins);
}

/** The question setup asks about which marketplace to register. */
export function askedFrom(ask: Pick<AskMarketplaceSource, "execute">) {
  return (options: Parameters<AskMarketplaceSource["execute"]>[0]) => ask.execute(options);
}

/** Removing a user-scope plugin's files asks which are safe to delete; nobody reads why one is
 * left in place, so the reason is not logged. */
export function quietUserScopeFilesSafeToDelete(
  fs: Parameters<typeof userScopeFilesSafeToDelete>[0]
): (
  plugin: Parameters<typeof userScopeFilesSafeToDelete>[2],
  tool: Parameters<typeof userScopeFilesSafeToDelete>[3],
  home: string
) => ReturnType<typeof userScopeFilesSafeToDelete> {
  return (plugin, tool, home) =>
    userScopeFilesSafeToDelete(fs, { debug() {}, info() {}, warn() {} }, plugin, tool, home);
}

/** A setup flow registers its framework source for the scope the flow runs in. */
export function registerForFlow(
  register: Pick<RegisterMarketplace, "execute">
): RegisterFrameworkSource {
  return (flow, source) =>
    register.execute({ projectRoot: flow.projectRoot, scope: flow.scope, source });
}

/** Marketplace removal, check and sync, and the setup steps that register a marketplace. */
export function wireMarketplace(base: Base, inst: Installation) {
  const {
    tools,
    fs,
    hasher,
    logger,
    environment,
    tokenProvider,
    currentVersionProvider,
    prompter,
    manifestRepo,
    userManifestRepo,
    nativePluginActivators,
    hostMarketplaceRegistries,
    hostPluginRegistries,
    nativeSources,
    userSourceReferences,
    marketplaceRegistry,
    marketplaceTrustStore,
    releaseResolver,
    resolveMarketplaceUseCase,
    refreshMarketplace,
    registerFrameworkMarketplace,
  } = base;
  const { ensureBuiltMarketplaceUseCase } = inst;
  const nativeHostRegistrationGate = new NativeHostRegistrationGate(
    nativePluginActivators,
    hostPluginRegistries,
    nativeSources
  );
  const projectCleanup = new RemoveProjectPlugin(fs, removalClaims(userManifestRepo, fs));
  const marketplaceRemoveUseCase = new RemoveProjectMarketplace(
    new FindMarketplaceToRemove(marketplaceRegistry),
    new RemovePluginsFromMarketplace(manifestRepo, projectCleanup),
    new RemoveMarketplace(marketplaceRegistry),
    detachClaimsOf(projectCleanup),
    prompter
  );
  const userMarketplaceRemoveUseCase = new RemoveUserMarketplace(
    new FindUserMarketplace(marketplaceRegistry),
    new PurgeMarketplacePlugins(
      fs,
      userManifestRepo,
      nativeHostRegistrationGate,
      quietUserScopeFilesSafeToDelete(fs)
    ),
    new RemoveMarketplace(marketplaceRegistry),
    resolveHomeDir()
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
  const marketplaceCheckUseCase = new CheckMarketplaceUpstream(
    new CheckMarketplaces(marketplaceRegistry, resolveMarketplaceUseCase),
    new ListPluginSources(manifestRepo)
  );
  const buildMarketplaceForTool = new BuildMarketplaceForTool(
    ensureBuiltMarketplaceUseCase,
    logger
  );
  const syncSettingsUseCase = new SyncSettings(
    new LoadSyncContext(
      manifestRepo,
      marketplaceRegistry,
      registerFrameworkMarketplace,
      userManifestRepo
    ),
    new SyncToolSettingsFiles(fs, hasher, logger, buildMarketplaceForTool),
    new ActivateNativeTools(
      new RegisterPluginWithHost(
        fs,
        nativePluginActivators,
        hostMarketplaceRegistries,
        hostPluginRegistries,
        nativeSources
      ),
      buildMarketplaceForTool,
      logger,
      userConfigDir
    ),
    new RecordActivation(fs, hasher, userManifestRepo),
    new SharedFrameworkSource(
      fs,
      logger,
      userSourceReferences,
      currentVersionProvider,
      new PurgeDeclaredCache(fs, logger)
    )
  );
  const askMarketplaceSource = new AskMarketplaceSource(
    prompter,
    new ChooseMarketplaceSource(releaseResolver)
  );
  const registerMarketplace = new RegisterMarketplace(
    new EnsureFrameworkMarketplace(registerFrameworkMarketplace, tokenProvider, releaseResolver),
    new RecordSourceReference(fs, currentVersionProvider, logger, userSourceReferences),
    refreshMarketplace,
    environment
  );
  const setupMarketplaceRegistration = new SetupMarketplaceRegistration(
    askedFrom(askMarketplaceSource),
    registerForFlow(registerMarketplace)
  );
  return {
    marketplaceRemoveUseCase,
    userMarketplaceRemoveUseCase,
    addMarketplace,
    marketplaceCheckUseCase,
    syncSettingsUseCase,
    askMarketplaceSource,
    setupMarketplaceRegistration,
  };
}

export type Marketplace = ReturnType<typeof wireMarketplace>;
