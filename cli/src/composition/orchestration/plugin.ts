import { join } from "node:path";
import { ResolvePluginSource } from "../../contexts/distribution/application/plugin-source/resolve-plugin-source.use-case.js";
import { SearchPlugins } from "../../contexts/distribution/application/plugin-source/search-plugins.use-case.js";
import { TrustPluginSource } from "../../contexts/distribution/application/plugin-source/trust-plugin-source.use-case.js";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../contexts/distribution/contract/marketplace.js";
import { RefreshHostPlugin } from "../../contexts/host-registration/application/refresh-host-plugin.use-case.js";
import type { WithdrawFromHost } from "../../contexts/host-registration/application/withdraw/withdraw-from-host.use-case.js";
import type { ProvenHostRef } from "../../contexts/host-registration/application/withdraw/withdrawal.js";
import { ReplacePluginFiles } from "../../contexts/installation/application/materialize/replace-plugin-files.use-case.js";
import { PlacePlugin } from "../../contexts/installation/application/plugin/add/place-plugin.use-case.js";
import { ResolveAddedPluginSource } from "../../contexts/installation/application/plugin/add/resolve-added-plugin-source.use-case.js";
import { AddPlugin } from "../../contexts/installation/application/plugin/add-plugin.use-case.js";
import { PlanPluginInstall } from "../../contexts/installation/application/plugin/plan-plugin-install.use-case.js";
import { PluginMaterializer } from "../../contexts/installation/application/plugin/plugin-materializer.js";
import { UpdatePlugin } from "../../contexts/installation/application/plugin/update-plugin.use-case.js";
import { UpdateUserPluginFiles } from "../../contexts/installation/application/plugin/update-user-plugin-files.use-case.js";
import type { ClaimedRefWithdrawal } from "../../contexts/installation/application/removal/project-plugin-withdrawal.js";
import { RemovePlugin as RemoveProjectPluginFiles } from "../../contexts/installation/application/removal/remove-plugin.use-case.js";
import {
  RemoveUserPlugin,
  type RemoveUserPluginRequest,
} from "../../contexts/installation/application/removal/remove-user-plugin.use-case.js";
import { UserScopePluginFiles } from "../../contexts/installation/application/removal/user-scope-plugin-files.js";
import type {
  BoundPluginMaterializer,
  UserPluginMaterialization,
  UserScopeFileGuard,
} from "../../contexts/installation/ports/plugin/user-plugin-materialization.js";
import { userScopeOwnership } from "../../contexts/machine-claims/application/ownership/user-scope-ownership.js";
import {
  assertUserScopeWriteBoundary,
  userScopeFilesSafeToDelete,
  withoutMissingFiles,
} from "../../contexts/machine-claims/application/ownership/user-scope-plugin-files.js";
import { PurgeDeclaredCache } from "../../contexts/machine-claims/application/purge-declared-cache.js";
import { pluginRemovalClaims } from "../../contexts/machine-claims/application/removal/plugin-removal-claims.js";
import { isStrictlyWithinUserScope } from "../../contexts/machine-claims/domain/user-scope-containment.js";
import { ConfirmPluginSourceTrust } from "../../orchestration/plugin/confirm-plugin-source-trust.use-case.js";
import { InstallFromMarketplace } from "../../orchestration/plugin/install-from-marketplace.use-case.js";
import { InstallPlugin } from "../../orchestration/plugin/install-plugin.use-case.js";
import { PickPlugins } from "../../orchestration/plugin/pick-plugins.use-case.js";
import { RemoveMachinePlugin } from "../../orchestration/plugin/remove-machine-plugin.use-case.js";
import { RemovePlugin } from "../../orchestration/plugin/remove-plugin.use-case.js";
import { UpdateUserPlugin } from "../../orchestration/plugin/update-user-plugin.use-case.js";
import { resolveHomeDir } from "../../shared/infrastructure/home-dir.js";
import type { Installation } from "../installation.js";
import type { Base } from "../shared.js";
import { userConfigDir } from "../user-config-dir.js";

/** Where a fetched plugin distribution is kept between runs. */
export function pluginCacheDir(): string {
  return join(userConfigDir(), "cache", "plugin-cache");
}

