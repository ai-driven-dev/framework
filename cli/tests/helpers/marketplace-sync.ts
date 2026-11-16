import {
  ActivateNativeTools,
  BuildMarketplaceForTool,
  LoadSyncContext,
  MarketplaceSyncSettingsUseCase,
  RecordActivation,
  SharedFrameworkSource,
  SyncToolSettingsFiles,
} from "../../src/contexts/framework/application/flows/marketplace-sync-settings-use-case.js";
import { RegisterPluginWithHost } from "../../src/contexts/host-registration/application/register-plugin-with-host.js";

type Hosts = ConstructorParameters<typeof RegisterPluginWithHost>;
type Loader = ConstructorParameters<typeof LoadSyncContext>;
type Shared = ConstructorParameters<typeof SharedFrameworkSource>;

/** What a test names; the host maps and every optional collaborator default to empty or absent. */
export interface MarketplaceSyncParts {
  fs: Shared[0];
  manifestRepo: Loader[0];
  marketplaceRegistry: Loader[1];
  hasher: ConstructorParameters<typeof RecordActivation>[1];
  logger: Shared[1];
  ensureBuilt: ConstructorParameters<typeof BuildMarketplaceForTool>[0];
  userCacheRoot?: ConstructorParameters<typeof ActivateNativeTools>[3];
  marketplaceRegisterFrameworkUseCase?: Loader[2];
  userSourceReferences?: Shared[2];
  currentVersionProvider?: Shared[3];
  userManifestRepo?: Loader[3];
  activators?: Hosts[1];
  hostMarketplaceRegistries?: Hosts[2];
  hostPluginRegistries?: Hosts[3];
  nativeSources?: Hosts[4];
}

export function marketplaceSync(parts: MarketplaceSyncParts): MarketplaceSyncSettingsUseCase {
  const build = new BuildMarketplaceForTool(parts.ensureBuilt, parts.logger);
  return new MarketplaceSyncSettingsUseCase(
    new LoadSyncContext(
      parts.manifestRepo,
      parts.marketplaceRegistry,
      parts.marketplaceRegisterFrameworkUseCase,
      parts.userManifestRepo
    ),
    new SyncToolSettingsFiles(parts.fs, parts.hasher, parts.logger, build),
    new ActivateNativeTools(
      new RegisterPluginWithHost(
        parts.fs,
        parts.activators ?? new Map(),
        parts.hostMarketplaceRegistries ?? new Map(),
        parts.hostPluginRegistries ?? new Map(),
        parts.nativeSources ?? new Map()
      ),
      build,
      parts.logger,
      parts.userCacheRoot
    ),
    new RecordActivation(parts.fs, parts.hasher, parts.userManifestRepo),
    new SharedFrameworkSource(
      parts.fs,
      parts.logger,
      parts.userSourceReferences,
      parts.currentVersionProvider
    )
  );
}
