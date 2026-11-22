import { PrepareMarketplace } from "../../contexts/distribution/application/add/prepare-marketplace.use-case.js";
import { RecordMarketplace } from "../../contexts/distribution/application/add/record-marketplace.use-case.js";
import { CheckMarketplaces } from "../../contexts/distribution/application/check-marketplaces.use-case.js";
import { EnsureFrameworkMarketplace } from "../../contexts/distribution/application/ensure-framework-marketplace.use-case.js";
import { ListFrameworkReleases } from "../../contexts/distribution/application/list-framework-releases.use-case.js";
import { PinNewestFrameworkSource } from "../../contexts/distribution/application/pin-newest-framework-source.use-case.js";
import { FindMarketplaceToRemove } from "../../contexts/distribution/application/remove/find-marketplace-to-remove.use-case.js";
import { FindUserMarketplace } from "../../contexts/distribution/application/remove/find-user-marketplace.use-case.js";
import { RemoveMarketplace } from "../../contexts/distribution/application/remove/remove-marketplace.use-case.js";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../contexts/distribution/contract/marketplace.js";
import { RegisterPluginWithHost } from "../../contexts/host-registration/application/register/register-plugin-with-host.use-case.js";
import { ResolveNativeHost } from "../../contexts/host-registration/application/register/resolve-native-host.use-case.js";
import { ListPluginSources } from "../../contexts/installation/application/marketplace/list-plugin-sources.use-case.js";
import { PurgeMarketplacePlugins } from "../../contexts/installation/application/marketplace/purge-marketplace-plugins.use-case.js";
import { RemovePluginsFromMarketplace } from "../../contexts/installation/application/marketplace/remove-plugins-from-marketplace.use-case.js";
import { RemoveProjectPlugin } from "../../contexts/installation/application/removal/remove-project-plugin.js";
import { UserScopePluginFiles } from "../../contexts/installation/application/removal/user-scope-plugin-files.js";
import { LoadSyncContext } from "../../contexts/installation/application/sync/load-sync-context.use-case.js";
import { RecordActivation } from "../../contexts/installation/application/sync/record-activation.use-case.js";
import { trackedSharedSettings } from "../../contexts/installation/application/sync/tracked-shared-settings.js";
import { Manifest } from "../../contexts/installation/domain/manifest.js";
import { userScopeFilesSafeToDelete } from "../../contexts/machine-claims/application/ownership/user-scope-plugin-files.js";
import { RecordMachineClaims } from "../../contexts/machine-claims/application/record/record-machine-claims.use-case.js";
import { removalClaims } from "../../contexts/machine-claims/application/removal/removal-claims.js";
import { ResolvePurgeCandidate } from "../../contexts/machine-claims/application/resolve-purge-candidate.use-case.js";
import { RecordSourceReference } from "../../contexts/machine-claims/application/shared-source/record-source-reference.use-case.js";
import { SharedFrameworkSource } from "../../contexts/machine-claims/application/shared-source/shared-framework-source.use-case.js";
import { AddMarketplace } from "../../orchestration/marketplace/add-marketplace.use-case.js";
import { CheckMarketplaceUpstream } from "../../orchestration/marketplace/check-marketplace-upstream.use-case.js";
import { ListMarketplaceCatalogs } from "../../orchestration/marketplace/list-marketplace-catalogs.use-case.js";
import { RefreshMarketplaces } from "../../orchestration/marketplace/refresh-marketplaces.use-case.js";
import { RegisterMarketplace } from "../../orchestration/marketplace/register-marketplace.use-case.js";
import { PurgeUserMarketplace } from "../../orchestration/marketplace/remove/purge-user-marketplace.use-case.js";
import { RemoveMarketplacePlugins } from "../../orchestration/marketplace/remove/remove-marketplace-plugins.use-case.js";
import { RemoveProjectMarketplace } from "../../orchestration/marketplace/remove/remove-project-marketplace.use-case.js";
import { RemoveRegisteredMarketplace } from "../../orchestration/marketplace/remove/remove-registered-marketplace.use-case.js";
import { RemoveUserMarketplace } from "../../orchestration/marketplace/remove/remove-user-marketplace.use-case.js";
import { AskMarketplaceSource } from "../../orchestration/setup/ask-marketplace-source.use-case.js";
import { ResolveSetupSource } from "../../orchestration/setup/resolve-setup-source.use-case.js";
import type { RegisterFrameworkSource } from "../../orchestration/setup/setup-flow.js";
import { ActivateNativeTools } from "../../orchestration/sync/settings/activate-native-tools.use-case.js";
import { BuildMarketplaceForTool } from "../../orchestration/sync/settings/build-marketplace-for-tool.use-case.js";
import { RecordSyncActivation } from "../../orchestration/sync/settings/record-sync-activation.use-case.js";
import { RunSettingsSync } from "../../orchestration/sync/settings/run-settings-sync.use-case.js";
import { SyncNativeActivation } from "../../orchestration/sync/settings/sync-native-activation.use-case.js";
import { SyncSettings } from "../../orchestration/sync/settings/sync-settings.use-case.js";
import { SyncToolSettingsFiles } from "../../orchestration/sync/settings/sync-tool-settings-files.use-case.js";
import { resolveHomeDir } from "../../shared/infrastructure/home-dir.js";
import { catalogReaders, settingsDeclaration } from "../host-registration.js";
import type { Installation } from "../installation.js";
import type { Base } from "../shared.js";
import { userConfigDir } from "../user-config-dir.js";

