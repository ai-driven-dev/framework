import { homedir } from "node:os";
import { ListMarketplaces } from "../../contexts/distribution/application/list-marketplaces.js";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../contexts/distribution/contract/marketplace.js";
import { CleanProject as CleanProjectFiles } from "../../contexts/installation/application/clean-project.js";
import { PurgeUserScopeFiles } from "../../contexts/installation/application/purge-user-scope-files.js";
import { assertProjectMcpEntriesRemovable } from "../../contexts/installation/application/removal/remove-project-plugin.js";
import { UninstallTools } from "../../contexts/installation/application/uninstall-tools.js";
import { detachProjectClaims } from "../../contexts/machine-claims/application/detach-project-claims.js";
import { PurgeDeclaredCache } from "../../contexts/machine-claims/application/purge-declared-cache.js";
import { ReleaseClaims } from "../../contexts/machine-claims/application/release-claims.js";
import { userScopeFilesSafeToDelete } from "../../contexts/machine-claims/application/user-scope-plugin-files.js";
import { CleanProject } from "../../orchestration/clean/clean-project.js";
import { CleanUserScope } from "../../orchestration/clean/clean-user-scope.js";
import { resolveHomeDir } from "../../shared/infrastructure/home-dir.js";
import { userConfigDir } from "../../shared/infrastructure/user-config-dir.js";
import type { Installation } from "../installation.js";
import type { Base } from "../shared.js";

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
  } = base;
  const { updateGitignore } = inst;
  const uninstallTools = new UninstallTools(
    fs,
    logger,
    manifestRepo,
    detachProjectClaims(userManifestRepo, fs)
  );
  const purgeCache = new PurgeDeclaredCache(fs, logger);
  const claims = {
    release: new ReleaseClaims(
      fs,
      logger,
      { frameworkMarketplaceName: FRAMEWORK_MARKETPLACE_NAME, platform: process.platform },
      userManifestRepo,
      userSourceReferences
    ),
    purgeCache,
    frameworkMarketplaceName: FRAMEWORK_MARKETPLACE_NAME,
  };
  const purgeUserScopeFiles = new PurgeUserScopeFiles(
    fs,
    userManifestRepo,
    logger,
    marketplaceRegistry,
    {
      userConfigDir,
      homeDir: homedir,
      safeFiles: (plugin, tool) => userScopeFilesSafeToDelete(fs, logger, plugin, tool, homedir()),
      resolveCacheCandidate: (cacheRoot, segments, label) =>
        purgeCache.resolveCandidate(cacheRoot, segments, label),
      frameworkMarketplaceName: FRAMEWORK_MARKETPLACE_NAME,
    }
  );
  const cleanUserScopeUseCase = new CleanUserScope(
    purgeUserScopeFiles,
    withdrawFromHost,
    claims,
    logger,
    prompter
  );
  const cleanProjectFiles = new CleanProjectFiles(fs, manifestRepo, logger, updateGitignore, {
    homeDir: resolveHomeDir,
    assertMcpRemovable: (plugin, tool, projectRoot) =>
      assertProjectMcpEntriesRemovable(fs, plugin, tool, projectRoot),
  });
  const cleanUseCase = new CleanProject(
    cleanProjectFiles,
    withdrawFromHost,
    claims,
    new ListMarketplaces(marketplaceRegistry),
    prompter
  );
  return { uninstallTools, cleanUseCase, cleanUserScopeUseCase };
}
