import { registrationRecordRules } from "../../../src/composition/installation.js";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../../src/contexts/distribution/contract/marketplace.js";
import { RegisterPluginWithHost } from "../../../src/contexts/host-registration/application/register/register-plugin-with-host.js";
import { BuildMarketplaceForTool } from "../../../src/contexts/installation/application/sync/build-marketplace-for-tool.js";
import { LoadSyncContext } from "../../../src/contexts/installation/application/sync/load-sync-context.js";
import { RecordActivation } from "../../../src/contexts/installation/application/sync/record-activation.js";
import { SyncToolSettingsFiles } from "../../../src/contexts/installation/application/sync/sync-tool-settings-files.js";
import { TrackedSettingsFile } from "../../../src/contexts/installation/application/sync/tracked-settings-file.js";
import { PurgeDeclaredCache } from "../../../src/contexts/machine-claims/application/purge-declared-cache.js";
import { RecordSourceReference } from "../../../src/contexts/machine-claims/application/record-source-reference.js";
import { SharedFrameworkSource } from "../../../src/contexts/machine-claims/application/shared-source/shared-framework-source.js";
import {
  ActivateNativeTools,
  type ActivationMarketplace,
} from "../../../src/orchestration/sync/activate-native-tools.js";
import { SyncSettings } from "../../../src/orchestration/sync/sync-settings.js";
import { FakeCurrentVersion } from "./fake-current-version.fake.js";
import { registeredTools } from "./registered-tools.builder.js";

type Hosts = ConstructorParameters<typeof RegisterPluginWithHost>;
type Loader = ConstructorParameters<typeof LoadSyncContext>;

/** What a test names; the host maps and every optional collaborator default to empty or absent. */
export interface MarketplaceSyncParts {
  fs: ConstructorParameters<typeof SharedFrameworkSource>[0];
  manifestRepo: Loader[0];
  marketplaceRegistry: Loader[1];
  logger: ConstructorParameters<typeof SharedFrameworkSource>[1];
  ensureBuilt: ConstructorParameters<typeof BuildMarketplaceForTool>[0];
  userCacheRoot?: ActivationMarketplace["userCacheRoot"];
  marketplaceRegisterFrameworkUseCase?: Loader[3];
  userSourceReferences?: ConstructorParameters<typeof RecordSourceReference>[4];
  currentVersionProvider?: ConstructorParameters<typeof RecordSourceReference>[1];
  userManifestRepo?: Loader[4];
  activators?: Hosts[1];
  hostMarketplaceRegistries?: Hosts[2]["marketplaceRegistries"];
  hostPluginRegistries?: Hosts[2]["pluginRegistries"];
  nativeSources?: Hosts[2]["sources"];
}

export function marketplaceSync(parts: MarketplaceSyncParts): SyncSettings {
  const build = new BuildMarketplaceForTool(parts.ensureBuilt, parts.logger, registeredTools());
  return new SyncSettings(
    new LoadSyncContext(
      parts.manifestRepo,
      parts.marketplaceRegistry,
      FRAMEWORK_MARKETPLACE_NAME,
      parts.marketplaceRegisterFrameworkUseCase,
      parts.userManifestRepo
    ),
    new SyncToolSettingsFiles(
      new TrackedSettingsFile(parts.fs, parts.logger),
      build,
      registrationRecordRules,
      registeredTools()
    ),
    new ActivateNativeTools(
      new RegisterPluginWithHost(
        parts.fs,
        parts.activators ?? new Map(),
        {
          marketplaceRegistries: parts.hostMarketplaceRegistries ?? new Map(),
          pluginRegistries: parts.hostPluginRegistries ?? new Map(),
          sources: parts.nativeSources ?? new Map(),
        },
        process.platform,
        registeredTools()
      ),
      build,
      parts.logger,
      { name: FRAMEWORK_MARKETPLACE_NAME, userCacheRoot: parts.userCacheRoot ?? (() => "") },
      registrationRecordRules
    ),
    new RecordActivation(
      parts.fs,
      registrationRecordRules,
      registeredTools(),
      parts.userManifestRepo
    ),
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
