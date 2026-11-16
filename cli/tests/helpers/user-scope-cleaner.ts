import { FRAMEWORK_MARKETPLACE_NAME } from "../../src/contexts/distribution/contract/marketplace.js";
import { WithdrawFromHost } from "../../src/contexts/host-registration/application/withdraw-from-host.js";
import type { HostPorts } from "../../src/contexts/host-registration/ports/host-ports.js";
import { PurgeUserScopeFiles } from "../../src/contexts/installation/application/purge-user-scope-files.js";
import { PurgeDeclaredCache } from "../../src/contexts/machine-claims/application/purge-declared-cache.js";
import { ReleaseClaims } from "../../src/contexts/machine-claims/application/release-claims.js";
import { userScopeFilesSafeToDelete } from "../../src/contexts/machine-claims/application/user-scope-plugin-files.js";
import { CleanUserScope } from "../../src/orchestration/clean/clean-user-scope.js";
import { CapturingLogger } from "./ports/capturing-logger.js";
import { InMemoryFileAdapter } from "./ports/in-memory-file-adapter.js";
import { InMemoryMarketplaceRegistry } from "./ports/in-memory-marketplace-registry.js";

type Purge = ConstructorParameters<typeof PurgeUserScopeFiles>;

/** What a test names; everything else is the empty or in-memory default. */
export interface UserScopeCleanerParts extends Partial<HostPorts> {
  repo: Purge[1];
  fs?: Purge[0];
  logger?: Purge[2];
  marketplaceRegistry?: Purge[3];
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
  return new CleanUserScope(
    new PurgeUserScopeFiles(
      fs,
      parts.repo,
      logger,
      parts.marketplaceRegistry ?? new InMemoryMarketplaceRegistry(),
      {
        userConfigDir: parts.userConfigDir ?? (() => "/fake-home/.config/aidd"),
        homeDir,
        safeFiles: (plugin, tool) =>
          userScopeFilesSafeToDelete(fs, logger, plugin, tool, homeDir()),
        resolveCacheCandidate: (cacheRoot, segments, label) =>
          purgeCache.resolveCandidate(cacheRoot, segments, label),
        frameworkMarketplaceName: FRAMEWORK_MARKETPLACE_NAME,
      }
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
        FRAMEWORK_MARKETPLACE_NAME,
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
