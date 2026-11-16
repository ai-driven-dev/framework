import { homedir } from "node:os";
import { CleanUseCase } from "../../contexts/framework/application/clean-use-case.js";
import { PurgeUserScopeFiles } from "../../contexts/installation/application/purge-user-scope-files.js";
import { UninstallTools } from "../../contexts/installation/application/uninstall-tools.js";
import { detachProjectClaims } from "../../contexts/machine-claims/application/detach-project-claims.js";
import { PurgeDeclaredCache } from "../../contexts/machine-claims/application/purge-declared-cache.js";
import { ReleaseClaims } from "../../contexts/machine-claims/application/release-claims.js";
import { userScopeFilesSafeToDelete } from "../../contexts/machine-claims/application/user-scope-plugin-files.js";
import { CleanUserScope } from "../../orchestration/clean/clean-user-scope.js";
import { userConfigDir } from "../../shared/infrastructure/user-config-dir.js";
import type { Base } from "./base.js";
import type { Installation } from "./installation.js";

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
  const cleanUseCase = new CleanUseCase(
    fs,
    manifestRepo,
    logger,
    updateGitignore,
    withdrawFromHost,
    marketplaceRegistry,
    prompter,
    undefined,
    userSourceReferences,
    userManifestRepo
  );
  const purgeCache = new PurgeDeclaredCache(fs, logger);
  const claims = { release: new ReleaseClaims(userSourceReferences), purgeCache };
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
    }
  );
  const cleanUserScopeUseCase = new CleanUserScope(
    purgeUserScopeFiles,
    withdrawFromHost,
    claims,
    logger,
    prompter
  );
  return { uninstallTools, cleanUseCase, cleanUserScopeUseCase };
}
