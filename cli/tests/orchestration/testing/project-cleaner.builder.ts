import { projectIntegrationOf, recordsOf } from "../../../src/composition/contexts/installation.js";
import { wireCleanClaims } from "../../../src/composition/orchestration/clean-claims.js";
import { ListMarketplaces } from "../../../src/contexts/distribution/application/list-marketplaces.use-case.js";
import { WithdrawFromHost } from "../../../src/contexts/host-registration/application/withdraw/withdraw-from-host.use-case.js";
import type { HostPorts } from "../../../src/contexts/host-registration/ports/host-ports.js";
import { AssertProjectRemovable } from "../../../src/contexts/installation/application/clean/assert-project-removable.use-case.js";
import type { ProjectCleanAsks } from "../../../src/contexts/installation/application/clean/clean-project-files.use-case.js";
import { CleanProjectFiles } from "../../../src/contexts/installation/application/clean/clean-project-files.use-case.js";
import { PlanProjectClean } from "../../../src/contexts/installation/application/clean/plan-project-clean.use-case.js";
import { DeleteTrackedProjectFiles } from "../../../src/contexts/installation/application/removal/project/delete-tracked-project-files.use-case.js";
import {
  type AiddTracesDeps,
  RemoveAiddTraces,
} from "../../../src/contexts/installation/application/removal/project/remove-aidd-traces.use-case.js";
import { RemoveMachineLocalFiles } from "../../../src/contexts/installation/application/removal/project/remove-machine-local-files.use-case.js";
import { RemoveProjectFiles } from "../../../src/contexts/installation/application/removal/project/remove-project-files.use-case.js";
import type { ScopeRecords } from "../../../src/contexts/installation/contract/records/scope-records.js";
import { ResolvePurgeCandidate } from "../../../src/contexts/machine-claims/application/resolve-purge-candidate.use-case.js";
import type { UserSourceReferences } from "../../../src/contexts/machine-claims/ports/user-source-references.js";
import type { ToolCatalog } from "../../../src/contexts/tools/contract/tool-catalog.js";
import {
  claimReleaseOf,
  projectCleanFactsOf,
} from "../../../src/orchestration/clean/clean-claims.js";
import {
  CleanProject,
  type CleanProjectDeps,
} from "../../../src/orchestration/clean/clean-project.use-case.js";
import { ConfirmRemoval } from "../../../src/orchestration/clean/confirm-removal.use-case.js";
import { PreviewProjectClean } from "../../../src/orchestration/clean/preview-project-clean.use-case.js";
import { RemoveProjectInOrder } from "../../../src/orchestration/clean/remove-project-in-order.use-case.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import { InMemoryMarketplaceRegistry } from "../../shared/testing/in-memory-marketplace-registry.fake.js";

const homedir = (): string => "/home/dev";

type Files = AiddTracesDeps;

/** What a test names; everything else is the empty default. */
export interface ProjectCleanerParts extends Partial<HostPorts> {
  tools: ToolCatalog;
  fs: Files["fs"];
  manifestRepo: Files["manifestRepo"] & ScopeRecords;
  logger: Files["logger"];
  gitignore: Files["updateGitignore"];
  marketplaceRegistry?: ConstructorParameters<typeof ListMarketplaces>[0];
  prompter?: ConstructorParameters<typeof ConfirmRemoval>[0];
  homeDir?: () => string;
  userSourceReferences?: UserSourceReferences;
  userManifestRepo?: Parameters<typeof wireCleanClaims>[0]["userManifestRepo"];
}

export function projectCleanerDeps(parts: ProjectCleanerParts): CleanProjectDeps {
  const purgeCache = new ResolvePurgeCandidate(parts.fs, parts.logger);
  const integration = projectIntegrationOf(parts.fs);
  const asks: ProjectCleanAsks = {
    homeDir: parts.homeDir ?? homedir,
    assertMcpRemovable: (plugin, tool, projectRoot) =>
      integration.assertMcpRemovable.execute({ plugin, tool, projectRoot }),
  };
  const cleanProject = new CleanProjectFiles({
    assertProjectRemovable: new AssertProjectRemovable(
      {
        assertHooksRemovable: integration.assertHooksRemovable,
        manifestRepo: parts.manifestRepo,
        assertMcpRemovable: asks.assertMcpRemovable,
      },
      parts.tools
    ),
    planProjectClean: new PlanProjectClean({ manifestRepo: parts.manifestRepo, asks }, parts.tools),
    removeProjectFiles: new RemoveProjectFiles({
      manifestRepo: parts.manifestRepo,
      trackedFiles: new DeleteTrackedProjectFiles(
        { fs: parts.fs, logger: parts.logger, homedir },
        parts.tools
      ),
      machineLocalFiles: new RemoveMachineLocalFiles(
        parts.fs,
        parts.tools,
        integration.removeHooks
      ),
      aiddTraces: new RemoveAiddTraces(
        {
          fs: parts.fs,
          manifestRepo: parts.manifestRepo,
          logger: parts.logger,
          updateGitignore: parts.gitignore,
        },
        parts.tools
      ),
    }),
  });
  const claims = wireCleanClaims({
    fs: parts.fs,
    logger: parts.logger,
    userManifestRepo: parts.userManifestRepo ?? new InMemoryManifestRepository(),
    userSourceReferences: parts.userSourceReferences,
    purgeCache,
  });
  const marketplaces = new ListMarketplaces(
    parts.marketplaceRegistry ?? new InMemoryMarketplaceRegistry()
  );
  return {
    preview: new PreviewProjectClean({
      cleanProject,
      claims,
      marketplaces,
      records: recordsOf(parts.manifestRepo),
    }),
    confirm: new ConfirmRemoval(parts.prompter),
    remove: new RemoveProjectInOrder({
      cleanProject,
      withdrawFromHost: new WithdrawFromHost(parts.fs, parts.logger, {
        activators: parts.activators ?? new Map(),
        pluginRegistries: parts.pluginRegistries ?? new Map(),
        marketplaceRegistries: parts.marketplaceRegistries ?? new Map(),
        sources: parts.sources ?? new Map(),
      }),
      cleanFacts: projectCleanFactsOf(claims, marketplaces),
      sharedClaim: claims.sharedClaim,
      release: claimReleaseOf(claims),
    }),
  };
}

export function projectCleaner(parts: ProjectCleanerParts): CleanProject {
  return new CleanProject(projectCleanerDeps(parts));
}
