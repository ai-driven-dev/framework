import type { RemoveMarketplace } from "../../contexts/distribution/application/remove/remove-marketplace.use-case.js";
import type { WithdrawFromHost } from "../../contexts/host-registration/application/withdraw/withdraw-from-host.use-case.js";
import type { PurgeUserScopeFiles } from "../../contexts/installation/application/purge-user-scope-files.js";
import type { CleanClaims } from "./clean-claims.js";
import type { UserScopeInspected } from "./inspect-user-scope.use-case.js";

export interface RemoveUserScopeRequest {
  inspection: UserScopeInspected;
  /** Threaded only to `RemoveMarketplace`, whose signature takes one for the
   * project-scope caller it usually serves: discarded by the adapter for scope `"user"`, since
   * this operation has no one project of its own. */
  projectRoot: string;
}

export interface RemoveUserScopeDeps {
  readonly purgeFiles: Pick<
    PurgeUserScopeFiles,
    "assertNothingDepends" | "proveWithdrawals" | "purge" | "deleteManifest"
  >;
  readonly withdrawFromHost: Pick<WithdrawFromHost, "execute">;
  readonly removeMarketplace: Pick<RemoveMarketplace, "execute">;
  readonly claims: Pick<CleanClaims, "purgeCache" | "frameworkMarketplaceName">;
}

/**
 * Undoes the machine-scope registration and purges the shared source. Order is a hard constraint:
 * every plugin ref uninstalled, then every marketplace unregistered, both through the host's own
 * CLI at scope `"user"`, before any cache is purged.
 */
export class RemoveUserScope {
  constructor(private readonly deps: RemoveUserScopeDeps) {}

  async execute(request: RemoveUserScopeRequest): Promise<void> {
    const { inspection, projectRoot } = request;
    this.deps.purgeFiles.assertNothingDepends(inspection);

    const withdrawals = await this.deps.purgeFiles.proveWithdrawals();
    await this.deps.withdrawFromHost.execute({ kind: "check-user-hosts", withdrawals });
    await this.deps.withdrawFromHost.execute({
      kind: "prove-user-registrations",
      withdrawals,
      projectRoot,
    });
    // Undoing a host's own registration must happen before any purge: a host's own CLI resolves
    // what it is unregistering against the built tree still on disk, and the purge removes
    // exactly that tree. Absent a manifest there is nothing recorded to undo, so there are no
    // withdrawals and each step below does nothing.
    await this.deps.withdrawFromHost.execute({
      kind: "withdraw-user-registrations",
      withdrawals,
      resolveCacheCandidate: (cacheRoot, relativeSegments, label) =>
        this.deps.claims.purgeCache.resolveCandidate(cacheRoot, relativeSegments, label),
    });
    await this.deps.purgeFiles.purge(projectRoot);
    await this.deps.removeMarketplace.execute({
      projectRoot,
      marketplace: { name: this.deps.claims.frameworkMarketplaceName, scope: "user" },
    });
    await this.deps.purgeFiles.deleteManifest();
  }
}
