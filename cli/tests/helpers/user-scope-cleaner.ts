import { FRAMEWORK_MARKETPLACE_NAME } from "../../src/contexts/distribution/contract/marketplace.js";
import { WithdrawFromHost } from "../../src/contexts/host-registration/application/withdraw-from-host.js";
import type { HostPorts } from "../../src/contexts/host-registration/ports/host-ports.js";
import { PurgeUserScopeFiles } from "../../src/contexts/installation/application/purge-user-scope-files.js";
import type { MachineStateGuards } from "../../src/contexts/installation/application/removal/purge-machine-state.js";
import { PurgeMachineState } from "../../src/contexts/installation/application/removal/purge-machine-state.js";
import { UserScopePluginFiles } from "../../src/contexts/installation/application/removal/user-scope-plugin-files.js";
import { PurgeDeclaredCache } from "../../src/contexts/machine-claims/application/purge-declared-cache.js";
import { ReleaseClaims } from "../../src/contexts/machine-claims/application/release-claims.js";
import { userScopeFilesSafeToDelete } from "../../src/contexts/machine-claims/application/user-scope-plugin-files.js";
import { CleanUserScope } from "../../src/orchestration/clean/clean-user-scope.js";
import { CapturingLogger } from "../shared/testing/capturing-logger.js";
import { InMemoryFileAdapter } from "../shared/testing/in-memory-file-adapter.js";
import { registeredTools } from "../shared/testing/registered-tools.js";
import { InMemoryMarketplaceRegistry } from "./ports/in-memory-marketplace-registry.js";

type Purge = ConstructorParameters<typeof PurgeUserScopeFiles>;

/** What a test names; everything else is the empty or in-memory default. */
export interface UserScopeCleanerParts extends Partial<HostPorts> {
  repo: Purge[0];
  fs?: ConstructorParameters<typeof PurgeMachineState>[0];
  logger?: ConstructorParameters<typeof PurgeMachineState>[1];
  marketplaceRegistry?: ConstructorParameters<typeof PurgeMachineState>[2];
  userConfigDir?: () => string;
  homeDir?: () => string;
  userSourceReferences?: ConstructorParameters<typeof ReleaseClaims>[4];
  prompter?: ConstructorParameters<typeof CleanUserScope>[4];
}

export function userScopeCleaner(parts: UserScopeCleanerParts): CleanUserScope {
  const fs = parts.fs ?? new InMemoryFileAdapter();
  const logger = parts.logger ?? new CapturingLogger();
  const homeDir = parts.homeDir ?? (() => "/fake-home");
  const purgeCache = new PurgeDeclaredCache(fs, logger);
  const guards: MachineStateGuards = {
    userConfigDir: parts.userConfigDir ?? (() => "/fake-home/.config/aidd"),
    resolveCacheCandidate: (cacheRoot, segments, label) =>
      purgeCache.resolveCandidate(cacheRoot, segments, label),
    frameworkMarketplaceName: FRAMEWORK_MARKETPLACE_NAME,
  };
  return new CleanUserScope(
    new PurgeUserScopeFiles(
      parts.repo,
      new PurgeMachineState(
        fs,
        logger,
        parts.marketplaceRegistry ?? new InMemoryMarketplaceRegistry(),
        guards
      ),
      homeDir,
      new UserScopePluginFiles(fs, (plugin, tool, home) =>
        userScopeFilesSafeToDelete(fs, logger, plugin, tool, home)
      ),
      registeredTools()
    ),
    new WithdrawFromHost(fs, logger, {
      activators: parts.activators ?? new Map(),
      pluginRegistries: parts.pluginRegistries ?? new Map(),
      marketplaceRegistries: parts.marketplaceRegistries ?? new Map(),
      sources: parts.sources ?? new Map(),
    }),
    {
      release: new ReleaseClaims(
        fs,
        logger,
        { frameworkMarketplaceName: FRAMEWORK_MARKETPLACE_NAME, platform: process.platform },
        parts.repo,
        parts.userSourceReferences
      ),
      purgeCache,
      frameworkMarketplaceName: FRAMEWORK_MARKETPLACE_NAME,
    },
    logger,
    parts.prompter
  );
}
