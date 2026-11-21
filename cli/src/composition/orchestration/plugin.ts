import { join } from "node:path";
import { ResolvePluginSource } from "../../contexts/distribution/application/plugin-source/resolve-plugin-source.js";
import { SearchPlugins } from "../../contexts/distribution/application/plugin-source/search-plugins.js";
import { TrustPluginSource } from "../../contexts/distribution/application/plugin-source/trust-plugin-source.js";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../contexts/distribution/contract/marketplace.js";
import { RefreshHostPlugin } from "../../contexts/host-registration/application/refresh-host-plugin.js";
import type { WithdrawFromHost } from "../../contexts/host-registration/application/withdraw/withdraw-from-host.js";
import type { ProvenHostRef } from "../../contexts/host-registration/application/withdraw/withdrawal.js";
import { ReplacePluginFiles } from "../../contexts/installation/application/materialize/replace-plugin-files.js";
import { PlacePlugin } from "../../contexts/installation/application/plugin/add/place-plugin.js";
import { ResolveAddedPluginSource } from "../../contexts/installation/application/plugin/add/resolve-added-plugin-source.js";
import { AddPlugin } from "../../contexts/installation/application/plugin/add-plugin.js";
import { PlanPluginInstall } from "../../contexts/installation/application/plugin/plan-plugin-install.js";
import { PluginDistributionLoader } from "../../contexts/installation/application/plugin/plugin-distribution-loader.js";
import { PluginMaterializer } from "../../contexts/installation/application/plugin/plugin-materializer.js";
import { UpdatePlugin } from "../../contexts/installation/application/plugin/update-plugin.js";
import { UpdateUserPluginFiles } from "../../contexts/installation/application/plugin/update-user-plugin-files.js";
import { ProjectPluginWithdrawal } from "../../contexts/installation/application/removal/project-plugin-withdrawal.js";
import { RemovePlugin } from "../../contexts/installation/application/removal/remove-plugin.js";
import {
  RemoveUserPlugin,
  type UserPluginRemoveOptions,
} from "../../contexts/installation/application/removal/remove-user-plugin.js";
import { UserScopePluginFiles } from "../../contexts/installation/application/removal/user-scope-plugin-files.js";
import type { HostWithdrawal } from "../../contexts/installation/ports/native-host.js";
import type {
  BoundPluginMaterializer,
  UserPluginMaterialization,
  UserScopeFileGuard,
} from "../../contexts/installation/ports/plugin/user-plugin-materialization.js";
import { pluginRemovalClaims } from "../../contexts/machine-claims/application/plugin-removal-claims.js";
import { PurgeDeclaredCache } from "../../contexts/machine-claims/application/purge-declared-cache.js";
import {
  assertUserScopeWriteBoundary,
  userScopeFilesSafeToDelete,
  withoutMissingFiles,
} from "../../contexts/machine-claims/application/user-scope-plugin-files.js";
import { isStrictlyWithinUserScope } from "../../contexts/machine-claims/domain/user-scope-containment.js";
import { ConfirmPluginSourceTrust } from "../../orchestration/plugin/confirm-plugin-source-trust.js";
import { InstallFromMarketplace } from "../../orchestration/plugin/install-from-marketplace.js";
import { InstallPlugin } from "../../orchestration/plugin/install-plugin.js";
import { PickPlugins } from "../../orchestration/plugin/pick-plugins.js";
import { UpdateUserPlugin } from "../../orchestration/plugin/update-user-plugin.js";
import { withdrawalClaimsOf } from "../../orchestration/plugin/withdrawal-claims.js";
import { resolveHomeDir } from "../../shared/infrastructure/home-dir.js";
import { userConfigDir } from "../../shared/infrastructure/user-config-dir.js";
import type { Installation } from "../installation.js";
import type { Base } from "../shared.js";

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
): Pick<HostWithdrawal<ProvenHostRef>, "proveClaimedRef" | "uninstallProven"> {
  return {
    proveClaimedRef: (registrationData, claim, projectRoot) =>
      withdrawFromHost.execute({ kind: "prove-claimed-ref", registrationData, claim, projectRoot }),
    uninstallProven: (proven) => withdrawFromHost.execute({ kind: "withdraw-proven-ref", proven }),
  };
}

