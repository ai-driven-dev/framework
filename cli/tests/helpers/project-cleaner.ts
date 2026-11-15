import { CleanUseCase } from "../../src/contexts/framework/application/clean-use-case.js";
import { WithdrawFromHost } from "../../src/contexts/host-registration/application/withdraw-from-host.js";
import type { HostPorts } from "../../src/contexts/host-registration/ports/host-ports.js";
import type { UpdateGitignore } from "../../src/contexts/installation/application/update-gitignore.js";

type Constructed = ConstructorParameters<typeof CleanUseCase>;

/** What a test names; everything else is the empty default. */
export interface ProjectCleanerParts extends Partial<HostPorts> {
  fs: Constructed[0];
  manifestRepo: Constructed[1];
  logger: Constructed[2];
  gitignore: UpdateGitignore;
  marketplaceRegistry?: Constructed[5];
  prompter?: Constructed[6];
  homeDir?: Constructed[7];
  userSourceReferences?: Constructed[8];
  userManifestRepo?: Constructed[9];
}

export function projectCleanerArgs(parts: ProjectCleanerParts): Constructed {
  return [
    parts.fs,
    parts.manifestRepo,
    parts.logger,
    parts.gitignore,
    new WithdrawFromHost(parts.fs, parts.logger, {
      activators: parts.activators ?? new Map(),
      pluginRegistries: parts.pluginRegistries ?? new Map(),
      marketplaceRegistries: parts.marketplaceRegistries ?? new Map(),
      sources: parts.sources ?? new Map(),
    }),
    parts.marketplaceRegistry,
    parts.prompter,
    parts.homeDir,
    parts.userSourceReferences,
    parts.userManifestRepo,
  ];
}

export function projectCleaner(parts: ProjectCleanerParts): CleanUseCase {
  return new CleanUseCase(...projectCleanerArgs(parts));
}
