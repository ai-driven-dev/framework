import type { ListMarketplaces } from "../../contexts/distribution/application/list-marketplaces.use-case.js";
import type { WithdrawFromHost } from "../../contexts/host-registration/application/withdraw/withdraw-from-host.use-case.js";
import type { ProjectCleanFacts } from "../../contexts/host-registration/application/withdraw/withdrawal.js";
import type { CleanProjectFiles } from "../../contexts/installation/application/clean/clean-project-files.use-case.js";
import type { ProjectCleanPlan } from "../../contexts/installation/application/clean/project-clean-plan.js";
import type { CleanClaims } from "./clean-claims.js";

export interface RemoveProjectInOrderRequest {
  plan: ProjectCleanPlan;
  projectRoot: string;
  force: boolean;
}

export interface RemoveProjectInOrderDeps {
  readonly cleanProject: Pick<CleanProjectFiles, "execute">;
  readonly withdrawFromHost: Pick<WithdrawFromHost, "execute">;
  readonly claims: CleanClaims;
  readonly marketplaces: Pick<ListMarketplaces, "execute">;
}

/**
 * Removes what a project installed, in a fixed order: the host's own registrations are undone
 * while the built tree they resolve against still exists, then the project's files go, and only
 * then is its claim on the machine record released, so a failed local cleanup never frees the
 * shared source. Resolves to the number of files removed.
 */
export class RemoveProjectInOrder {
  constructor(private readonly deps: RemoveProjectInOrderDeps) {}

  async execute(request: RemoveProjectInOrderRequest): Promise<number> {
    const { plan, projectRoot, force } = request;
    const facts = this.cleanFacts(projectRoot, await this.marketplaceScopes(projectRoot));
    await this.deps.withdrawFromHost.execute({
      kind: "prove-project-registrations",
      withdrawals: plan.withdrawals,
      facts,
    });
    await this.deps.cleanProject.execute({ kind: "assert-removable", projectRoot, force });
    // Read the other projects before host cleanup, but keep this project's claim until every
    // local cleanup step succeeds. A failed file or gitignore cleanup must not free the source.
    const sharedSource = await this.deps.claims.sharedClaim({
      projectRoot,
      list: () => this.registered(projectRoot),
    });
    // Undoing a host's own registration must happen before any of the rest: the tool's CLI
    // resolves the marketplace name against the built tree under `.aidd/cache/`, which the
    // removal of AIDD's state deletes next, and a host may refuse to unregister a source that is
    // gone.
    await this.deps.withdrawFromHost.execute({
      kind: "withdraw-project-registrations",
      withdrawals: plan.withdrawals,
      facts: { ...facts, sharedSource },
    });
    const fileCount = await this.deps.cleanProject.execute({ kind: "remove", projectRoot, force });
    // One project-level decrement, only after the local projection has been cleaned successfully.
    await this.deps.claims.dropClaim(sharedSource?.resolvedRoot);
    await this.deps.claims.detach(projectRoot, plan.userPlugins, plan.nativeRefs);
    return fileCount;
  }

  private async registered(projectRoot: string) {
    return (await this.deps.marketplaces.execute({ projectRoot })).marketplaces;
  }

  private async marketplaceScopes(projectRoot: string) {
    const registered = await this.registered(projectRoot);
    return new Map(registered.map((m) => [m.name, m.scope] as const));
  }

  private cleanFacts(
    projectRoot: string,
    marketplaceScopes: ProjectCleanFacts["marketplaceScopes"]
  ): ProjectCleanFacts {
    return {
      projectRoot,
      marketplaceScopes,
      sharedSource: undefined,
      frameworkAlias: this.deps.claims.frameworkMarketplaceName,
      machine: this.deps.claims.machineClaims,
      exclusive: (action) => this.deps.claims.exclusive.withExclusiveAccess(action),
      resolveCacheCandidate: (cacheRoot, segments, label) =>
        this.deps.claims.purgeCache.resolveCandidate(cacheRoot, segments, label),
    };
  }
}
