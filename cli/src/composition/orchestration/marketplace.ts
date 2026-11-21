import { PrepareMarketplace } from "../../contexts/distribution/application/add/prepare-marketplace.js";
import { RecordMarketplace } from "../../contexts/distribution/application/add/record-marketplace.js";
import { CheckMarketplaces } from "../../contexts/distribution/application/check-marketplaces.js";
import { EnsureFrameworkMarketplace } from "../../contexts/distribution/application/ensure-framework-marketplace.js";
import { ListFrameworkReleases } from "../../contexts/distribution/application/list-framework-releases.js";
import { PinNewestFrameworkSource } from "../../contexts/distribution/application/pin-newest-framework-source.js";
import { FindMarketplaceToRemove } from "../../contexts/distribution/application/remove/find-marketplace-to-remove.js";
import { FindUserMarketplace } from "../../contexts/distribution/application/remove/find-user-marketplace.js";
import { RemoveMarketplace } from "../../contexts/distribution/application/remove/remove-marketplace.js";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../contexts/distribution/contract/marketplace.js";
import { NativeHostRegistrationGate } from "../../contexts/host-registration/application/native-host-registration-gate.js";
import { RegisterPluginWithHost } from "../../contexts/host-registration/application/register/register-plugin-with-host.js";
import { ListPluginSources } from "../../contexts/installation/application/marketplace/list-plugin-sources.js";
import { PurgeMarketplacePlugins } from "../../contexts/installation/application/marketplace/purge-marketplace-plugins.js";
import { RemovePluginsFromMarketplace } from "../../contexts/installation/application/marketplace/remove-plugins-from-marketplace.js";
import { RemoveProjectPlugin } from "../../contexts/installation/application/removal/remove-project-plugin.js";
import { UserScopePluginFiles } from "../../contexts/installation/application/removal/user-scope-plugin-files.js";
import { BuildMarketplaceForTool } from "../../contexts/installation/application/sync/build-marketplace-for-tool.js";
import { LoadSyncContext } from "../../contexts/installation/application/sync/load-sync-context.js";
import { RecordActivation } from "../../contexts/installation/application/sync/record-activation.js";
import { SyncToolSettingsFiles } from "../../contexts/installation/application/sync/sync-tool-settings-files.js";
import { TrackedSettingsFile } from "../../contexts/installation/application/sync/tracked-settings-file.js";
import { PurgeDeclaredCache } from "../../contexts/machine-claims/application/purge-declared-cache.js";
import { RecordSourceReference } from "../../contexts/machine-claims/application/record-source-reference.js";
import { removalClaims } from "../../contexts/machine-claims/application/removal-claims.js";
import { SharedFrameworkSource } from "../../contexts/machine-claims/application/shared-source/shared-framework-source.js";
import { userScopeFilesSafeToDelete } from "../../contexts/machine-claims/application/user-scope-plugin-files.js";
import { AddMarketplace } from "../../orchestration/marketplace/add-marketplace.js";
import { CheckMarketplaceUpstream } from "../../orchestration/marketplace/check-marketplace-upstream.js";
import { RemoveProjectMarketplace } from "../../orchestration/marketplace/remove-project-marketplace.js";
import { RemoveRegisteredMarketplace } from "../../orchestration/marketplace/remove-registered-marketplace.js";
import { RemoveUserMarketplace } from "../../orchestration/marketplace/remove-user-marketplace.js";
import { AskMarketplaceSource } from "../../orchestration/setup/ask-marketplace-source.js";
import { RegisterMarketplace } from "../../orchestration/setup/register-marketplace.js";
import { ResolveSetupSource } from "../../orchestration/setup/resolve-setup-source.js";
import type { RegisterFrameworkSource } from "../../orchestration/setup/setup-flow.js";
import { ActivateNativeTools } from "../../orchestration/sync/activate-native-tools.js";
import { SyncNativeActivation } from "../../orchestration/sync/sync-native-activation.js";
import { SyncSettings } from "../../orchestration/sync/sync-settings.js";
import { resolveHomeDir } from "../../shared/infrastructure/home-dir.js";
import { userConfigDir } from "../../shared/infrastructure/user-config-dir.js";
import type { Installation } from "../installation.js";
import type { Base } from "../shared.js";

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

/** Removing a marketplace and its plugins, from a project or from the machine. */
function wireMarketplaceRemoval(base: Base, inst: Installation) {
  const { tools, fs, prompter, manifestRepo, userManifestRepo, marketplaceRegistry } = base;
  const { registrationRecordRules } = inst;
  const nativeHostRegistrationGate = new NativeHostRegistrationGate(
    base.nativePluginActivators,
    base.hostPluginRegistries,
    base.nativeSources
  );
  const projectCleanup = new RemoveProjectPlugin(fs, removalClaims(userManifestRepo, fs));
  const marketplaceRemoveUseCase = new RemoveProjectMarketplace(
    new FindMarketplaceToRemove(marketplaceRegistry),
    new RemovePluginsFromMarketplace(manifestRepo, projectCleanup, registrationRecordRules, tools),
    new RemoveMarketplace(marketplaceRegistry),
    detachClaimsOf(projectCleanup),
    prompter
  );
  const userMarketplaceRemoveUseCase = new RemoveUserMarketplace(
    new FindUserMarketplace(marketplaceRegistry),
    new PurgeMarketplacePlugins(
      userManifestRepo,
      nativeHostRegistrationGate,
      new UserScopePluginFiles(fs, quietUserScopeFilesSafeToDelete(fs)),
      registrationRecordRules,
      tools
    ),
    new RemoveMarketplace(marketplaceRegistry),
    resolveHomeDir()
  );
  return { marketplaceRemoveUseCase, userMarketplaceRemoveUseCase };
}

