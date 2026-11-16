import { homedir } from "node:os";
import { CleanUserScopeUseCase } from "../../contexts/framework/application/clean/clean-user-scope-use-case.js";
import { CleanUseCase } from "../../contexts/framework/application/clean-use-case.js";
import { UninstallIdeUseCase } from "../../contexts/framework/application/uninstall/uninstall-ide-use-case.js";
import { UninstallToolsUseCase } from "../../contexts/framework/application/uninstall/uninstall-tools-use-case.js";
import { UninstallUseCase } from "../../contexts/framework/application/uninstall/uninstall-use-case.js";
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
  const uninstallIdeUseCase = new UninstallIdeUseCase(
    manifestRepo,
    new UninstallToolsUseCase(fs, logger)
  );
  const uninstallUseCase = new UninstallUseCase(fs, manifestRepo, logger, userManifestRepo);
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
  return { uninstallIdeUseCase, uninstallUseCase, cleanUseCase, cleanUserScopeUseCase };
}
