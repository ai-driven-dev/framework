import { homedir } from "node:os";
import { ListMarketplaces } from "../../contexts/distribution/application/list-marketplaces.use-case.js";
import { RemoveMarketplace } from "../../contexts/distribution/application/remove/remove-marketplace.use-case.js";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../contexts/distribution/contract/marketplace.js";
import {
  CleanProjectFiles,
  type ProjectCleanAsks,
} from "../../contexts/installation/application/clean/clean-project-files.use-case.js";
import { PlanProjectClean } from "../../contexts/installation/application/clean/plan-project-clean.use-case.js";
import { PurgeUserScopeFiles } from "../../contexts/installation/application/clean/purge-user-scope-files.js";
import { RemoveProjectFiles } from "../../contexts/installation/application/removal/project/remove-project-files.js";
import { RemoveToolFiles } from "../../contexts/installation/application/removal/project/remove-tool-files.js";
import type { MachineStateGuards } from "../../contexts/installation/application/removal/purge-machine-state.js";
import { PurgeMachineState } from "../../contexts/installation/application/removal/purge-machine-state.js";
import { assertProjectMcpEntriesRemovable } from "../../contexts/installation/application/removal/remove-project-plugin.js";
import { UserScopePluginFiles } from "../../contexts/installation/application/removal/user-scope-plugin-files.js";
import { UninstallTools } from "../../contexts/installation/application/uninstall-tools.use-case.js";
import { detachProjectClaims } from "../../contexts/machine-claims/application/detach-project-claims.js";
import { PurgeDeclaredCache } from "../../contexts/machine-claims/application/purge-declared-cache.js";
import { userScopeFilesSafeToDelete } from "../../contexts/machine-claims/application/user-scope-plugin-files.js";
import type { CleanClaims } from "../../orchestration/clean/clean-claims.js";
import { CleanProject } from "../../orchestration/clean/clean-project.use-case.js";
import { CleanUserScope } from "../../orchestration/clean/clean-user-scope.use-case.js";
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
    withdrawFromHost,
    removeMarketplace: new RemoveMarketplace(marketplaceRegistry),
    claims,
    logger,
    prompter,
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

/** Clean and uninstall. */
export function wireClean(base: Base, inst: Installation) {
  const { fs, logger, prompter, manifestRepo, userManifestRepo, marketplaceRegistry, tools } = base;
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
  const cleanUseCase = new CleanProject({
    cleanProject: wireCleanProjectFiles(base, inst),
    withdrawFromHost: base.withdrawFromHost,
    claims,
    marketplaces: new ListMarketplaces(marketplaceRegistry),
    prompter,
    records: inst.registrationRecordRules,
  });
  const cleanUserScopeUseCase = wireCleanUserScope(base, inst, { purgeCache, claims });
  return { uninstallTools, cleanUseCase, cleanUserScopeUseCase };
}
