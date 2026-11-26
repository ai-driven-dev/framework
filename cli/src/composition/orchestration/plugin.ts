import { join } from "node:path";
import { ResolvePluginSource } from "../../contexts/distribution/application/plugin-source/resolve-plugin-source.use-case.js";
import { SearchPlugins } from "../../contexts/distribution/application/plugin-source/search-plugins.use-case.js";
import { TrustPluginSource } from "../../contexts/distribution/application/plugin-source/trust-plugin-source.use-case.js";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../contexts/distribution/contract/marketplace.js";
import { RefreshHostPlugin } from "../../contexts/host-registration/application/refresh-host-plugin.use-case.js";
import type { WithdrawFromHost } from "../../contexts/host-registration/application/withdraw/withdraw-from-host.use-case.js";
import type { ProvenHostRef } from "../../contexts/host-registration/application/withdraw/withdrawal.js";
import { EnsurePluginRuntimeFiles } from "../../contexts/installation/application/install/config/ensure-plugin-runtime-files.use-case.js";
import { ReplacePluginFiles } from "../../contexts/installation/application/materialize/replace-plugin-files.use-case.js";
import { ResolveAddedPluginSource } from "../../contexts/installation/application/plugin/add/resolve-added-plugin-source.use-case.js";
import { AddPlugin } from "../../contexts/installation/application/plugin/add-plugin.use-case.js";
import { AddPluginToProject } from "../../contexts/installation/application/plugin/add-plugin-to-project.use-case.js";
import { PlanPluginInstall } from "../../contexts/installation/application/plugin/plan-plugin-install.use-case.js";
import { supportedScopeOf } from "../../contexts/installation/application/plugin/plugin-target-resolution.js";
import { UpdatePlugin } from "../../contexts/installation/application/plugin/update-plugin.use-case.js";
import { UpdateProjectPlugins } from "../../contexts/installation/application/plugin/update-project-plugins.use-case.js";
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
} from "../../contexts/installation/ports/plugin/user-plugin-materialization.js";
import { ClaimUserPlugin } from "../../contexts/machine-claims/application/claim-user-plugin.use-case.js";
import { pluginRemovalClaims } from "../../contexts/machine-claims/application/removal/plugin-removal-claims.js";
import { ResolvePurgeCandidate } from "../../contexts/machine-claims/application/resolve-purge-candidate.use-case.js";
import { ConfirmPluginSourceTrust } from "../../orchestration/plugin/confirm-plugin-source-trust.use-case.js";
import { InstallFromMarketplace } from "../../orchestration/plugin/install-from-marketplace.use-case.js";
import { InstallPlugin } from "../../orchestration/plugin/install-plugin.use-case.js";
import { PickPlugins } from "../../orchestration/plugin/pick-plugins.use-case.js";
import { RemoveMachinePlugin } from "../../orchestration/plugin/remove-machine-plugin.use-case.js";
import { RemovePlugin } from "../../orchestration/plugin/remove-plugin.use-case.js";
import { UpdateUserPlugin } from "../../orchestration/plugin/update-user-plugin.use-case.js";
import { isStrictlyWithin } from "../../shared/domain/paths.model.js";
import { type Installation, recordsOf } from "../contexts/installation.js";
import {
  lenientSourceReferences,
  machineOwnership,
  sharedSourceReads,
  userScopeFileGuard,
  userScopeFilesSafeToDelete,
} from "../contexts/machine-claims.js";
import type { Base } from "../shared.js";
import { userConfigDir } from "../user-config-dir.js";
import { builtPlacementOf, placePluginOf, pluginMaterializerOf } from "./built-placement.js";

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
        isWithinUserScope: isStrictlyWithin,
      }),
    applyUpdate: (plan, logger) =>
      materializer.applyUpdate(plan, { logger, isWithinUserScope: isStrictlyWithin }),
  };
}

/** Resolves a cache path a removal may delete, through the purge that owns the rule. */
export function purgeCandidateResolverOf(purge: Pick<ResolvePurgeCandidate, "execute">) {
  return (...args: Parameters<ResolvePurgeCandidate["execute"]>) => purge.execute(...args);
}

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
export function underMachineHome(removal: Pick<RemoveMachinePlugin, "execute">, home: string) {
  return {
    execute: (options: Omit<RemoveUserPluginRequest, "home" | "records">) =>
      removal.execute({ ...options, home }),
  };
}

/** Removing a plugin from the machine, under its home directory. */
function wireUserPluginRemoval(base: Base) {
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
  return underMachineHome(
    new RemoveMachinePlugin(removal, recordsOf(userManifestRepo), base.removeServerPlugins),
    base.homedir()
  );
}