/** Detaches what a removal's plugins held on the machine, from the removal's own summary. */
export function detachClaimsOf(cleanup: Pick<RemoveProjectPlugin, "detachClaims">) {
  return (
    projectRoot: string,
    removed: {
      readonly nativeRefs: Parameters<RemoveProjectPlugin["detachClaims"]>[1];
      readonly plugins: Parameters<RemoveProjectPlugin["detachClaims"]>[2];
    }
  ) => cleanup.detachClaims(projectRoot, removed.nativeRefs, removed.plugins);
}

/** The question setup asks about which marketplace to register. */
export function askedFrom(ask: Pick<AskMarketplaceSource, "execute">) {
  return (options: Parameters<AskMarketplaceSource["execute"]>[0]) => ask.execute(options);
}

/** Removing a user-scope plugin's files asks which are safe to delete; nobody reads why one is
 * left in place, so the reason is not logged. */
export function quietUserScopeFilesSafeToDelete(
  fs: Parameters<typeof userScopeFilesSafeToDelete>[0]["fs"]
): (
  plugin: Parameters<typeof userScopeFilesSafeToDelete>[1],
  tool: Parameters<typeof userScopeFilesSafeToDelete>[2],
  home: string
) => ReturnType<typeof userScopeFilesSafeToDelete> {
  return (plugin, tool, home) =>
    userScopeFilesSafeToDelete(
      { fs, logger: { debug() {}, info() {}, warn() {} }, home },
      plugin,
      tool
    );
}

/** A setup flow registers its framework source for the scope the flow runs in. */
export function registerForFlow(
  register: Pick<RegisterMarketplace, "execute">
): RegisterFrameworkSource {
  return (flow, source) =>
    register.execute({ projectRoot: flow.projectRoot, scope: flow.scope, source });
}

/** Removing a marketplace from the machine: its user-scope plugins, files and host registrations. */
function wireUserMarketplaceRemoval(base: Base, inst: Installation) {
  const { tools, fs, userManifestRepo, marketplaceRegistry } = base;
  return new RemoveUserMarketplace({
    find: new FindUserMarketplace(marketplaceRegistry),
    purge: new PurgeUserMarketplace({
      purge: new PurgeMarketplacePlugins(
        {
          repo: userManifestRepo,
          userScopePluginFiles: new UserScopePluginFiles(fs, quietUserScopeFilesSafeToDelete(fs)),
        },
        tools
      ),
      host: base.withdrawFromHost,
      home: resolveHomeDir(),
      records: inst.registrationRecordRules,
    }),
    remove: new RemoveMarketplace(marketplaceRegistry),
  });
}

/** Removing a marketplace and its plugins, from a project or from the machine. */
function wireMarketplaceRemoval(base: Base, inst: Installation) {
  const { tools, fs, prompter, manifestRepo, userManifestRepo, marketplaceRegistry } = base;
  const { registrationRecordRules } = inst;
  const projectCleanup = new RemoveProjectPlugin(
    fs,
    inst.builtMaterializationDeps.homedir,
    removalClaims(userManifestRepo, fs)
  );
  const marketplaceRemoveUseCase = new RemoveProjectMarketplace({
    find: new FindMarketplaceToRemove(marketplaceRegistry),
    removePlugins: new RemoveMarketplacePlugins(
      new RemovePluginsFromMarketplace({ manifestRepo, cleanup: projectCleanup }, tools),
      prompter,
      registrationRecordRules
    ),
    remove: new RemoveMarketplace(marketplaceRegistry),
    detachClaims: detachClaimsOf(projectCleanup),
  });
  const userMarketplaceRemoveUseCase = wireUserMarketplaceRemoval(base, inst);
  return { marketplaceRemoveUseCase, userMarketplaceRemoveUseCase };
}

