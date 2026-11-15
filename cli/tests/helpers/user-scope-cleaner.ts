import { CleanUserScopeUseCase } from "../../src/contexts/framework/application/clean/clean-user-scope-use-case.js";
import { WithdrawFromHost } from "../../src/contexts/host-registration/application/withdraw-from-host.js";
import type { HostPorts } from "../../src/contexts/host-registration/ports/host-ports.js";
import { CapturingLogger } from "./ports/capturing-logger.js";
import { InMemoryFileAdapter } from "./ports/in-memory-file-adapter.js";
import { InMemoryMarketplaceRegistry } from "./ports/in-memory-marketplace-registry.js";

type Constructed = ConstructorParameters<typeof CleanUserScopeUseCase>;

/** What a test names; everything else is the empty or in-memory default. */
export interface UserScopeCleanerParts extends Partial<HostPorts> {
  repo: Constructed[1];
  fs?: Constructed[0];
  logger?: Constructed[2];
  marketplaceRegistry?: Constructed[3];
  userConfigDir?: Constructed[4];
  homeDir?: Constructed[6];
  userSourceReferences?: Constructed[7];
  prompter?: Constructed[8];
}

export function userScopeCleaner(parts: UserScopeCleanerParts): CleanUserScopeUseCase {
  const fs = parts.fs ?? new InMemoryFileAdapter();
  const logger = parts.logger ?? new CapturingLogger();
  return new CleanUserScopeUseCase(
    fs,
    parts.repo,
    logger,
    parts.marketplaceRegistry ?? new InMemoryMarketplaceRegistry(),
    parts.userConfigDir ?? (() => "/fake-home/.config/aidd"),
    new WithdrawFromHost(fs, logger, {
      activators: parts.activators ?? new Map(),
      pluginRegistries: parts.pluginRegistries ?? new Map(),
      marketplaceRegistries: parts.marketplaceRegistries ?? new Map(),
      sources: parts.sources ?? new Map(),
    }),
    parts.homeDir ?? (() => "/fake-home"),
    parts.userSourceReferences,
    parts.prompter
  );
}
