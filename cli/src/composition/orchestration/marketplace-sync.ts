import { FRAMEWORK_MARKETPLACE_NAME } from "../../contexts/distribution/contract/marketplace.js";
import { PlanRefsToEnable } from "../../contexts/host-registration/application/register/plan-refs-to-enable.use-case.js";
import { RecordNativeRegistrations } from "../../contexts/host-registration/application/register/record-native-registrations.use-case.js";
import { RegisterPluginWithHost } from "../../contexts/host-registration/application/register/register-plugin-with-host.use-case.js";
import { ResolveNativeHost } from "../../contexts/host-registration/application/register/resolve-native-host.use-case.js";
import { LoadSyncContext } from "../../contexts/installation/application/sync/load-sync-context.use-case.js";
import { RecordActivation } from "../../contexts/installation/application/sync/record-activation.use-case.js";
import { trackedSharedSettings } from "../../contexts/installation/application/sync/tracked-shared-settings.js";
import { Manifest } from "../../contexts/installation/domain/manifest.js";
import { RecordMachineClaims } from "../../contexts/machine-claims/application/record/record-machine-claims.use-case.js";
import { ResolvePurgeCandidate } from "../../contexts/machine-claims/application/resolve-purge-candidate.use-case.js";
import { RecordSourceReference } from "../../contexts/machine-claims/application/shared-source/record-source-reference.use-case.js";
import { ResolveReferenceRoot } from "../../contexts/machine-claims/application/shared-source/resolve-reference-root.use-case.js";
import { SharedFrameworkSource } from "../../contexts/machine-claims/application/shared-source/shared-framework-source.use-case.js";
import { ActivateNativeTools } from "../../orchestration/sync/settings/activate-native-tools.use-case.js";
import { BuildMarketplaceForTool } from "../../orchestration/sync/settings/build-marketplace-for-tool.use-case.js";
import type { ClaimsSource } from "../../orchestration/sync/settings/claims-view-of.js";
import { RecordSyncActivation } from "../../orchestration/sync/settings/record-sync-activation.use-case.js";
import { RunSettingsSync } from "../../orchestration/sync/settings/run-settings-sync.use-case.js";
import { SyncNativeActivation } from "../../orchestration/sync/settings/sync-native-activation.use-case.js";
import { SyncSettings } from "../../orchestration/sync/settings/sync-settings.use-case.js";
import { SyncToolSettingsFiles } from "../../orchestration/sync/settings/sync-tool-settings-files.use-case.js";
import { catalogReaders, settingsDeclaration } from "../host-registration.js";
import type { Installation } from "../installation.js";
import type { Base } from "../shared.js";
import { userConfigDir } from "../user-config-dir.js";

/** Registering the built marketplace's plugins with the hosts that load them natively. */
function nativeActivationOf(
  base: Base,
  inst: Installation,
  build: BuildMarketplaceForTool
): ActivateNativeTools {
  const { tools, fs, logger } = base;
  const { claimedRefs } = inst.registrationRecordRules;
  return new ActivateNativeTools({
    registerPluginWithHost: new RegisterPluginWithHost({
      fs,
      catalogs: catalogReaders(fs),
      nativeHosts: new ResolveNativeHost(base.nativePluginActivators, tools),
      hosts: {
        marketplaceRegistries: base.hostMarketplaceRegistries,
        pluginRegistries: base.hostPluginRegistries,
        sources: base.nativeSources,
      },
      platform: process.platform,
    }),
    buildMarketplace: build,
    logger,
    marketplace: { userCacheRoot: userConfigDir },
    planRefs: new PlanRefsToEnable({ frameworkName: FRAMEWORK_MARKETPLACE_NAME, claimedRefs }),
  });
}

interface SyncSources {
  buildMarketplaceForTool: BuildMarketplaceForTool;
  recordSourceReference: RecordSourceReference;
}

