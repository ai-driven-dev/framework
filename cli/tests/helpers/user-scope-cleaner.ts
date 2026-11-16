import type { MarketplaceRegistry } from "../../src/contexts/distribution/ports/marketplace-registry.js";
import { WithdrawFromHost } from "../../src/contexts/host-registration/application/withdraw-from-host.js";
import type { HostPorts } from "../../src/contexts/host-registration/ports/host-ports.js";
import { PurgeUserScopeFiles } from "../../src/contexts/installation/application/purge-user-scope-files.js";
import type { ManifestRepository } from "../../src/contexts/installation/ports/manifest-repository.js";
import { PurgeDeclaredCache } from "../../src/contexts/machine-claims/application/purge-declared-cache.js";
import { ReleaseClaims } from "../../src/contexts/machine-claims/application/release-claims.js";
import { userScopeFilesSafeToDelete } from "../../src/contexts/machine-claims/application/user-scope-plugin-files.js";
import type { UserSourceReferences } from "../../src/contexts/machine-claims/ports/user-source-references.js";
import { CleanUserScope } from "../../src/orchestration/clean/clean-user-scope.js";
import type { FileReader } from "../../src/shared/ports/file-reader.js";
import type { FileWriter } from "../../src/shared/ports/file-writer.js";
import type { Lock } from "../../src/shared/ports/lock.js";
import type { Logger } from "../../src/shared/ports/logger.js";
import type { Prompter } from "../../src/shared/ports/prompter.js";
import { CapturingLogger } from "./ports/capturing-logger.js";
import { InMemoryFileAdapter } from "./ports/in-memory-file-adapter.js";
import { InMemoryMarketplaceRegistry } from "./ports/in-memory-marketplace-registry.js";

/** What a test names; everything else is the empty or in-memory default. */
export interface UserScopeCleanerParts extends Partial<HostPorts> {
  repo: ManifestRepository & Lock;
  fs?: FileReader & FileWriter;
  logger?: Logger;
  marketplaceRegistry?: MarketplaceRegistry;
  userConfigDir?: () => string;
  homeDir?: () => string;
  userSourceReferences?: UserSourceReferences;
  prompter?: Prompter;
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
      }
    ),
    new WithdrawFromHost(fs, logger, {
      activators: parts.activators ?? new Map(),
      pluginRegistries: parts.pluginRegistries ?? new Map(),
      marketplaceRegistries: parts.marketplaceRegistries ?? new Map(),
      sources: parts.sources ?? new Map(),
    }),
    { release: new ReleaseClaims(parts.userSourceReferences), purgeCache },
    logger,
    parts.prompter
  );
}
