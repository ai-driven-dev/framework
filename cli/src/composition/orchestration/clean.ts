import { homedir } from "node:os";
import { ListMarketplaces } from "../../contexts/distribution/application/list-marketplaces.js";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../contexts/distribution/contract/marketplace.js";
import { CleanProjectFiles } from "../../contexts/installation/application/clean-project-files.js";
import { PurgeUserScopeFiles } from "../../contexts/installation/application/purge-user-scope-files.js";
import type { MachineStateGuards } from "../../contexts/installation/application/removal/purge-machine-state.js";
import { PurgeMachineState } from "../../contexts/installation/application/removal/purge-machine-state.js";
import { RemoveProjectFiles } from "../../contexts/installation/application/removal/remove-project-files.js";
import { assertProjectMcpEntriesRemovable } from "../../contexts/installation/application/removal/remove-project-plugin.js";
import { RemoveToolFiles } from "../../contexts/installation/application/removal/remove-tool-files.js";
import { UserScopePluginFiles } from "../../contexts/installation/application/removal/user-scope-plugin-files.js";
import { UninstallTools } from "../../contexts/installation/application/uninstall-tools.js";
import { detachProjectClaims } from "../../contexts/machine-claims/application/detach-project-claims.js";
import { dropSourceClaim } from "../../contexts/machine-claims/application/drop-source-claim.js";
import { PurgeDeclaredCache } from "../../contexts/machine-claims/application/purge-declared-cache.js";
import { readMachineClaims } from "../../contexts/machine-claims/application/read-machine-claims.js";
import { readSharedSourceClaim } from "../../contexts/machine-claims/application/read-shared-source-claim.js";
import { userScopeFilesSafeToDelete } from "../../contexts/machine-claims/application/user-scope-plugin-files.js";
import type { MachineManifestRepository } from "../../contexts/machine-claims/ports/machine-manifest.js";
import type { UserSourceReferences } from "../../contexts/machine-claims/ports/user-source-references.js";
import type { CleanClaims } from "../../orchestration/clean/clean-claims.js";
import { CleanProject } from "../../orchestration/clean/clean-project.js";
import { CleanUserScope } from "../../orchestration/clean/clean-user-scope.js";
import { resolveHomeDir } from "../../shared/infrastructure/home-dir.js";
import { userConfigDir } from "../../shared/infrastructure/user-config-dir.js";
import type { FileReader } from "../../shared/ports/file-reader.js";
import type { FileWriter } from "../../shared/ports/file-writer.js";
import type { Lock } from "../../shared/ports/lock.js";
import type { Logger } from "../../shared/ports/logger.js";
import type { Installation } from "../installation.js";
import type { Base } from "../shared.js";

/** What a clean asks of the machine record, over the user manifest and the shared source's references. */
export function wireCleanClaims(parts: {
  fs: FileReader & FileWriter;
  logger: Logger;
  userManifestRepo: MachineManifestRepository & Lock;
  userSourceReferences?: UserSourceReferences;
  purgeCache: PurgeDeclaredCache;
}): CleanClaims {
  const { fs, logger, userManifestRepo, userSourceReferences, purgeCache } = parts;
  return {
    referencingProjects: userSourceReferences,
    sharedClaim: readSharedSourceClaim({
      fs,
      logger,
      frameworkMarketplaceName: FRAMEWORK_MARKETPLACE_NAME,
      platform: process.platform,
      references: userSourceReferences,
    }),
    dropClaim: dropSourceClaim(logger, userSourceReferences),
    detach: detachProjectClaims(userManifestRepo, fs),
    machineClaims: readMachineClaims(userManifestRepo),
    exclusive: userManifestRepo,
    purgeCache,
    frameworkMarketplaceName: FRAMEWORK_MARKETPLACE_NAME,
  };
}

/** The machine-scope half of a clean: the user-scope files, the machine state and the host. */
function wireCleanUserScope(base: Base, purgeCache: PurgeDeclaredCache, claims: CleanClaims) {
  const { fs, logger, prompter, userManifestRepo, marketplaceRegistry, withdrawFromHost, tools } =
    base;
  const guards: MachineStateGuards = {
    userConfigDir,
    resolveCacheCandidate: (cacheRoot, segments, label) =>
      purgeCache.resolveCandidate(cacheRoot, segments, label),
    frameworkMarketplaceName: FRAMEWORK_MARKETPLACE_NAME,
  };
  const purgeUserScopeFiles = new PurgeUserScopeFiles(
    userManifestRepo,
    new PurgeMachineState(fs, logger, marketplaceRegistry, guards),
    homedir,
    new UserScopePluginFiles(fs, (plugin, tool, home) =>
      userScopeFilesSafeToDelete({ fs, logger, home }, plugin, tool)
    ),
    tools
  );
  return new CleanUserScope(purgeUserScopeFiles, withdrawFromHost, claims, logger, prompter);
}

/** Clean and uninstall. */
export function wireClean(base: Base, inst: Installation) {
  const {
    fs,
    logger,
    prompter,
    manifestRepo,
    userManifestRepo,
    userSourceReferences,
    marketplaceRegistry,
    withdrawFromHost,
    tools,
  } = base;
  const { updateGitignore, registrationRecordRules } = inst;
  const uninstallTools = new UninstallTools(
    manifestRepo,
    detachProjectClaims(userManifestRepo, fs),
    registrationRecordRules,
    new RemoveToolFiles(fs, logger, tools),
    tools
  );
  const purgeCache = new PurgeDeclaredCache(fs, logger);
  const claims = wireCleanClaims({
    fs,
    logger,
    userManifestRepo,
    userSourceReferences,
    purgeCache,
  });
  const cleanUserScopeUseCase = wireCleanUserScope(base, purgeCache, claims);
  const cleanProjectFiles = new CleanProjectFiles(
    fs,
    manifestRepo,
    {
      homeDir: resolveHomeDir,
      assertMcpRemovable: (plugin, tool, projectRoot) =>
        assertProjectMcpEntriesRemovable(fs, plugin, tool, projectRoot),
      records: registrationRecordRules,
    },
    new RemoveProjectFiles(fs, manifestRepo, logger, updateGitignore, tools),
    tools
  );
  const cleanUseCase = new CleanProject(
    cleanProjectFiles,
    withdrawFromHost,
    claims,
    new ListMarketplaces(marketplaceRegistry),
    prompter
  );
  return { uninstallTools, cleanUseCase, cleanUserScopeUseCase };
}
