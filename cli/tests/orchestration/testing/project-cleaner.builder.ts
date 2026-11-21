import { registrationRecordRules } from "../../../src/composition/installation.js";
import { wireCleanClaims } from "../../../src/composition/orchestration/clean.js";
import { ListMarketplaces } from "../../../src/contexts/distribution/application/list-marketplaces.js";
import { WithdrawFromHost } from "../../../src/contexts/host-registration/application/withdraw/withdraw-from-host.js";
import type { HostPorts } from "../../../src/contexts/host-registration/ports/host-ports.js";
import { CleanProjectFiles } from "../../../src/contexts/installation/application/clean-project-files.js";
import {
  RemoveProjectFiles,
  type RemoveProjectFilesDeps,
} from "../../../src/contexts/installation/application/removal/remove-project-files.js";
import { assertProjectMcpEntriesRemovable } from "../../../src/contexts/installation/application/removal/remove-project-plugin.js";
import { PurgeDeclaredCache } from "../../../src/contexts/machine-claims/application/purge-declared-cache.js";
import type { UserSourceReferences } from "../../../src/contexts/machine-claims/ports/user-source-references.js";
import { CleanProject } from "../../../src/orchestration/clean/clean-project.js";
import { resolveHomeDir } from "../../../src/shared/infrastructure/home-dir.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import { InMemoryMarketplaceRegistry } from "../../shared/testing/in-memory-marketplace-registry.fake.js";
import { registeredTools } from "../../shared/testing/registered-tools.builder.js";

type Constructed = ConstructorParameters<typeof CleanProject>;
type Files = RemoveProjectFilesDeps;

/** What a test names; everything else is the empty default. */
export interface ProjectCleanerParts extends Partial<HostPorts> {
  fs: Files["fs"];
  manifestRepo: Files["manifestRepo"];
  logger: Files["logger"];
  gitignore: Files["updateGitignore"];
  marketplaceRegistry?: ConstructorParameters<typeof ListMarketplaces>[0];
  prompter?: Constructed[4];
  homeDir?: () => string;
  userSourceReferences?: UserSourceReferences;
  userManifestRepo?: Parameters<typeof wireCleanClaims>[0]["userManifestRepo"];
}

export function projectCleanerArgs(parts: ProjectCleanerParts): Constructed {
  const purgeCache = new PurgeDeclaredCache(parts.fs, parts.logger);
  return [
    new CleanProjectFiles(
      {
        fs: parts.fs,
        manifestRepo: parts.manifestRepo,
        asks: {
          homeDir: parts.homeDir ?? resolveHomeDir,
          assertMcpRemovable: (plugin, tool, projectRoot) =>
            assertProjectMcpEntriesRemovable(parts.fs, { plugin, tool, projectRoot }),
          records: registrationRecordRules,
        },
        removeProjectFiles: new RemoveProjectFiles(
          {
            fs: parts.fs,
            manifestRepo: parts.manifestRepo,
            logger: parts.logger,
            updateGitignore: parts.gitignore,
          },
          registeredTools()
        ),
      },
      registeredTools()
    ),
    new WithdrawFromHost(parts.fs, parts.logger, {
      activators: parts.activators ?? new Map(),
      pluginRegistries: parts.pluginRegistries ?? new Map(),
      marketplaceRegistries: parts.marketplaceRegistries ?? new Map(),
      sources: parts.sources ?? new Map(),
    }),
    wireCleanClaims({
      fs: parts.fs,
      logger: parts.logger,
      userManifestRepo: parts.userManifestRepo ?? new InMemoryManifestRepository(),
      userSourceReferences: parts.userSourceReferences,
      purgeCache,
    }),
    new ListMarketplaces(parts.marketplaceRegistry ?? new InMemoryMarketplaceRegistry()),
    parts.prompter,
  ];
}

export function projectCleaner(parts: ProjectCleanerParts): CleanProject {
  return new CleanProject(...projectCleanerArgs(parts));
}
