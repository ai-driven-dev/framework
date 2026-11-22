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
import { NativeHostRegistrationGate } from "../../contexts/host-registration/application/native-host-registration-gate.js";
import { RegisterPluginWithHost } from "../../contexts/host-registration/application/register/register-plugin-with-host.use-case.js";
import { ListPluginSources } from "../../contexts/installation/application/marketplace/list-plugin-sources.use-case.js";
import { PurgeMarketplacePlugins } from "../../contexts/installation/application/marketplace/purge-marketplace-plugins.use-case.js";
import { RemovePluginsFromMarketplace } from "../../contexts/installation/application/marketplace/remove-plugins-from-marketplace.use-case.js";
import { RemoveProjectPlugin } from "../../contexts/installation/application/removal/remove-project-plugin.js";
import { UserScopePluginFiles } from "../../contexts/installation/application/removal/user-scope-plugin-files.js";
import { BuildMarketplaceForTool } from "../../contexts/installation/application/sync/build-marketplace-for-tool.use-case.js";
import { LoadSyncContext } from "../../contexts/installation/application/sync/load-sync-context.use-case.js";
import { RecordActivation } from "../../contexts/installation/application/sync/record-activation.use-case.js";
import { SyncToolSettingsFiles } from "../../contexts/installation/application/sync/sync-tool-settings-files.use-case.js";
import { PurgeDeclaredCache } from "../../contexts/machine-claims/application/purge-declared-cache.js";
import { RecordSourceReference } from "../../contexts/machine-claims/application/record-source-reference.use-case.js";
import { removalClaims } from "../../contexts/machine-claims/application/removal-claims.js";
import { SharedFrameworkSource } from "../../contexts/machine-claims/application/shared-source/shared-framework-source.use-case.js";
import { userScopeFilesSafeToDelete } from "../../contexts/machine-claims/application/user-scope-plugin-files.js";
import { AddMarketplace } from "../../orchestration/marketplace/add-marketplace.use-case.js";
import { CheckMarketplaceUpstream } from "../../orchestration/marketplace/check-marketplace-upstream.use-case.js";
import { RegisterMarketplace } from "../../orchestration/marketplace/register-marketplace.use-case.js";
import { RemoveProjectMarketplace } from "../../orchestration/marketplace/remove-project-marketplace.use-case.js";
import { RemoveRegisteredMarketplace } from "../../orchestration/marketplace/remove-registered-marketplace.use-case.js";
import { RemoveUserMarketplace } from "../../orchestration/marketplace/remove-user-marketplace.use-case.js";
import { AskMarketplaceSource } from "../../orchestration/setup/ask-marketplace-source.use-case.js";
import { ResolveSetupSource } from "../../orchestration/setup/resolve-setup-source.use-case.js";
import type { RegisterFrameworkSource } from "../../orchestration/setup/setup-flow.js";
import { ActivateNativeTools } from "../../orchestration/sync/activate-native-tools.use-case.js";
import { SyncNativeActivation } from "../../orchestration/sync/sync-native-activation.use-case.js";
import { SyncSettings } from "../../orchestration/sync/sync-settings.use-case.js";
import { resolveHomeDir } from "../../shared/infrastructure/home-dir.js";
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
  const nativeHostRegistrationGate = new NativeHostRegistrationGate(
    base.nativePluginActivators,
    base.hostPluginRegistries,
    base.nativeSources
  );
  return new RemoveUserMarketplace({
    find: new FindUserMarketplace(marketplaceRegistry),
    purge: new PurgeMarketplacePlugins(
      {
        repo: userManifestRepo,
        userScopePluginFiles: new UserScopePluginFiles(fs, quietUserScopeFilesSafeToDelete(fs)),
      },
      tools
    ),
    remove: new RemoveMarketplace(marketplaceRegistry),
    hostGate: nativeHostRegistrationGate,
    home: resolveHomeDir(),
    records: inst.registrationRecordRules,
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
    plugins: new RemovePluginsFromMarketplace({ manifestRepo, cleanup: projectCleanup }, tools),
    remove: new RemoveMarketplace(marketplaceRegistry),
    detachClaims: detachClaimsOf(projectCleanup),
    prompter,
    records: registrationRecordRules,
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
    registerPluginWithHost: new RegisterPluginWithHost(
      {
        fs,
        activators: base.nativePluginActivators,
        hosts: {
          marketplaceRegistries: base.hostMarketplaceRegistries,
          pluginRegistries: base.hostPluginRegistries,
          sources: base.nativeSources,
        },
        platform: process.platform,
      },
      tools
    ),
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

/** The settings sync of a project: its context, its files, its native activation and its claims. */
function syncSettingsOf(base: Base, inst: Installation, sources: SyncSources): SyncSettings {
  const { tools, fs, logger, manifestRepo, userManifestRepo } = base;
  const { buildMarketplaceForTool, recordSourceReference } = sources;
  const { marketplaceRegistry, registerFrameworkMarketplace } = base;
  const { registrationRecordRules } = inst;
  return new SyncSettings({
    loadContext: new LoadSyncContext({
      manifestRepo,
      marketplaceRegistry,
      frameworkMarketplaceName: FRAMEWORK_MARKETPLACE_NAME,
      marketplaceRegisterFrameworkUseCase: registerFrameworkMarketplace,
      userManifestRepo,
    }),
    settingsFiles: new SyncToolSettingsFiles(
      { fs, logger, buildMarketplace: buildMarketplaceForTool, records: registrationRecordRules },
      tools
    ),
    activateNativeTools: nativeActivationOf(base, inst, buildMarketplaceForTool),
    recordActivation: new RecordActivation(
      { fs, userManifestRepo, mergeClaims: registrationRecordRules.mergeCatalogueClaims },
      tools
    ),
    sharedSource: new SharedFrameworkSource({
      fs,
      logger,
      recordReference: recordSourceReference,
      purgeCache: new PurgeDeclaredCache(fs, logger),
      frameworkMarketplaceName: FRAMEWORK_MARKETPLACE_NAME,
    }),
    records: registrationRecordRules,
  });
}

/** Syncing a project's settings and native activation against its marketplaces. */
function wireMarketplaceSync(base: Base, inst: Installation) {
  const { tools, fs, logger, currentVersionProvider } = base;
  const { ensureBuiltMarketplaceUseCase } = inst;
  const buildMarketplaceForTool = new BuildMarketplaceForTool(
    ensureBuiltMarketplaceUseCase,
    logger,
    tools
  );
  const recordSourceReference = new RecordSourceReference({
    fs,
    currentVersionProvider,
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
    refresh: base.refreshMarketplace,
    environment,
  });
  return {
    askMarketplaceSource,
    resolveSetupSource: new ResolveSetupSource(askedFrom(askMarketplaceSource)),
    registerSetupSource: registerForFlow(registerMarketplace),
  };
}

/** Marketplace removal, check and sync, and the setup steps that register a marketplace. */
export function wireMarketplace(base: Base, inst: Installation) {
  const { tools, prompter, manifestRepo, marketplaceRegistry } = base;
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
  const marketplaceCheckUseCase = new CheckMarketplaceUpstream(
    new CheckMarketplaces(marketplaceRegistry, resolveMarketplaceUseCase),
    new ListPluginSources(manifestRepo, tools)
  );
  const setup = wireSetupSource(base, recordSourceReference);
  return {
    ...removal,
    ...sync,
    addMarketplace,
    marketplaceCheckUseCase,
    ...setup,
  };
}

export type Marketplace = ReturnType<typeof wireMarketplace>;