/** Registering the built marketplace's plugins with the hosts that load them natively. */
function nativeActivationOf(
  base: Base,
  inst: Installation,
  build: BuildMarketplaceForTool
): ActivateNativeTools {
  const { tools, fs, logger } = base;
  return new ActivateNativeTools(
    new RegisterPluginWithHost(
      fs,
      base.nativePluginActivators,
      {
        marketplaceRegistries: base.hostMarketplaceRegistries,
        pluginRegistries: base.hostPluginRegistries,
        sources: base.nativeSources,
      },
      process.platform,
      tools
    ),
    build,
    logger,
    { name: FRAMEWORK_MARKETPLACE_NAME, userCacheRoot: userConfigDir },
    inst.registrationRecordRules
  );
}

/** Syncing a project's settings and native activation against its marketplaces. */
function wireMarketplaceSync(base: Base, inst: Installation) {
  const { tools, fs, logger, currentVersionProvider, manifestRepo, userManifestRepo } = base;
  const { marketplaceRegistry, registerFrameworkMarketplace } = base;
  const { ensureBuiltMarketplaceUseCase, registrationRecordRules } = inst;
  const buildMarketplaceForTool = new BuildMarketplaceForTool(
    ensureBuiltMarketplaceUseCase,
    logger,
    tools
  );
  const recordSourceReference = new RecordSourceReference(
    fs,
    currentVersionProvider,
    logger,
    FRAMEWORK_MARKETPLACE_NAME,
    base.userSourceReferences
  );
  const syncSettingsUseCase = new SyncSettings(
    new LoadSyncContext(
      manifestRepo,
      marketplaceRegistry,
      FRAMEWORK_MARKETPLACE_NAME,
      registerFrameworkMarketplace,
      userManifestRepo
    ),
    new SyncToolSettingsFiles(
      new TrackedSettingsFile(fs, logger),
      buildMarketplaceForTool,
      registrationRecordRules,
      tools
    ),
    nativeActivationOf(base, inst, buildMarketplaceForTool),
    new RecordActivation(fs, registrationRecordRules, tools, userManifestRepo),
    new SharedFrameworkSource(
      fs,
      logger,
      recordSourceReference,
      new PurgeDeclaredCache(fs, logger),
      FRAMEWORK_MARKETPLACE_NAME
    )
  );
  return {
    recordSourceReference,
    syncSettingsUseCase,
    syncNativeActivation: new SyncNativeActivation(syncSettingsUseCase),
  };
}

/** Marketplace removal, check and sync, and the setup steps that register a marketplace. */
export function wireMarketplace(base: Base, inst: Installation) {
  const { tools, environment, tokenProvider, prompter, manifestRepo, marketplaceRegistry } = base;
  const { marketplaceTrustStore, releaseResolver, resolveMarketplaceUseCase } = base;
  const { listMarketplaces, refreshMarketplace, registerFrameworkMarketplace } = base;
  const removal = wireMarketplaceRemoval(base, inst);
  const { recordSourceReference, ...sync } = wireMarketplaceSync(base, inst);
  const addMarketplace = new AddMarketplace(
    new RemoveRegisteredMarketplace(
      listMarketplaces,
      removal.marketplaceRemoveUseCase,
      removal.userMarketplaceRemoveUseCase
    ),
    new PrepareMarketplace(marketplaceRegistry, marketplaceTrustStore, resolveMarketplaceUseCase),
    new RecordMarketplace(marketplaceRegistry, marketplaceTrustStore),
    prompter
  );
  const marketplaceCheckUseCase = new CheckMarketplaceUpstream(
    new CheckMarketplaces(marketplaceRegistry, resolveMarketplaceUseCase),
    new ListPluginSources(manifestRepo, tools)
  );
  const listFrameworkReleases = new ListFrameworkReleases(releaseResolver);
  const askMarketplaceSource = new AskMarketplaceSource(
    prompter,
    listFrameworkReleases,
    new PinNewestFrameworkSource(listFrameworkReleases)
  );
  const registerMarketplace = new RegisterMarketplace(
    new EnsureFrameworkMarketplace(registerFrameworkMarketplace, tokenProvider, releaseResolver),
    recordSourceReference,
    refreshMarketplace,
    environment
  );
  return {
    ...removal,
    ...sync,
    addMarketplace,
    marketplaceCheckUseCase,
    askMarketplaceSource,
    resolveSetupSource: new ResolveSetupSource(askedFrom(askMarketplaceSource)),
    registerSetupSource: registerForFlow(registerMarketplace),
  };
}

export type Marketplace = ReturnType<typeof wireMarketplace>;
