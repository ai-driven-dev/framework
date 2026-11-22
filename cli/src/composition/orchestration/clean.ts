import { homedir } from "node:os";
import { ListMarketplaces } from "../../contexts/distribution/application/list-marketplaces.use-case.js";
import { RemoveMarketplace } from "../../contexts/distribution/application/remove/remove-marketplace.use-case.js";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../contexts/distribution/contract/marketplace.js";
import {
  CleanProjectFiles,
  type ProjectCleanAsks,
} from "../../contexts/installation/application/clean-project-files.use-case.js";
import { PlanProjectClean } from "../../contexts/installation/application/plan-project-clean.use-case.js";
import { PurgeUserScopeFiles } from "../../contexts/installation/application/purge-user-scope-files.js";
import type { MachineStateGuards } from "../../contexts/installation/application/removal/purge-machine-state.js";
import { PurgeMachineState } from "../../contexts/installation/application/removal/purge-machine-state.js";
import { RemoveProjectFiles } from "../../contexts/installation/application/removal/remove-project-files.js";
import { assertProjectMcpEntriesRemovable } from "../../contexts/installation/application/removal/remove-project-plugin.js";
import { RemoveToolFiles } from "../../contexts/installation/application/removal/remove-tool-files.js";
import { UserScopePluginFiles } from "../../contexts/installation/application/removal/user-scope-plugin-files.js";
import { UninstallTools } from "../../contexts/installation/application/uninstall-tools.use-case.js";
import { userScopeFilesSafeToDelete } from "../../contexts/machine-claims/application/ownership/user-scope-plugin-files.js";
import { PurgeDeclaredCache } from "../../contexts/machine-claims/application/purge-declared-cache.js";
import { detachProjectClaims } from "../../contexts/machine-claims/application/removal/detach-project-claims.js";
import type { CleanClaims } from "../../orchestration/clean/clean-claims.js";
import { CleanProject } from "../../orchestration/clean/clean-project.use-case.js";
import { CleanUserScope } from "../../orchestration/clean/clean-user-scope.use-case.js";
import { ConfirmRemoval } from "../../orchestration/clean/confirm-removal.use-case.js";
import { InspectUserScope } from "../../orchestration/clean/inspect-user-scope.use-case.js";
import { PreviewProjectClean } from "../../orchestration/clean/preview-project-clean.use-case.js";
import { RemoveProjectInOrder } from "../../orchestration/clean/remove-project-in-order.use-case.js";
import { RemoveUserScope } from "../../orchestration/clean/remove-user-scope.use-case.js";
import { UninstallProjectTools } from "../../orchestration/clean/uninstall-project-tools.use-case.js";
import { resolveHomeDir } from "../../shared/infrastructure/home-dir.js";
import type { Installation } from "../installation.js";
import type { Base } from "../shared.js";
import { userConfigDir } from "../user-config-dir.js";
import { wireCleanClaims } from "./clean-claims.js";

/** The machine-scope half of a clean: the user-scope files, the machine state and the host. */
function wireCleanUserScope(
  base: Base,
  inst: Installation,
  wired: { purgeCache: PurgeDeclaredCache; claims: CleanClaims }
) {
  const { purgeCache, claims } = wired;
  const { fs, logger, prompter, userManifestRepo, marketplaceRegistry, withdrawFromHost, tools } =
    base;
  const guards: MachineStateGuards = {
    userConfigDir,
    resolveCacheCandidate: (cacheRoot, segments, label) =>
      purgeCache.resolveCandidate(cacheRoot, segments, label),
    frameworkMarketplaceName: FRAMEWORK_MARKETPLACE_NAME,
  };
  const purgeUserScopeFiles = new PurgeUserScopeFiles(
    {
      userManifestRepo,
      claims: inst.registrationRecordRules,
      purgeMachineState: new PurgeMachineState({ fs, logger, guards }),
      homeDir: homedir,
      userScopePluginFiles: new UserScopePluginFiles(fs, (plugin, tool, home) =>
        userScopeFilesSafeToDelete({ fs, logger, home }, plugin, tool)
      ),
    },
    tools
  );
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

/** What a project clean removes: its files, with the records the registrations left. */
function wireCleanProjectFiles(base: Base, inst: Installation) {
  const { fs, logger, manifestRepo, tools } = base;
  const { updateGitignore } = inst;
  const asks: ProjectCleanAsks = {
    homeDir: resolveHomeDir,
    assertMcpRemovable: (plugin, tool, projectRoot) =>
      assertProjectMcpEntriesRemovable(fs, { plugin, tool, projectRoot }),
  };
  return new CleanProjectFiles(
    {
      fs,
      manifestRepo,
      asks,
      planProjectClean: new PlanProjectClean({ manifestRepo, asks }, tools),
      removeProjectFiles: new RemoveProjectFiles(
        { fs, manifestRepo, logger, updateGitignore, homedir },
        tools
      ),
    },
    tools
  );
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
      records: inst.registrationRecordRules,
    }),
    confirm: new ConfirmRemoval(base.prompter),
    remove: new RemoveProjectInOrder({
      cleanProject,
      withdrawFromHost: base.withdrawFromHost,
      claims,
      marketplaces,
    }),
  });
}

/** Clean and uninstall. */
export function wireClean(base: Base, inst: Installation) {
  const { fs, logger, manifestRepo, userManifestRepo, tools } = base;
  const uninstallTools = new UninstallProjectTools(
    new UninstallTools(
      {
        manifestRepo,
        detachClaims: detachProjectClaims(userManifestRepo, fs),
        removeToolFiles: new RemoveToolFiles(fs, logger, tools, homedir),
      },
      tools
    ),
    inst.registrationRecordRules
  );
  const purgeCache = new PurgeDeclaredCache(fs, logger);
  const claims = wireCleanClaims({
    fs,
    logger,
    userManifestRepo,
    userSourceReferences: base.userSourceReferences,
    purgeCache,
  });
  const cleanUseCase = wireCleanProject(base, inst, claims);
  const cleanUserScopeUseCase = wireCleanUserScope(base, inst, { purgeCache, claims });
  return { uninstallTools, cleanUseCase, cleanUserScopeUseCase };
}