/** Removing a plugin from a project or from the machine, and the claims it leaves behind. */
function wirePluginRemoval(base: Base, inst: Installation) {
  const { tools, fs, logger, manifestRepo, userManifestRepo, withdrawFromHost } = base;
  const removalClaims = pluginRemovalClaims(
    {
      ...machineOwnership(userManifestRepo, fs),
      home: base.homedir(),
      resolveCacheCandidate: purgeCandidateResolverOf(new ResolvePurgeCandidate(fs, logger)),
    },
    {
      ...sharedSourceReads({
        fs,
        platform: process.platform,
        references: lenientSourceReferences(base.userSourceReferences, logger),
      }),
      frameworkMarketplaceName: FRAMEWORK_MARKETPLACE_NAME,
      marketplaceRegistry: base.marketplaceRegistry,
    }
  );
  const removePlugin = new RemovePlugin({
    remove: new RemoveProjectPluginFiles(
      {
        fs,
        projectRepo: manifestRepo,
        integration: {
          assert: inst.projectIntegration.assertIntegration,
          remove: inst.projectIntegration.removeIntegration,
        },
      },
      tools
    ),
    withdrawFromHost,
    claims: removalClaims,
    records: recordsOf(manifestRepo),
  });
  const userPluginRemove = wireUserPluginRemoval(base);
  return { removePlugin, userPluginRemove };
}

/** Writing a plugin's files under the machine's user scope, from the build it was fetched into. */
function machinePluginMaterializer(base: Base, inst: Installation) {
  return pluginMaterializerOf({
    fs: base.fs,
    loadDistribution: base.loadDistribution,
    guard: userScopeFileGuard,
    builtDeps: inst.builtMaterializationDeps,
    globalCacheDir: pluginCacheDir,
  });
}

/** Updating the plugins of a project, recorded in its manifest. */
function projectPluginUpdateOf(base: Base, inst: Installation) {
  const { tools, fs } = base;
  return new UpdateProjectPlugins(
    {
      manifestRepo: base.manifestRepo,
      loadDistribution: base.loadDistribution,
      replacePluginFiles: new ReplacePluginFiles(
        { fs, ...builtPlacementOf(fs, inst.builtMaterializationDeps) },
        tools
      ),
      pluginRuntime: new EnsurePluginRuntimeFiles({ fs, assets: inst.assetProvider }),
    },
    tools
  );
}

/** Updating a plugin in a project or on the machine. */
function wirePluginUpdate(base: Base, inst: Installation) {
  const { tools, logger, userManifestRepo } = base;
  const pluginMaterializer = machinePluginMaterializer(base, inst);
  const updatePlugin = new UpdatePlugin(
    {
      userManifest: userManifestRepo,
      updateProject: projectPluginUpdateOf(base, inst),
      materializer: pluginMaterializer,
      logger,
    },
    tools
  );
  const updateUserPlugin = new UpdateUserPlugin(
    updatePlugin,
    new RefreshHostPlugin(
      base.nativePluginActivators,
      base.hostPluginRegistries,
      base.nativeSources
    ),
    isStrictlyWithin,
    recordsOf(userManifestRepo),
    base.heldServerPlugins
  );
  return {
    updatePlugin,
    updateUserPlugin,
    userPluginFileUpdater: withinUserScope(pluginMaterializer),
  };
}

/** Adding a plugin to a project or to the machine, resolving its source and placing its files. */
function pluginAddOf(base: Base, inst: Installation) {
  const { tools, fs, logger, manifestRepo, userManifestRepo } = base;
  const { builtMaterializationDeps } = inst;
  return new AddPlugin(
    {
      ownership: new ClaimUserPlugin(fs, userManifestRepo),
      manifests: { project: manifestRepo, user: userManifestRepo },
      addToProject: new AddPluginToProject(
        {
          assertIntegration: inst.projectIntegration.assertIntegration,
          source: new ResolveAddedPluginSource({ loadDistribution: base.loadDistribution }, tools),
          place: placePluginOf(
            {
              fs,
              logger,
              built: builtMaterializationDeps,
              pluginRuntime: new EnsurePluginRuntimeFiles({ fs, assets: inst.assetProvider }),
            },
            tools
          ),
        },
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
  const installPlugin = new InstallPlugin({
    planPluginInstall: new PlanPluginInstall(manifestRepo, tools, supportedScopeOf(tools)),
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
    installPlugin,
    searchPlugins: new SearchPlugins(marketplaceRegistry, resolveMarketplaceUseCase),
    pluginInstallFromMarketplaceUseCase,
    pickPlugins,
  };
}

export type Plugin = ReturnType<typeof wirePlugin>;
