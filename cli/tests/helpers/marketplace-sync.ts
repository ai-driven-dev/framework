import { RegisterPluginWithHost } from "../../src/contexts/host-registration/application/register-plugin-with-host.js";
import { ActivateNativeTools } from "../../src/contexts/installation/application/sync/activate-native-tools.js";
import { BuildMarketplaceForTool } from "../../src/contexts/installation/application/sync/build-marketplace-for-tool.js";
import { LoadSyncContext } from "../../src/contexts/installation/application/sync/load-sync-context.js";
import { RecordActivation } from "../../src/contexts/installation/application/sync/record-activation.js";
import { SyncToolSettingsFiles } from "../../src/contexts/installation/application/sync/sync-tool-settings-files.js";
import { PurgeDeclaredCache } from "../../src/contexts/machine-claims/application/purge-declared-cache.js";
import { SharedFrameworkSource } from "../../src/contexts/machine-claims/application/shared-source/shared-framework-source.js";
import { SyncSettings } from "../../src/orchestration/sync/sync-settings.js";

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

export function marketplaceSync(parts: MarketplaceSyncParts): SyncSettings {
  const build = new BuildMarketplaceForTool(parts.ensureBuilt, parts.logger);
  return new SyncSettings(
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
      parts.currentVersionProvider,
      new PurgeDeclaredCache(parts.fs, parts.logger)
    )
  );
}