/** The shared settings files of every tool, synced against the project's marketplaces. */
function settingsFilesOf(
  base: Base,
  inst: Installation,
  buildMarketplace: BuildMarketplaceForTool
): SyncToolSettingsFiles {
  const tracked = trackedSharedSettings({ fs: base.fs, logger: base.logger });
  const refs = inst.registrationRecordRules;
  return new SyncToolSettingsFiles(
    { tracked, buildMarketplace, declaration: settingsDeclaration, refs },
    base.tools
  );
}

/** The settings sync of a project, held under the machine manifest's lock. */
function syncSettingsOf(base: Base, inst: Installation, sources: SyncSources): SyncSettings {
  return new SyncSettings(runSettingsSyncOf(base, inst, sources), base.userManifestRepo);
}

/** One settings sync: its context, its files, its native activation and its claims. */
/** The claims a sync checks host registrations against, read where machine claims keep them. */
function claimsSourceOf(base: Base, inst: Installation): ClaimsSource {
  const { manifestRepo, userManifestRepo } = base;
  return {
    claimedRefs: inst.registrationRecordRules.claimedRefs,
    machine: () => userManifestRepo.loadRecords(),
    persistedProject: () => manifestRepo.loadRecords(),
  };
}

function runSettingsSyncOf(base: Base, inst: Installation, sources: SyncSources): RunSettingsSync {
  const { tools, fs, logger, manifestRepo, userManifestRepo } = base;
  const { buildMarketplaceForTool, recordSourceReference } = sources;
  const { marketplaceRegistry, registerFrameworkMarketplace } = base;
  const { registrationRecordRules } = inst;
  return new RunSettingsSync({
    loadContext: new LoadSyncContext({
      manifestRepo,
      marketplaceRegistry,
      frameworkMarketplaceName: FRAMEWORK_MARKETPLACE_NAME,
      marketplaceRegisterFrameworkUseCase: registerFrameworkMarketplace,
      userManifestRepo,
    }),
    settingsFiles: settingsFilesOf(base, inst, buildMarketplaceForTool),
    activateNativeTools: nativeActivationOf(base, inst, buildMarketplaceForTool),
    recordActivation: new RecordSyncActivation({
      recordActivation: new RecordActivation({ fs }, tools),
      machineClaims: new RecordMachineClaims(
        {
          fs,
          userManifestRepo,
          emptyManifest: Manifest.create,
          mergeClaims: registrationRecordRules.mergeCatalogueClaims,
        },
        tools
      ),
      sharedSource: new SharedFrameworkSource({
        fs,
        logger,
        recordReference: recordSourceReference,
        purgeCache: new ResolvePurgeCandidate(fs, logger),
        frameworkMarketplaceName: FRAMEWORK_MARKETPLACE_NAME,
      }),
      recordRegistrations: new RecordNativeRegistrations(tools),
    }),
    claims: claimsSourceOf(base, inst),
  });
}

/** Syncing a project's settings and native activation against its marketplaces. */
export function wireMarketplaceSync(base: Base, inst: Installation) {
  const { tools, fs, logger, currentVersion } = base;
  const { ensureBuiltMarketplaceUseCase } = inst;
  const buildMarketplaceForTool = new BuildMarketplaceForTool(
    ensureBuiltMarketplaceUseCase,
    logger,
    tools
  );
  const recordSourceReference = new RecordSourceReference({
    resolveReferenceRoot: new ResolveReferenceRoot(fs),
    currentVersion,
    logger,
    frameworkMarketplaceName: FRAMEWORK_MARKETPLACE_NAME,
    userSourceReferences: base.userSourceReferences,
  });
  const syncSettingsUseCase = syncSettingsOf(base, inst, {
    buildMarketplaceForTool,
    recordSourceReference,
  });
  return {
    recordSourceReference,
    syncSettingsUseCase,
    syncNativeActivation: new SyncNativeActivation(syncSettingsUseCase),
  };
}
