import type { WithdrawFromHost } from "../../contexts/host-registration/application/withdraw/withdraw-from-host.use-case.js";
import type { CleanProjectFiles } from "../../contexts/installation/application/clean/clean-project-files.use-case.js";
import type { ProjectCleanPlan } from "../../contexts/installation/application/clean/project-clean-plan.js";
import type { CleanClaims, ProjectCleanFactsOf, ReleaseProjectClaims } from "./clean-claims.js";

export interface RemoveProjectInOrderRequest {
  plan: ProjectCleanPlan;
  projectRoot: string;
  force: boolean;
}

export interface RemoveProjectInOrderDeps {
  readonly cleanProject: Pick<CleanProjectFiles, "execute">;
  readonly withdrawFromHost: Pick<WithdrawFromHost, "execute">;
  readonly cleanFacts: ProjectCleanFactsOf;
  readonly sharedClaim: CleanClaims["sharedClaim"];
  readonly release: ReleaseProjectClaims;
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
    const facts = await this.deps.cleanFacts(projectRoot);
    await this.deps.withdrawFromHost.execute({
      kind: "prove-project-registrations",
      withdrawals: plan.withdrawals,
      facts,
    });
    await this.deps.cleanProject.execute({ kind: "assert-removable", projectRoot, force });
    // Read the other projects before host cleanup, but keep this project's claim until every
    // local cleanup step succeeds. A failed file or gitignore cleanup must not free the source.
    const sharedSource = await this.deps.sharedClaim({
      projectRoot,
      list: async () => [...facts.marketplaceScopes].map(([name, scope]) => ({ name, scope })),
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
    await this.deps.release(projectRoot, plan, sharedSource?.resolvedRoot);
    return fileCount;
  }
}
