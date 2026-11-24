import { ListMarketplaces } from "../../contexts/distribution/application/list-marketplaces.use-case.js";
import { RemoveMarketplace } from "../../contexts/distribution/application/remove/remove-marketplace.use-case.js";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../contexts/distribution/contract/marketplace.js";
import { AssertProjectRemovable } from "../../contexts/installation/application/clean/assert-project-removable.use-case.js";
import {
  CleanProjectFiles,
  type ProjectCleanAsks,
} from "../../contexts/installation/application/clean/clean-project-files.use-case.js";
import { InspectUserScopeFiles } from "../../contexts/installation/application/clean/inspect-user-scope-files.use-case.js";
import { PlanProjectClean } from "../../contexts/installation/application/clean/plan-project-clean.use-case.js";
import { ProveUserScopeWithdrawals } from "../../contexts/installation/application/clean/prove-user-scope-withdrawals.use-case.js";
import { PurgeUserScopeFiles } from "../../contexts/installation/application/clean/purge-user-scope-files.js";
import { PurgeUserScopeMachine } from "../../contexts/installation/application/clean/purge-user-scope-machine.use-case.js";
import { DeleteTrackedProjectFiles } from "../../contexts/installation/application/removal/project/delete-tracked-project-files.use-case.js";
import { RemoveAiddTraces } from "../../contexts/installation/application/removal/project/remove-aidd-traces.use-case.js";
import { RemoveMachineLocalFiles } from "../../contexts/installation/application/removal/project/remove-machine-local-files.use-case.js";
import { RemoveProjectFiles } from "../../contexts/installation/application/removal/project/remove-project-files.use-case.js";
import { RemoveToolFiles } from "../../contexts/installation/application/removal/project/remove-tool-files.use-case.js";
import type { MachineStateGuards } from "../../contexts/installation/application/removal/purge-machine-state.js";
import { PurgeMachineState } from "../../contexts/installation/application/removal/purge-machine-state.js";
import { UserScopePluginFiles } from "../../contexts/installation/application/removal/user-scope-plugin-files.js";
import { UninstallTools } from "../../contexts/installation/application/uninstall-tools.use-case.js";
import { detachProjectClaims } from "../../contexts/machine-claims/application/removal/detach-project-claims.js";
import { ResolvePurgeCandidate } from "../../contexts/machine-claims/application/resolve-purge-candidate.use-case.js";
import {
  type CleanClaims,
  claimReleaseOf,
  projectCleanFactsOf,
} from "../../orchestration/clean/clean-claims.js";
import { CleanProject } from "../../orchestration/clean/clean-project.use-case.js";
import { CleanUserScope } from "../../orchestration/clean/clean-user-scope.use-case.js";
import { ConfirmRemoval } from "../../orchestration/clean/confirm-removal.use-case.js";
import { InspectUserScope } from "../../orchestration/clean/inspect-user-scope.use-case.js";
import { PreviewProjectClean } from "../../orchestration/clean/preview-project-clean.use-case.js";
import { RemoveProjectInOrder } from "../../orchestration/clean/remove-project-in-order.use-case.js";
import { RemoveUserScope } from "../../orchestration/clean/remove-user-scope.use-case.js";
import { UninstallProjectTools } from "../../orchestration/clean/uninstall-project-tools.use-case.js";
import { type Installation, recordsOf } from "../contexts/installation.js";
import { machineOwnership, userScopeFilesSafeToDelete } from "../contexts/machine-claims.js";
import type { Base } from "../shared.js";
import { userConfigDir } from "../user-config-dir.js";
import { wireCleanClaims } from "./clean-claims.js";

/** The machine-scope half of a clean: the user-scope files, the machine state and the host. */
function wireCleanUserScope(
  base: Base,
  wired: { purgeCache: ResolvePurgeCandidate; claims: CleanClaims }
) {
  const { purgeCache, claims } = wired;
  const { fs, logger, prompter, userManifestRepo, marketplaceRegistry, withdrawFromHost, tools } =
    base;
  const guards: MachineStateGuards = {
    userConfigDir,
    resolveCacheCandidate: (cacheRoot, segments, label) =>
      purgeCache.execute(cacheRoot, segments, label),
    frameworkMarketplaceName: FRAMEWORK_MARKETPLACE_NAME,
  };
  const userScopeParts = {
    userManifestRepo,
    claims: recordsOf(userManifestRepo),
    purgeMachineState: new PurgeMachineState({ fs, logger, guards }),
    homeDir: base.homedir,
    userScopePluginFiles: new UserScopePluginFiles(fs, (plugin, tool, home) =>
      userScopeFilesSafeToDelete({ fs, logger, home }, plugin, tool)
    ),
  };
  const purgeUserScopeFiles = new PurgeUserScopeFiles({
    userManifestRepo,
    inspection: new InspectUserScopeFiles(userScopeParts, tools),
    withdrawals: new ProveUserScopeWithdrawals(userScopeParts, tools),
    machinePurge: new PurgeUserScopeMachine(userScopeParts, tools),
  });
  return new CleanUserScope({
    purgeFiles: purgeUserScopeFiles,
    inspect: new InspectUserScope({ purgeFiles: purgeUserScopeFiles, claims, logger }),
    confirm: new ConfirmRemoval(prompter),
    remove: new RemoveUserScope({
      purgeFiles: purgeUserScopeFiles,
      withdrawFromHost,
      removeMarketplace: new RemoveMarketplace(marketplaceRegistry),
      claims,
    }),
  });
}

