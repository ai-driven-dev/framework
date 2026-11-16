import type { MarketplaceRemover } from "../../contexts/distribution/ports/marketplace-remover.js";
import { MarketplaceCheckUseCase } from "../../contexts/framework/application/flows/marketplace-check-use-case.js";
import { MarketplaceRemoveUseCase } from "../../contexts/framework/application/flows/marketplace-remove-use-case.js";
import {
  ActivateNativeTools,
  BuildMarketplaceForTool,
  LoadSyncContext,
  MarketplaceSyncSettingsUseCase,
  RecordActivation,
  SharedFrameworkSource,
  SyncToolSettingsFiles,
} from "../../contexts/framework/application/flows/marketplace-sync-settings-use-case.js";
import { ProjectPluginCleanup } from "../../contexts/framework/application/ownership/project-plugin-cleanup.js";
import { UserMarketplaceRemoveUseCase } from "../../contexts/framework/application/ownership/user-marketplace-remove-use-case.js";
import { SetupMarketplaceSourceUseCase } from "../../contexts/framework/application/setup/setup-marketplace-source-use-case.js";
import { SetupMarketplaceRegistrationUseCase } from "../../contexts/framework/application/shared/setup-marketplace-registration-use-case.js";
import { NativeHostRegistrationGate } from "../../contexts/host-registration/application/native-host-registration-gate.js";
import { RegisterPluginWithHost } from "../../contexts/host-registration/application/register-plugin-with-host.js";
import { userConfigDir } from "../../shared/infrastructure/user-config-dir.js";
import { wireAddMarketplace } from "../distribution.js";
import type { Base } from "./base.js";
import type { Installation } from "./installation.js";

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
  const buildMarketplaceForTool = new BuildMarketplaceForTool(
    ensureBuiltMarketplaceUseCase,
    logger
  );
  const marketplaceSyncSettingsUseCase = new MarketplaceSyncSettingsUseCase(
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
    new SharedFrameworkSource(fs, logger, userSourceReferences, currentVersionProvider)
  );
  const setupMarketplaceSourceUseCase = new SetupMarketplaceSourceUseCase(
    prompter,
    releaseResolver
  );
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
  return {
    marketplaceRemoveUseCase,
    userMarketplaceRemoveUseCase,
    addMarketplace,
    marketplaceCheckUseCase,
    marketplaceSyncSettingsUseCase,
    setupMarketplaceSourceUseCase,
    setupMarketplaceRegistration,
  };
}

export type Marketplace = ReturnType<typeof wireMarketplace>;
