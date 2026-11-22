import { settingsDeclaration } from "../../../src/composition/host-registration.js";
import { registrationRecordRules } from "../../../src/composition/installation.js";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../../src/contexts/distribution/contract/marketplace.js";
import {
  RegisterPluginWithHost,
  type RegisterPluginWithHostDeps,
} from "../../../src/contexts/host-registration/application/register/register-plugin-with-host.use-case.js";
import { catalogIdentityReader } from "../../../src/contexts/host-registration/infrastructure/marketplace-registry-reader.js";
import {
  LoadSyncContext,
  type LoadSyncContextDeps,
} from "../../../src/contexts/installation/application/sync/load-sync-context.use-case.js";
import { RecordActivation } from "../../../src/contexts/installation/application/sync/record-activation.use-case.js";
import { trackedSharedSettings } from "../../../src/contexts/installation/application/sync/tracked-shared-settings.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { PurgeDeclaredCache } from "../../../src/contexts/machine-claims/application/purge-declared-cache.js";
import { RecordMachineClaims } from "../../../src/contexts/machine-claims/application/record/record-machine-claims.use-case.js";
import {
  RecordSourceReference,
  type RecordSourceReferenceDeps,
} from "../../../src/contexts/machine-claims/application/record-source-reference.use-case.js";
import {
  SharedFrameworkSource,
  type SharedFrameworkSourceDeps,
} from "../../../src/contexts/machine-claims/application/shared-source/shared-framework-source.use-case.js";
import type { ToolCatalog } from "../../../src/contexts/tools/contract/tool-catalog.js";
import {
  ActivateNativeTools,
  type ActivationMarketplace,
} from "../../../src/orchestration/sync/activate-native-tools.use-case.js";
import { BuildMarketplaceForTool } from "../../../src/orchestration/sync/build-marketplace-for-tool.use-case.js";
import { SyncSettings } from "../../../src/orchestration/sync/sync-settings.use-case.js";
import { SyncToolSettingsFiles } from "../../../src/orchestration/sync/sync-tool-settings-files.use-case.js";

type Deps = RegisterPluginWithHostDeps;
type Loader = LoadSyncContextDeps;

/** What a test names; the host maps and every optional collaborator default to empty or absent. */
export interface MarketplaceSyncParts {
  tools: ToolCatalog;
  fs: SharedFrameworkSourceDeps["fs"];
  manifestRepo: Loader["manifestRepo"];
  marketplaceRegistry: Loader["marketplaceRegistry"];
  logger: SharedFrameworkSourceDeps["logger"];
  ensureBuilt: ConstructorParameters<typeof BuildMarketplaceForTool>[0];
  userCacheRoot?: ActivationMarketplace["userCacheRoot"];
  marketplaceRegisterFrameworkUseCase?: Loader["marketplaceRegisterFrameworkUseCase"];
  userSourceReferences?: RecordSourceReferenceDeps["userSourceReferences"];
  currentVersion?: RecordSourceReferenceDeps["currentVersion"];
  userManifestRepo?: Loader["userManifestRepo"];
  activators?: Deps["activators"];
  hostMarketplaceRegistries?: Deps["hosts"]["marketplaceRegistries"];
  hostPluginRegistries?: Deps["hosts"]["pluginRegistries"];
  nativeSources?: Deps["hosts"]["sources"];
}

export function marketplaceSync(parts: MarketplaceSyncParts): SyncSettings {
  const build = new BuildMarketplaceForTool(parts.ensureBuilt, parts.logger, parts.tools);
  return new SyncSettings({
    loadContext: new LoadSyncContext({
      manifestRepo: parts.manifestRepo,
      marketplaceRegistry: parts.marketplaceRegistry,
      frameworkMarketplaceName: FRAMEWORK_MARKETPLACE_NAME,
      marketplaceRegisterFrameworkUseCase: parts.marketplaceRegisterFrameworkUseCase,
      userManifestRepo: parts.userManifestRepo,
    }),
    settingsFiles: new SyncToolSettingsFiles(
      {
        tracked: trackedSharedSettings({ fs: parts.fs, logger: parts.logger }),
        buildMarketplace: build,
        declaration: settingsDeclaration,
        refs: registrationRecordRules,
      },
      parts.tools
    ),
    activateNativeTools: new ActivateNativeTools({
      registerPluginWithHost: new RegisterPluginWithHost(
        {
          fs: parts.fs,
          identities: catalogIdentityReader(parts.fs),
          activators: parts.activators ?? new Map(),
          hosts: {
            marketplaceRegistries: parts.hostMarketplaceRegistries ?? new Map(),
            pluginRegistries: parts.hostPluginRegistries ?? new Map(),
            sources: parts.nativeSources ?? new Map(),
          },
          platform: process.platform,
        },
        parts.tools
      ),
      buildMarketplace: build,
      logger: parts.logger,
      marketplace: {
        name: FRAMEWORK_MARKETPLACE_NAME,
        userCacheRoot: parts.userCacheRoot ?? (() => ""),
      },
      records: registrationRecordRules,
    }),
    recordActivation: new RecordActivation({ fs: parts.fs }, parts.tools),
    machineClaims: new RecordMachineClaims(
      {
        fs: parts.fs,
        userManifestRepo: parts.userManifestRepo,
        emptyManifest: Manifest.create,
        mergeClaims: registrationRecordRules.mergeCatalogueClaims,
      },
      parts.tools
    ),
    sharedSource: new SharedFrameworkSource({
      fs: parts.fs,
      logger: parts.logger,
      recordReference: new RecordSourceReference({
        fs: parts.fs,
        currentVersion: parts.currentVersion ?? "0.0.0-test",
        logger: parts.logger,
        frameworkMarketplaceName: FRAMEWORK_MARKETPLACE_NAME,
        userSourceReferences: parts.userSourceReferences,
      }),
      purgeCache: new PurgeDeclaredCache(parts.fs, parts.logger),
      frameworkMarketplaceName: FRAMEWORK_MARKETPLACE_NAME,
    }),
    records: registrationRecordRules,
  });
}
