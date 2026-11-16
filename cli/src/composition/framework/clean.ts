import { homedir } from "node:os";
import { CleanUserScopeUseCase } from "../../contexts/framework/application/clean/clean-user-scope-use-case.js";
import { CleanUseCase } from "../../contexts/framework/application/clean-use-case.js";
import { UninstallTools } from "../../contexts/installation/application/uninstall-tools.js";
import { detachProjectClaims } from "../../contexts/machine-claims/application/detach-project-claims.js";
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
  const cleanUserScopeUseCase = new CleanUserScopeUseCase(
    fs,
    userManifestRepo,
    logger,
    marketplaceRegistry,
    userConfigDir,
    withdrawFromHost,
    homedir,
    userSourceReferences,
    prompter
  );
  return { uninstallTools, cleanUseCase, cleanUserScopeUseCase };
}