/** What a project's removals ask of the machine, answered once for a clean and for a marketplace
 * removal alike. */
export function wireCleanMachine(base: Base) {
  const { fs, logger, userManifestRepo } = base;
  const purgeCache = new ResolvePurgeCandidate(fs, logger);
  const claims = wireCleanClaims({
    fs,
    logger,
    userManifestRepo,
    userSourceReferences: base.userSourceReferences,
    purgeCache,
  });
  return { purgeCache, claims };
}

/** The plan of what a project's tools registered and installed, as every project removal reads it. */
export function wireProjectCleanPlan(base: Base, inst: Installation) {
  const asks: ProjectCleanAsks = {
    homeDir: base.homedir,
    assertMcpRemovable: (plugin, tool, projectRoot) =>
      inst.projectIntegration.assertMcpRemovable.execute({ plugin, tool, projectRoot }),
  };
  return {
    asks,
    plan: new PlanProjectClean({ manifestRepo: base.manifestRepo, asks }, base.tools),
  };
}

/** What a project clean removes: its files, with the records the registrations left. */
function wireCleanProjectFiles(base: Base, inst: Installation) {
  const { fs, logger, manifestRepo, tools } = base;
  const { updateGitignore, projectIntegration } = inst;
  const { asks, plan } = wireProjectCleanPlan(base, inst);
  return new CleanProjectFiles({
    assertProjectRemovable: new AssertProjectRemovable(
      {
        assertHooksRemovable: projectIntegration.assertHooksRemovable,
        manifestRepo,
        assertMcpRemovable: asks.assertMcpRemovable,
      },
      tools
    ),
    planProjectClean: plan,
    removeProjectFiles: new RemoveProjectFiles({
      manifestRepo,
      trackedFiles: new DeleteTrackedProjectFiles({ fs, logger, homedir: base.homedir }, tools),
      machineLocalFiles: new RemoveMachineLocalFiles(fs, tools, projectIntegration.removeHooks),
      aiddTraces: new RemoveAiddTraces({ fs, manifestRepo, logger, updateGitignore }, tools),
    }),
  });
}

/** The project clean: what it would remove, the confirmation, and the ordered removal. */
function wireCleanProject(base: Base, inst: Installation, claims: CleanClaims) {
  const cleanProject = wireCleanProjectFiles(base, inst);
  const marketplaces = new ListMarketplaces(base.marketplaceRegistry);
  return new CleanProject({
    preview: new PreviewProjectClean({
      cleanProject,
      claims,
      marketplaces,
      records: recordsOf(base.manifestRepo),
    }),
    confirm: new ConfirmRemoval(base.prompter),
    remove: new RemoveProjectInOrder({
      cleanProject,
      withdrawFromHost: base.withdrawFromHost,
      cleanFacts: projectCleanFactsOf(claims, marketplaces),
      sharedClaim: claims.sharedClaim,
      release: claimReleaseOf(claims),
    }),
  });
}

/** Clean and uninstall. */
export function wireClean(base: Base, inst: Installation) {
  const { fs, logger, manifestRepo, userManifestRepo, tools } = base;
  const ownership = machineOwnership(userManifestRepo, fs);
  const uninstallTools = new UninstallProjectTools(
    new UninstallTools(
      {
        manifestRepo,
        detachClaims: detachProjectClaims(
          ownership.detachNativePluginRefs,
          ownership.detachUserPlugin
        ),
        removeToolFiles: new RemoveToolFiles(fs, logger, tools, base.homedir),
      },
      tools
    ),
    recordsOf(manifestRepo)
  );
  const { purgeCache, claims } = wireCleanMachine(base);
  const cleanProject = wireCleanProject(base, inst, claims);
  const cleanUserScope = wireCleanUserScope(base, { purgeCache, claims });
  return { uninstallTools, cleanProject, cleanUserScope };
}
