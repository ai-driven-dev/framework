import { FRAMEWORK_MARKETPLACE_NAME } from "../../src/contexts/distribution/contract/marketplace.js";
import { RegisterPluginWithHost } from "../../src/contexts/host-registration/application/register-plugin-with-host.js";
import { ActivateNativeTools } from "../../src/contexts/installation/application/sync/activate-native-tools.js";
import { BuildMarketplaceForTool } from "../../src/contexts/installation/application/sync/build-marketplace-for-tool.js";
import { LoadSyncContext } from "../../src/contexts/installation/application/sync/load-sync-context.js";
import { RecordActivation } from "../../src/contexts/installation/application/sync/record-activation.js";
import { SyncToolSettingsFiles } from "../../src/contexts/installation/application/sync/sync-tool-settings-files.js";
import { PurgeDeclaredCache } from "../../src/contexts/machine-claims/application/purge-declared-cache.js";
import { RecordSourceReference } from "../../src/contexts/machine-claims/application/record-source-reference.js";
import { SharedFrameworkSource } from "../../src/contexts/machine-claims/application/shared-source/shared-framework-source.js";
import { SyncSettings } from "../../src/orchestration/sync/sync-settings.js";
import { FakeCurrentVersion } from "./ports/fake-current-version.js";

type Hosts = ConstructorParameters<typeof RegisterPluginWithHost>;
type Loader = ConstructorParameters<typeof LoadSyncContext>;

/** What a test names; the host maps and every optional collaborator default to empty or absent. */
export interface MarketplaceSyncParts {
  fs: ConstructorParameters<typeof SharedFrameworkSource>[0];
  manifestRepo: Loader[0];
  marketplaceRegistry: Loader[1];
  hasher: ConstructorParameters<typeof RecordActivation>[1];
  logger: ConstructorParameters<typeof SharedFrameworkSource>[1];
  ensureBuilt: ConstructorParameters<typeof BuildMarketplaceForTool>[0];
  userCacheRoot?: ConstructorParameters<typeof ActivateNativeTools>[4];
  marketplaceRegisterFrameworkUseCase?: Loader[3];
  userSourceReferences?: ConstructorParameters<typeof RecordSourceReference>[4];
  currentVersionProvider?: ConstructorParameters<typeof RecordSourceReference>[1];
  userManifestRepo?: Loader[4];
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
      FRAMEWORK_MARKETPLACE_NAME,
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
      FRAMEWORK_MARKETPLACE_NAME,
      parts.userCacheRoot
    ),
    new RecordActivation(parts.fs, parts.hasher, parts.userManifestRepo),
    new SharedFrameworkSource(
      parts.fs,
      parts.logger,
      new RecordSourceReference(
        parts.fs,
        parts.currentVersionProvider ?? new FakeCurrentVersion(),
        parts.logger,
        FRAMEWORK_MARKETPLACE_NAME,
        parts.userSourceReferences
      ),
      new PurgeDeclaredCache(parts.fs, parts.logger),
      FRAMEWORK_MARKETPLACE_NAME
    )
  );
}
