import { ListMarketplaces } from "../../src/contexts/distribution/application/list-marketplaces.js";
import { WithdrawFromHost } from "../../src/contexts/host-registration/application/withdraw-from-host.js";
import type { HostPorts } from "../../src/contexts/host-registration/ports/host-ports.js";
import { CleanProject as CleanProjectFiles } from "../../src/contexts/installation/application/clean-project.js";
import { assertProjectMcpEntriesRemovable } from "../../src/contexts/installation/application/removal/remove-project-plugin.js";
import { PurgeDeclaredCache } from "../../src/contexts/machine-claims/application/purge-declared-cache.js";
import { ReleaseClaims } from "../../src/contexts/machine-claims/application/release-claims.js";
import { CleanProject } from "../../src/orchestration/clean/clean-project.js";
import { resolveHomeDir } from "../../src/shared/infrastructure/home-dir.js";
import { InMemoryMarketplaceRegistry } from "./ports/in-memory-marketplace-registry.js";

type Constructed = ConstructorParameters<typeof CleanProject>;
type Files = ConstructorParameters<typeof CleanProjectFiles>;
type Release = ConstructorParameters<typeof ReleaseClaims>;

/** What a test names; everything else is the empty default. */
export interface ProjectCleanerParts extends Partial<HostPorts> {
  fs: Files[0];
  manifestRepo: Files[1];
  logger: Files[2];
  gitignore: Files[3];
  marketplaceRegistry?: ConstructorParameters<typeof ListMarketplaces>[0];
  prompter?: Constructed[4];
  homeDir?: () => string;
  userSourceReferences?: Release[3];
  userManifestRepo?: Release[2];
}

export function projectCleanerArgs(parts: ProjectCleanerParts): Constructed {
  const purgeCache = new PurgeDeclaredCache(parts.fs, parts.logger);
  return [
    new CleanProjectFiles(parts.fs, parts.manifestRepo, parts.logger, parts.gitignore, {
      homeDir: parts.homeDir ?? resolveHomeDir,
      assertMcpRemovable: (plugin, tool, projectRoot) =>
        assertProjectMcpEntriesRemovable(parts.fs, plugin, tool, projectRoot),
    }),
    new WithdrawFromHost(parts.fs, parts.logger, {
      activators: parts.activators ?? new Map(),
      pluginRegistries: parts.pluginRegistries ?? new Map(),
      marketplaceRegistries: parts.marketplaceRegistries ?? new Map(),
      sources: parts.sources ?? new Map(),
    }),
    {
      release: new ReleaseClaims(
        parts.fs,
        parts.logger,
        parts.userManifestRepo,
        parts.userSourceReferences
      ),
      purgeCache,
    },
    new ListMarketplaces(parts.marketplaceRegistry ?? new InMemoryMarketplaceRegistry()),
    parts.prompter,
  ];
}

export function projectCleaner(parts: ProjectCleanerParts): CleanProject {
  return new CleanProject(...projectCleanerArgs(parts));
}
