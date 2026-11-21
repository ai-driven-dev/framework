import { registrationRecordRules } from "../../../src/composition/installation.js";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../../src/contexts/distribution/contract/marketplace.js";
import {
  RegisterPluginWithHost,
  type RegisterPluginWithHostDeps,
} from "../../../src/contexts/host-registration/application/register/register-plugin-with-host.js";
import { BuildMarketplaceForTool } from "../../../src/contexts/installation/application/sync/build-marketplace-for-tool.js";
import {
  LoadSyncContext,
  type LoadSyncContextDeps,
} from "../../../src/contexts/installation/application/sync/load-sync-context.js";
import { RecordActivation } from "../../../src/contexts/installation/application/sync/record-activation.js";
import { SyncToolSettingsFiles } from "../../../src/contexts/installation/application/sync/sync-tool-settings-files.js";
import { PurgeDeclaredCache } from "../../../src/contexts/machine-claims/application/purge-declared-cache.js";
import {
  RecordSourceReference,
  type RecordSourceReferenceDeps,
} from "../../../src/contexts/machine-claims/application/record-source-reference.js";
import {
  SharedFrameworkSource,
  type SharedFrameworkSourceDeps,
} from "../../../src/contexts/machine-claims/application/shared-source/shared-framework-source.js";
import {
  ActivateNativeTools,
  type ActivationMarketplace,
} from "../../../src/orchestration/sync/activate-native-tools.js";
import { SyncSettings } from "../../../src/orchestration/sync/sync-settings.js";
import { FakeCurrentVersion } from "./fake-current-version.fake.js";
import { registeredTools } from "./registered-tools.builder.js";

type Deps = RegisterPluginWithHostDeps;
type Loader = LoadSyncContextDeps;

/** What a test names; the host maps and every optional collaborator default to empty or absent. */
export interface MarketplaceSyncParts {
  fs: SharedFrameworkSourceDeps["fs"];
  manifestRepo: Loader["manifestRepo"];
  marketplaceRegistry: Loader["marketplaceRegistry"];
  logger: SharedFrameworkSourceDeps["logger"];
  ensureBuilt: ConstructorParameters<typeof BuildMarketplaceForTool>[0];
  userCacheRoot?: ActivationMarketplace["userCacheRoot"];
  marketplaceRegisterFrameworkUseCase?: Loader["marketplaceRegisterFrameworkUseCase"];
  userSourceReferences?: RecordSourceReferenceDeps["userSourceReferences"];
  currentVersionProvider?: RecordSourceReferenceDeps["currentVersionProvider"];
  userManifestRepo?: Loader["userManifestRepo"];
  activators?: Deps["activators"];
  hostMarketplaceRegistries?: Deps["hosts"]["marketplaceRegistries"];
  hostPluginRegistries?: Deps["hosts"]["pluginRegistries"];
  nativeSources?: Deps["hosts"]["sources"];
}

export function marketplaceSync(parts: MarketplaceSyncParts): SyncSettings {
  const build = new BuildMarketplaceForTool(parts.ensureBuilt, parts.logger, registeredTools());
  return new SyncSettings(
    new LoadSyncContext({
      manifestRepo: parts.manifestRepo,
      marketplaceRegistry: parts.marketplaceRegistry,
      frameworkMarketplaceName: FRAMEWORK_MARKETPLACE_NAME,
      marketplaceRegisterFrameworkUseCase: parts.marketplaceRegisterFrameworkUseCase,
      userManifestRepo: parts.userManifestRepo,
    }),
    new SyncToolSettingsFiles(
      {
        fs: parts.fs,
        logger: parts.logger,
        buildMarketplace: build,
        records: registrationRecordRules,
      },
      registeredTools()
    ),
    new ActivateNativeTools(
      new RegisterPluginWithHost(
        {
          fs: parts.fs,
          activators: parts.activators ?? new Map(),
          hosts: {
            marketplaceRegistries: parts.hostMarketplaceRegistries ?? new Map(),
            pluginRegistries: parts.hostPluginRegistries ?? new Map(),
            sources: parts.nativeSources ?? new Map(),
          },
          platform: process.platform,
        },
        registeredTools()
      ),
      build,
      parts.logger,
      { name: FRAMEWORK_MARKETPLACE_NAME, userCacheRoot: parts.userCacheRoot ?? (() => "") },
      registrationRecordRules
    ),
    new RecordActivation(
      { fs: parts.fs, records: registrationRecordRules, userManifestRepo: parts.userManifestRepo },
      registeredTools()
    ),
    new SharedFrameworkSource({
      fs: parts.fs,
      logger: parts.logger,
      recordReference: new RecordSourceReference({
        fs: parts.fs,
        currentVersionProvider: parts.currentVersionProvider ?? new FakeCurrentVersion(),
        logger: parts.logger,
        frameworkMarketplaceName: FRAMEWORK_MARKETPLACE_NAME,
        userSourceReferences: parts.userSourceReferences,
      }),
      purgeCache: new PurgeDeclaredCache(parts.fs, parts.logger),
      frameworkMarketplaceName: FRAMEWORK_MARKETPLACE_NAME,
    })
  );
}