/** Registering the built marketplace's plugins with the hosts that load them natively. */
function nativeActivationOf(
  base: Base,
  inst: Installation,
  build: BuildMarketplaceForTool
): ActivateNativeTools {
  const { tools, fs, logger } = base;
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
    marketplace: { name: FRAMEWORK_MARKETPLACE_NAME, userCacheRoot: userConfigDir },
    records: inst.registrationRecordRules,
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
      records: registrationRecordRules,
    }),
    records: registrationRecordRules,
  });
}

/** Syncing a project's settings and native activation against its marketplaces. */
function wireMarketplaceSync(base: Base, inst: Installation) {
  const { tools, fs, logger, currentVersion } = base;
  const { ensureBuiltMarketplaceUseCase } = inst;
  const buildMarketplaceForTool = new BuildMarketplaceForTool(
    ensureBuiltMarketplaceUseCase,
    logger,
    tools
  );
  const recordSourceReference = new RecordSourceReference({
    fs,
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

/** Choosing the framework source of a setup, and registering it for the scope the flow runs in. */
function wireSetupSource(base: Base, recordSourceReference: RecordSourceReference) {
  const { prompter, tokenProvider, environment, releaseResolver } = base;
  const listFrameworkReleases = new ListFrameworkReleases(releaseResolver);
  const askMarketplaceSource = new AskMarketplaceSource(
    prompter,
    listFrameworkReleases,
    new PinNewestFrameworkSource(listFrameworkReleases)
  );
  const registerMarketplace = new RegisterMarketplace({
    ensure: new EnsureFrameworkMarketplace(
      base.registerFrameworkMarketplace,
      tokenProvider,
      releaseResolver
    ),
    recordReference: recordSourceReference,
    refresh: new RefreshMarketplaces(base.refreshMarketplaceUseCase),
    environment,
  });
  return {
    askMarketplaceSource,
    resolveSetupSource: new ResolveSetupSource(askedFrom(askMarketplaceSource)),
    registerSetupSource: registerForFlow(registerMarketplace),
  };
}

/** What a person reads of the registered marketplaces: the upstream check and the catalog list. */
function wireMarketplaceReads(base: Base) {
  const { tools, manifestRepo, marketplaceRegistry } = base;
  const { resolveMarketplaceUseCase, listMarketplaces } = base;
  const marketplaceCheckUseCase = new CheckMarketplaceUpstream(
    new CheckMarketplaces(marketplaceRegistry),
    resolveMarketplaceUseCase,
    new ListPluginSources(manifestRepo, tools)
  );
  const listMarketplaceCatalogs = new ListMarketplaceCatalogs(
    listMarketplaces,
    resolveMarketplaceUseCase,
    base.logger
  );
  const refreshMarketplace = new RefreshMarketplaces(base.refreshMarketplaceUseCase);
  return { marketplaceCheckUseCase, listMarketplaceCatalogs, refreshMarketplace };
}

/** Marketplace removal, check and sync, and the setup steps that register a marketplace. */
export function wireMarketplace(base: Base, inst: Installation) {
  const { prompter, marketplaceRegistry } = base;
  const { marketplaceTrustStore, resolveMarketplaceUseCase, listMarketplaces } = base;
  const removal = wireMarketplaceRemoval(base, inst);
  const { recordSourceReference, ...sync } = wireMarketplaceSync(base, inst);
  const addMarketplace = new AddMarketplace({
    removeRegistered: new RemoveRegisteredMarketplace(
      listMarketplaces,
      removal.marketplaceRemoveUseCase,
      removal.userMarketplaceRemoveUseCase
    ),
    prepare: new PrepareMarketplace(
      marketplaceRegistry,
      marketplaceTrustStore,
      resolveMarketplaceUseCase
    ),
    record: new RecordMarketplace(marketplaceRegistry, marketplaceTrustStore),
    prompter,
  });
  const reads = wireMarketplaceReads(base);
  const setup = wireSetupSource(base, recordSourceReference);
  return {
    ...removal,
    ...sync,
    addMarketplace,
    ...reads,
    ...setup,
  };
}

export type Marketplace = ReturnType<typeof wireMarketplace>;