/** The materializer with the machine-scope containment rule bound, and no rebuild unless asked. */
export function withinUserScope(
  materializer: Pick<UserPluginMaterialization, "planUpdate" | "applyUpdate">
): BoundPluginMaterializer {
  return {
    planUpdate: ({ rebuild = false, ...request }) =>
      materializer.planUpdate({
        ...request,
        rebuild,
        isWithinUserScope: isStrictlyWithinUserScope,
      }),
    applyUpdate: (plan, logger) =>
      materializer.applyUpdate(plan, { logger, isWithinUserScope: isStrictlyWithinUserScope }),
  };
}

/** Resolves a cache path a removal may delete, through the purge that owns the rule. */
export function purgeCandidateResolverOf(purge: Pick<PurgeDeclaredCache, "resolveCandidate">) {
  return (...args: Parameters<PurgeDeclaredCache["resolveCandidate"]>) =>
    purge.resolveCandidate(...args);
}

// One writer for a machine-scope plugin's files, whether setup installs it or update rebuilds it.
export const userScopeFileGuard: UserScopeFileGuard = {
  safeToDelete: userScopeFilesSafeToDelete,
  withoutMissing: withoutMissingFiles,
  assertWriteBoundary: assertUserScopeWriteBoundary,
};

/** The host's two steps a user-scope removal takes: prove a claimed ref removable, then withdraw it. */
export function claimedRefWithdrawal(
  withdrawFromHost: WithdrawFromHost
): ClaimedRefWithdrawal<ProvenHostRef> {
  return {
    proveClaimedRef: (registrationData, claim, projectRoot) =>
      withdrawFromHost.execute({ kind: "prove-claimed-ref", registrationData, claim, projectRoot }),
    uninstallProven: (proven) => withdrawFromHost.execute({ kind: "withdraw-proven-ref", proven }),
  };
}

/** A user-scope removal under the machine's home directory, which the command line does not know. */
export function underMachineHome(removal: Pick<RemoveMachinePlugin, "execute">) {
  return {
    execute: (options: Omit<RemoveUserPluginRequest, "home" | "records">) =>
      removal.execute({ ...options, home: resolveHomeDir() }),
  };
}

/** Removing a plugin from the machine, under its home directory. */
function wireUserPluginRemoval(base: Base, inst: Installation) {
  const { tools, fs, logger, userManifestRepo, withdrawFromHost } = base;
  const removal = new RemoveUserPlugin(
    {
      userRepo: userManifestRepo,
      withdrawFromHost: claimedRefWithdrawal(withdrawFromHost),
      userScopePluginFiles: new UserScopePluginFiles(fs, (plugin, tool, home) =>
        userScopeFilesSafeToDelete({ fs, logger, home }, plugin, tool)
      ),
    },
    tools
  );
  return underMachineHome(new RemoveMachinePlugin(removal, inst.registrationRecordRules));
}

/** Removing a plugin from a project or from the machine, and the claims it leaves behind. */
function wirePluginRemoval(base: Base, inst: Installation) {
  const { tools, fs, logger, manifestRepo, userManifestRepo, withdrawFromHost } = base;
  const { registrationRecordRules } = inst;
  const removalClaims = pluginRemovalClaims({
    repo: userManifestRepo,
    fs,
    logger,
    home: resolveHomeDir(),
    platform: process.platform,
    frameworkMarketplaceName: FRAMEWORK_MARKETPLACE_NAME,
    userSourceReferences: base.userSourceReferences,
    marketplaceRegistry: base.marketplaceRegistry,
    resolveCacheCandidate: purgeCandidateResolverOf(new PurgeDeclaredCache(fs, logger)),
  });
  const pluginRemoveUseCase = new RemovePlugin({
    remove: new RemoveProjectPluginFiles(
      {
        fs,
        projectRepo: manifestRepo,
        homedir: inst.builtMaterializationDeps.homedir,
      },
      tools
    ),
    withdrawFromHost,
    claims: removalClaims,
    records: registrationRecordRules,
  });
  const userPluginRemove = wireUserPluginRemoval(base, inst);
  return { pluginRemoveUseCase, userPluginRemove };
}

