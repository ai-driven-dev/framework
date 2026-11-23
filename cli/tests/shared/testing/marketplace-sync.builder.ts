import { settingsDeclaration } from "../../../src/composition/contexts/host-registration.js";
import { registrationRecordRules } from "../../../src/composition/contexts/installation.js";
import { lenientSourceReferences } from "../../../src/composition/contexts/machine-claims.js";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../../src/contexts/distribution/contract/marketplace.js";
import { hostPortsOver } from "../../../src/contexts/host-registration/application/host-ports-over.js";
import { PlanRefsToEnable } from "../../../src/contexts/host-registration/application/register/plan-refs-to-enable.use-case.js";
import { RecordNativeRegistrations } from "../../../src/contexts/host-registration/application/register/record-native-registrations.use-case.js";
import { RegisterPluginWithHost } from "../../../src/contexts/host-registration/application/register/register-plugin-with-host.use-case.js";
import { ResolveNativeHost } from "../../../src/contexts/host-registration/application/register/resolve-native-host.use-case.js";
import type { HostActions } from "../../../src/contexts/host-registration/ports/host-actions.js";
import type { HostPortMaps } from "../../../src/contexts/host-registration/ports/host-ports.js";
import {
  LoadSyncContext,
  type LoadSyncContextDeps,
  syncScopesOf,
} from "../../../src/contexts/installation/application/sync/load-sync-context.use-case.js";
import { RecordActivation } from "../../../src/contexts/installation/application/sync/record-activation.use-case.js";
import { trackedSharedSettings } from "../../../src/contexts/installation/application/sync/tracked-shared-settings.js";
import type { ScopeRecords } from "../../../src/contexts/installation/contract/records/scope-records.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import type { ManifestRepository } from "../../../src/contexts/installation/ports/manifest-repository.js";
import { RecordMachineClaims } from "../../../src/contexts/machine-claims/application/record/record-machine-claims.use-case.js";
import { ResolvePurgeCandidate } from "../../../src/contexts/machine-claims/application/resolve-purge-candidate.use-case.js";
import {
  RecordSourceReference,
  type RecordSourceReferenceDeps,
} from "../../../src/contexts/machine-claims/application/shared-source/record-source-reference.use-case.js";
import { ResolveReferenceRoot } from "../../../src/contexts/machine-claims/application/shared-source/resolve-reference-root.use-case.js";
import {
  SharedFrameworkSource,
  type SharedFrameworkSourceDeps,
} from "../../../src/contexts/machine-claims/application/shared-source/shared-framework-source.use-case.js";
import type { ToolCatalog } from "../../../src/contexts/tools/contract/tool-catalog.js";
import {
  ActivateNativeTools,
  type ActivationMarketplace,
} from "../../../src/orchestration/sync/settings/activate-native-tools.use-case.js";
import { BuildMarketplaceForTool } from "../../../src/orchestration/sync/settings/build-marketplace-for-tool.use-case.js";
import { RecordSyncActivation } from "../../../src/orchestration/sync/settings/record-sync-activation.use-case.js";
import { RunSettingsSync } from "../../../src/orchestration/sync/settings/run-settings-sync.use-case.js";
import { SyncSettings } from "../../../src/orchestration/sync/settings/sync-settings.use-case.js";
import { SyncToolSettingsFiles } from "../../../src/orchestration/sync/settings/sync-tool-settings-files.use-case.js";
import type { Lock } from "../../../src/shared/ports/lock.js";
import { catalogReadersOver } from "./catalog-readers.builder.js";

type Loader = LoadSyncContextDeps;

/** What a test names; the host maps and every optional collaborator default to empty or absent. */
export interface MarketplaceSyncParts {
  tools: ToolCatalog;
  fs: SharedFrameworkSourceDeps["fs"];
  manifestRepo: ManifestRepository & ScopeRecords;
  marketplaceRegistry: Loader["marketplaceRegistry"];
  logger: SharedFrameworkSourceDeps["logger"];
  ensureBuilt: ConstructorParameters<typeof BuildMarketplaceForTool>[0];
  userCacheRoot?: ActivationMarketplace["userCacheRoot"];
  marketplaceRegisterFrameworkUseCase?: Loader["marketplaceRegisterFrameworkUseCase"];
  userSourceReferences?: RecordSourceReferenceDeps["userSourceReferences"];
  currentVersion?: RecordSourceReferenceDeps["currentVersion"];
  userManifestRepo?: ManifestRepository & Lock & ScopeRecords;
  activators?: ReadonlyMap<string, HostActions>;
  hostMarketplaceRegistries?: HostPortMaps["marketplaceRegistries"];
  hostPluginRegistries?: HostPortMaps["pluginRegistries"];
  nativeSources?: HostPortMaps["sources"];
}

/** The claims a sync checks host registrations against, read from the repositories it runs on. */
function claimsSourceOver(project: ScopeRecords, machine: ScopeRecords | undefined) {
  return {
    claimedRefs: registrationRecordRules.claimedRefs,
    machine: machine === undefined ? undefined : () => machine.loadRecords(),
    persistedProject: () => project.loadRecords(),
  };
}

export function marketplaceSync(parts: MarketplaceSyncParts): SyncSettings {
  const build = new BuildMarketplaceForTool(parts.ensureBuilt, parts.logger, parts.tools);
  return new SyncSettings(
    new RunSettingsSync({
      loadContext: new LoadSyncContext({
        scopes: syncScopesOf(
          { manifestRepo: parts.manifestRepo, records: parts.manifestRepo },
          parts.userManifestRepo && {
            manifestRepo: parts.userManifestRepo,
            records: parts.userManifestRepo,
          }
        ),
        marketplaceRegistry: parts.marketplaceRegistry,
        frameworkMarketplaceName: FRAMEWORK_MARKETPLACE_NAME,
        marketplaceRegisterFrameworkUseCase: parts.marketplaceRegisterFrameworkUseCase,
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
        registerPluginWithHost: new RegisterPluginWithHost({
          fs: parts.fs,
          catalogs: catalogReadersOver(parts.fs),
          nativeHosts: new ResolveNativeHost(
            hostPortsOver({
              activators: parts.activators ?? new Map(),
              marketplaceRegistries: parts.hostMarketplaceRegistries ?? new Map(),
              pluginRegistries: parts.hostPluginRegistries ?? new Map(),
              sources: parts.nativeSources ?? new Map(),
            }),
            parts.tools
          ),
          platform: process.platform,
        }),
        buildMarketplace: build,
        logger: parts.logger,
        marketplace: { userCacheRoot: parts.userCacheRoot ?? (() => "") },
        planRefs: new PlanRefsToEnable({
          frameworkName: FRAMEWORK_MARKETPLACE_NAME,
          claimedRefs: registrationRecordRules.claimedRefs,
        }),
      }),
      recordActivation: new RecordSyncActivation({
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
            resolveReferenceRoot: new ResolveReferenceRoot(parts.fs),
            currentVersion: parts.currentVersion ?? "0.0.0-test",
            frameworkMarketplaceName: FRAMEWORK_MARKETPLACE_NAME,
            userSourceReferences: lenientSourceReferences(parts.userSourceReferences, parts.logger),
          }),
          purgeCache: new ResolvePurgeCandidate(parts.fs, parts.logger),
          frameworkMarketplaceName: FRAMEWORK_MARKETPLACE_NAME,
        }),
        recordRegistrations: new RecordNativeRegistrations(parts.tools),
      }),
      claims: claimsSourceOver(parts.manifestRepo, parts.userManifestRepo),
    }),
    parts.userManifestRepo
  );
}