/** The host withdrawal a project removal calls: the host's own, checked against the machine's
 * claims for the tool and project at hand. */
export function projectHostWithdrawal(
  withdrawFromHost: WithdrawFromHost,
  removalClaims: Parameters<typeof withdrawalClaimsOf>[0]
): HostWithdrawal<ProvenHostRef> {
  return {
    assertProjectSource: (command) =>
      withdrawFromHost.execute({ kind: "prove-project-source", ...command }),
    ...claimedRefWithdrawal(withdrawFromHost),
    execute: (command) =>
      withdrawFromHost.execute({
        kind: "withdraw-plugin",
        ...command,
        claims: withdrawalClaimsOf(removalClaims, {
          toolId: command.tool.toolId,
          tool: command.tool,
          projectRoot: command.projectRoot,
        }),
      }),
  };
}

/** A user-scope removal under the machine's home directory, which the command line does not know. */
export function underMachineHome(removal: Pick<RemoveUserPlugin<unknown>, "execute">) {
  return {
    execute: (options: Omit<UserPluginRemoveOptions, "home">) =>
      removal.execute({ ...options, home: resolveHomeDir() }),
  };
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
  const pluginRemoveUseCase = new RemovePlugin(
    {
      fs,
      projectRepo: manifestRepo,
      withdrawal: new ProjectPluginWithdrawal(
        projectHostWithdrawal(withdrawFromHost, removalClaims),
        removalClaims
      ),
      records: registrationRecordRules,
    },
    tools
  );
  const userPluginRemove = underMachineHome(
    new RemoveUserPlugin(
      {
        userRepo: userManifestRepo,
        withdrawFromHost: claimedRefWithdrawal(withdrawFromHost),
        records: registrationRecordRules,
        userScopePluginFiles: new UserScopePluginFiles(fs, (plugin, tool, home) =>
          userScopeFilesSafeToDelete({ fs, logger, home }, plugin, tool)
        ),
      },
      tools
    )
  );
  return { pluginRemoveUseCase, userPluginRemove };
}

/** Updating a plugin in a project or on the machine. */
function wirePluginUpdate(base: Base, inst: Installation) {
  const { tools, fs, logger, manifestRepo, userManifestRepo, pluginDistributionReader } = base;
  const { pluginFetcher } = base;
  const { installRuntimeConfigUseCase, builtMaterializationDeps, registrationRecordRules } = inst;
  const pluginMaterializer = new PluginMaterializer({
    fs,
    loader: new PluginDistributionLoader(pluginFetcher, pluginDistributionReader),
    guard: userScopeFileGuard,
    builtDeps: builtMaterializationDeps,
    globalCacheDir: pluginCacheDir,
  });
  const pluginUpdateUseCase = new UpdatePlugin(
    {
      manifestRepo,
      distributionLoader: new PluginDistributionLoader(pluginFetcher, pluginDistributionReader),
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
        records: registrationRecordRules,
      },
      tools
    ),
    new RefreshHostPlugin(
      base.nativePluginActivators,
      base.hostPluginRegistries,
      base.nativeSources
    ),
    isStrictlyWithinUserScope
  );
  return {
    pluginUpdateUseCase,
    userPluginUpdateUseCase,
    userPluginFileUpdater: withinUserScope(pluginMaterializer),
  };
}

/** The plugin lifecycle: add, install, update and remove. */
export function wirePlugin(base: Base, inst: Installation) {
  const { tools, fs, logger, prompter, manifestRepo, userManifestRepo } = base;
  const { pluginDistributionReader, pluginFetcher, marketplaceRegistry } = base;
  const { listMarketplaces, marketplaceTrustStore, resolveMarketplaceUseCase } = base;
  const { installRuntimeConfigUseCase, builtMaterializationDeps } = inst;
  const pluginAddUseCase = new AddPlugin(
    {
      fs,
      manifests: { project: manifestRepo, user: userManifestRepo },
      source: new ResolveAddedPluginSource(
        {
          distributionLoader: new PluginDistributionLoader(pluginFetcher, pluginDistributionReader),
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