/** Writing a plugin's files under the machine's user scope, from the build it was fetched into. */
function pluginMaterializerOf(base: Base, inst: Installation) {
  return new PluginMaterializer({
    fs: base.fs,
    loadDistribution: base.loadDistribution,
    guard: userScopeFileGuard,
    builtDeps: inst.builtMaterializationDeps,
    globalCacheDir: pluginCacheDir,
  });
}

/** Updating a plugin in a project or on the machine. */
function wirePluginUpdate(base: Base, inst: Installation) {
  const { tools, fs, logger, manifestRepo, userManifestRepo } = base;
  const { installRuntimeConfigUseCase, builtMaterializationDeps, registrationRecordRules } = inst;
  const pluginMaterializer = pluginMaterializerOf(base, inst);
  const pluginUpdateUseCase = new UpdatePlugin(
    {
      manifestRepo,
      loadDistribution: base.loadDistribution,
      replacePluginFiles: new ReplacePluginFiles(fs, builtMaterializationDeps, tools),
      pluginRuntime: installRuntimeConfigUseCase,
    },
    tools
  );
  const userPluginUpdateUseCase = new UpdateUserPlugin(
    new UpdateUserPluginFiles(
      {
        repo: userManifestRepo,
        materializer: pluginMaterializer,
        logger,
      },
      tools
    ),
    new RefreshHostPlugin(
      base.nativePluginActivators,
      base.hostPluginRegistries,
      base.nativeSources
    ),
    isStrictlyWithinUserScope,
    registrationRecordRules
  );
  return {
    pluginUpdateUseCase,
    userPluginUpdateUseCase,
    userPluginFileUpdater: withinUserScope(pluginMaterializer),
  };
}

/** Adding a plugin to a project or to the machine, resolving its source and placing its files. */
function pluginAddOf(base: Base, inst: Installation) {
  const { tools, fs, logger, manifestRepo, userManifestRepo } = base;
  const { installRuntimeConfigUseCase, builtMaterializationDeps } = inst;
  return new AddPlugin(
    {
      fs,
      ownership: userScopeOwnership(fs),
      manifests: { project: manifestRepo, user: userManifestRepo },
      source: new ResolveAddedPluginSource(
        {
          loadDistribution: base.loadDistribution,
          fs,
          built: builtMaterializationDeps,
        },
        tools
      ),
      place: new PlacePlugin(
        { fs, logger, built: builtMaterializationDeps, pluginRuntime: installRuntimeConfigUseCase },
        tools
      ),
    },
    tools
  );
}

/** The plugin lifecycle: add, install, update and remove. */
export function wirePlugin(base: Base, inst: Installation) {
  const { tools, logger, prompter, manifestRepo, marketplaceRegistry } = base;
  const { listMarketplaces, marketplaceTrustStore, resolveMarketplaceUseCase } = base;
  const pluginAddUseCase = pluginAddOf(base, inst);
  const pluginInstallFromMarketplaceUseCase = new InstallFromMarketplace({
    resolvePluginSource: new ResolvePluginSource(marketplaceRegistry, resolveMarketplaceUseCase),
    addPlugin: pluginAddUseCase,
    prompter,
    logger,
  });
  const pickPlugins = new PickPlugins({
    listMarketplaces,
    resolveMarketplace: resolveMarketplaceUseCase,
    pluginAddUseCase,
    prompter,
  });
  const pluginInstallUseCase = new InstallPlugin({
    planPluginInstall: new PlanPluginInstall(manifestRepo, tools),
    pickPlugin: pickPlugins,
    addPlugin: pluginAddUseCase,
    installFromMarketplace: pluginInstallFromMarketplaceUseCase,
    trustPluginSource: new ConfirmPluginSourceTrust(
      new TrustPluginSource(marketplaceTrustStore),
      prompter
    ),
  });
  return {
    ...wirePluginRemoval(base, inst),
    ...wirePluginUpdate(base, inst),
    pluginInstallUseCase,
    searchPlugins: new SearchPlugins(marketplaceRegistry, resolveMarketplaceUseCase),
    pluginInstallFromMarketplaceUseCase,
    pickPlugins,
  };
}

export type Plugin = ReturnType<typeof wirePlugin>;
