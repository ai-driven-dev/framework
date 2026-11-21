import { wireCleanClaims } from "../../../src/composition/orchestration/clean.js";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../../src/contexts/distribution/contract/marketplace.js";
import { WithdrawFromHost } from "../../../src/contexts/host-registration/application/withdraw/withdraw-from-host.js";
import type { HostPorts } from "../../../src/contexts/host-registration/ports/host-ports.js";
import {
  PurgeUserScopeFiles,
  type PurgeUserScopeFilesDeps,
} from "../../../src/contexts/installation/application/purge-user-scope-files.js";
import type { MachineStateGuards } from "../../../src/contexts/installation/application/removal/purge-machine-state.js";
import {
  PurgeMachineState,
  type PurgeMachineStateDeps,
} from "../../../src/contexts/installation/application/removal/purge-machine-state.js";
import { UserScopePluginFiles } from "../../../src/contexts/installation/application/removal/user-scope-plugin-files.js";
import { PurgeDeclaredCache } from "../../../src/contexts/machine-claims/application/purge-declared-cache.js";
import { userScopeFilesSafeToDelete } from "../../../src/contexts/machine-claims/application/user-scope-plugin-files.js";
import type { UserSourceReferences } from "../../../src/contexts/machine-claims/ports/user-source-references.js";
import { CleanUserScope } from "../../../src/orchestration/clean/clean-user-scope.js";
import { CapturingLogger } from "../../shared/testing/capturing-logger.fake.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryMarketplaceRegistry } from "../../shared/testing/in-memory-marketplace-registry.fake.js";
import { registeredTools } from "../../shared/testing/registered-tools.builder.js";

/** What a test names; everything else is the empty or in-memory default. */
export interface UserScopeCleanerParts extends Partial<HostPorts> {
  repo: PurgeUserScopeFilesDeps["userManifestRepo"];
  fs?: PurgeMachineStateDeps["fs"];
  logger?: PurgeMachineStateDeps["logger"];
  marketplaceRegistry?: PurgeMachineStateDeps["marketplaceRegistry"];
  userConfigDir?: () => string;
  homeDir?: () => string;
  userSourceReferences?: UserSourceReferences;
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
      {
        userManifestRepo: parts.repo,
        purgeMachineState: new PurgeMachineState({
          fs,
          logger,
          marketplaceRegistry: parts.marketplaceRegistry ?? new InMemoryMarketplaceRegistry(),
          guards,
        }),
        homeDir,
        userScopePluginFiles: new UserScopePluginFiles(fs, (plugin, tool, home) =>
          userScopeFilesSafeToDelete({ fs, logger, home }, plugin, tool)
        ),
      },
      registeredTools()
    ),
    new WithdrawFromHost(fs, logger, {
      activators: parts.activators ?? new Map(),
      pluginRegistries: parts.pluginRegistries ?? new Map(),
      marketplaceRegistries: parts.marketplaceRegistries ?? new Map(),
      sources: parts.sources ?? new Map(),
    }),
    wireCleanClaims({
      fs,
      logger,
      userManifestRepo: parts.repo,
      userSourceReferences: parts.userSourceReferences,
      purgeCache,
    }),
    logger,
    parts.prompter
  );
}
