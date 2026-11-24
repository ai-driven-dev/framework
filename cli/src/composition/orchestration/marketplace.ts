import { PrepareMarketplace } from "../../contexts/distribution/application/add/prepare-marketplace.use-case.js";
import { RecordMarketplace } from "../../contexts/distribution/application/add/record-marketplace.use-case.js";
import { AssertMarketplaceReadable } from "../../contexts/distribution/application/assert-marketplace-readable.use-case.js";
import { CheckMarketplaces } from "../../contexts/distribution/application/check-marketplaces.use-case.js";
import { EnsureFrameworkMarketplace } from "../../contexts/distribution/application/ensure-framework-marketplace.use-case.js";
import { ListMarketplaceReleases } from "../../contexts/distribution/application/list-marketplace-releases.use-case.js";
import { ListMarketplaces } from "../../contexts/distribution/application/list-marketplaces.use-case.js";
import { PinNewestFrameworkSource } from "../../contexts/distribution/application/pin-newest-framework-source.use-case.js";
import { FindMarketplaceToRemove } from "../../contexts/distribution/application/remove/find-marketplace-to-remove.use-case.js";
import { FindUserMarketplace } from "../../contexts/distribution/application/remove/find-user-marketplace.use-case.js";
import { ForgetProjectMarketplace } from "../../contexts/distribution/application/remove/forget-project-marketplace.use-case.js";
import { RemoveMarketplace } from "../../contexts/distribution/application/remove/remove-marketplace.use-case.js";
import { ListPluginSources } from "../../contexts/installation/application/marketplace/list-plugin-sources.use-case.js";
import { PurgeMarketplacePlugins } from "../../contexts/installation/application/marketplace/purge-marketplace-plugins.use-case.js";
import { RemovePluginsFromMarketplace } from "../../contexts/installation/application/marketplace/remove-plugins-from-marketplace.use-case.js";
import { RemoveProjectPlugin } from "../../contexts/installation/application/removal/remove-project-plugin.js";
import { UserScopePluginFiles } from "../../contexts/installation/application/removal/user-scope-plugin-files.js";
import { removalClaims } from "../../contexts/machine-claims/application/removal/removal-claims.js";
import type { RecordSourceReference } from "../../contexts/machine-claims/application/shared-source/record-source-reference.use-case.js";
import { projectCleanFactsOf } from "../../orchestration/clean/clean-claims.js";
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
import { WithdrawProjectMarketplaceFromHost } from "../../orchestration/marketplace/remove/withdraw-project-marketplace-from-host.use-case.js";
import { AskMarketplaceSource } from "../../orchestration/setup/ask-marketplace-source.use-case.js";
import { ResolveSetupSource } from "../../orchestration/setup/resolve-setup-source.use-case.js";
import type { RegisterFrameworkSource } from "../../orchestration/setup/setup-flow.js";
import { type Installation, recordsOf } from "../contexts/installation.js";
import { machineOwnership, userScopeFilesSafeToDelete } from "../contexts/machine-claims.js";
import type { Base } from "../shared.js";
import { wireCleanMachine, wireProjectCleanPlan } from "./clean.js";
import { wireMarketplaceSync } from "./marketplace-sync.js";

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
function wireUserMarketplaceRemoval(base: Base) {
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
      home: base.homedir(),
      records: recordsOf(userManifestRepo),
    }),
    remove: new RemoveMarketplace(marketplaceRegistry),
  });
}

/** Withdrawing one project marketplace from the hosts that registered it, as a clean would. */
function wireProjectHostWithdrawal(base: Base, inst: Installation) {
  return new WithdrawProjectMarketplaceFromHost({
    plan: wireProjectCleanPlan(base, inst).plan,
    withdrawFromHost: base.withdrawFromHost,
    facts: projectCleanFactsOf(
      wireCleanMachine(base).claims,
      new ListMarketplaces(base.marketplaceRegistry)
    ),
    records: recordsOf(base.manifestRepo),
  });
}

/** Removing a marketplace and its plugins, from a project or from the machine. */
function wireMarketplaceRemoval(base: Base, inst: Installation) {
  const { tools, fs, prompter, manifestRepo, userManifestRepo, marketplaceRegistry } = base;
  const ownership = machineOwnership(userManifestRepo, fs);
  const projectCleanup = new RemoveProjectPlugin({
    fs,
    homedir: inst.builtMaterializationDeps.homedir,
    assertIntegration: inst.projectIntegration.assertIntegration,
    removeIntegration: inst.projectIntegration.removeIntegration,
    claims: removalClaims(ownership.detachNativePluginRefs, ownership.detachUserPlugin),
  });
  const removeProjectMarketplace = new RemoveProjectMarketplace({
    hosts: wireProjectHostWithdrawal(base, inst),
    find: new FindMarketplaceToRemove(marketplaceRegistry),
    removePlugins: new RemoveMarketplacePlugins(
      new RemovePluginsFromMarketplace({ manifestRepo, cleanup: projectCleanup }, tools),
      prompter,
      recordsOf(manifestRepo)
    ),
    forget: new ForgetProjectMarketplace(marketplaceRegistry, fs),
    detachClaims: detachClaimsOf(projectCleanup),
  });
  const removeUserMarketplace = wireUserMarketplaceRemoval(base);
  return { removeProjectMarketplace, removeUserMarketplace };
}

/** Choosing the framework source of a setup, and registering it for the scope the flow runs in. */
function wireSetupSource(base: Base, recordSourceReference: RecordSourceReference) {
  const { prompter, tokenProvider, environment, releaseResolver } = base;
  const listMarketplaceReleases = new ListMarketplaceReleases(releaseResolver);
  const askMarketplaceSource = new AskMarketplaceSource(
    prompter,
    listMarketplaceReleases,
    new PinNewestFrameworkSource(listMarketplaceReleases)
  );
  const registerMarketplace = new RegisterMarketplace({
    ensure: new EnsureFrameworkMarketplace(
      base.registerFrameworkMarketplace,
      new AssertMarketplaceReadable(tokenProvider, releaseResolver)
    ),
    recordReference: recordSourceReference,
    refresh: new RefreshMarketplaces(base.marketplacesToRefresh, base.refreshMarketplaceUseCase),
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
  const checkMarketplaceUpstream = new CheckMarketplaceUpstream(
    new CheckMarketplaces(marketplaceRegistry),
    resolveMarketplaceUseCase,
    new ListPluginSources(manifestRepo, tools)
  );
  const listMarketplaceCatalogs = new ListMarketplaceCatalogs(
    listMarketplaces,
    resolveMarketplaceUseCase,
    base.logger
  );
  const refreshMarketplace = new RefreshMarketplaces(
    base.marketplacesToRefresh,
    base.refreshMarketplaceUseCase
  );
  return { checkMarketplaceUpstream, listMarketplaceCatalogs, refreshMarketplace };
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
      removal.removeProjectMarketplace,
      removal.removeUserMarketplace
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
