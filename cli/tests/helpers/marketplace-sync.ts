import { MarketplaceSyncSettingsUseCase } from "../../src/contexts/framework/application/flows/marketplace-sync-settings-use-case.js";

type Constructed = ConstructorParameters<typeof MarketplaceSyncSettingsUseCase>;

/** What a test names; the host maps and every optional collaborator default to empty or absent. */
export interface MarketplaceSyncParts {
  fs: Constructed[0];
  manifestRepo: Constructed[1];
  marketplaceRegistry: Constructed[2];
  hasher: Constructed[3];
  logger: Constructed[4];
  ensureBuilt: Constructed[6];
  activators?: Constructed[5];
  hostMarketplaceRegistries?: Constructed[7];
  userCacheRoot?: Constructed[8];
  marketplaceRegisterFrameworkUseCase?: Constructed[9];
  userSourceReferences?: Constructed[10];
  currentVersionProvider?: Constructed[11];
  hostPluginRegistries?: Constructed[12];
  userManifestRepo?: Constructed[13];
  nativeSources?: Constructed[14];
}

export function marketplaceSync(parts: MarketplaceSyncParts): MarketplaceSyncSettingsUseCase {
  return new MarketplaceSyncSettingsUseCase(
    parts.fs,
    parts.manifestRepo,
    parts.marketplaceRegistry,
    parts.hasher,
    parts.logger,
    parts.activators ?? new Map(),
    parts.ensureBuilt,
    parts.hostMarketplaceRegistries,
    parts.userCacheRoot,
    parts.marketplaceRegisterFrameworkUseCase,
    parts.userSourceReferences,
    parts.currentVersionProvider,
    parts.hostPluginRegistries,
    parts.userManifestRepo,
    parts.nativeSources
  );
}
