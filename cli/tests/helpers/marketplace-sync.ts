import { MarketplaceSyncSettingsUseCase } from "../../src/contexts/framework/application/flows/marketplace-sync-settings-use-case.js";
import { RegisterPluginWithHost } from "../../src/contexts/host-registration/application/register-plugin-with-host.js";

type Constructed = ConstructorParameters<typeof MarketplaceSyncSettingsUseCase>;
type Hosts = ConstructorParameters<typeof RegisterPluginWithHost>;

/** What a test names; the host maps and every optional collaborator default to empty or absent. */
export interface MarketplaceSyncParts {
  fs: Constructed[0];
  manifestRepo: Constructed[1];
  marketplaceRegistry: Constructed[2];
  hasher: Constructed[3];
  logger: Constructed[4];
  ensureBuilt: Constructed[6];
  userCacheRoot?: Constructed[7];
  marketplaceRegisterFrameworkUseCase?: Constructed[8];
  userSourceReferences?: Constructed[9];
  currentVersionProvider?: Constructed[10];
  userManifestRepo?: Constructed[11];
  activators?: Hosts[1];
  hostMarketplaceRegistries?: Hosts[2];
  hostPluginRegistries?: Hosts[3];
  nativeSources?: Hosts[4];
}

export function marketplaceSync(parts: MarketplaceSyncParts): MarketplaceSyncSettingsUseCase {
  return new MarketplaceSyncSettingsUseCase(
    parts.fs,
    parts.manifestRepo,
    parts.marketplaceRegistry,
    parts.hasher,
    parts.logger,
    new RegisterPluginWithHost(
      parts.fs,
      parts.activators ?? new Map(),
      parts.hostMarketplaceRegistries ?? new Map(),
      parts.hostPluginRegistries ?? new Map(),
      parts.nativeSources ?? new Map()
    ),
    parts.ensureBuilt,
    parts.userCacheRoot,
    parts.marketplaceRegisterFrameworkUseCase,
    parts.userSourceReferences,
    parts.currentVersionProvider,
    parts.userManifestRepo
  );
}
