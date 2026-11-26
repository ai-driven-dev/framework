import type { ListMarketplaces } from "../../contexts/distribution/application/list-marketplaces.use-case.js";
import type { ProjectCleanFacts } from "../../contexts/host-registration/application/withdraw/withdrawal.js";
import type { ProjectCleanPlan } from "../../contexts/installation/application/clean/project-clean-plan.js";
import type { detachProjectClaims } from "../../contexts/machine-claims/application/removal/detach-project-claims.js";
import type { readMachineClaims } from "../../contexts/machine-claims/application/removal/read-machine-claims.js";
import type { ResolvePurgeCandidate } from "../../contexts/machine-claims/application/resolve-purge-candidate.use-case.js";
import type { dropSourceClaim } from "../../contexts/machine-claims/application/shared-source/drop-source-claim.js";
import type { readSharedSourceClaim } from "../../contexts/machine-claims/application/shared-source/read-shared-source-claim.js";
import type { Lock } from "../../shared/ports/lock.js";

/** What a clean asks of the machine record: who still references the shared source, this
 * project's own claim on it and how it is released, and which cache a manifest names is proven to
 * sit inside its owner. Plus the name that shared source is registered under, which the
 * distribution owns and composition hands over. */
export interface CleanClaims {
  readonly referencingProjects?: { listAllReferencingProjects(): Promise<readonly string[]> };
  readonly sharedClaim: ReturnType<typeof readSharedSourceClaim>;
  readonly dropClaim: ReturnType<typeof dropSourceClaim>;
  /** Releases the project's native-registration refs, then each user plugin, from the machine
   * manifest. */
  readonly detach: ReturnType<typeof detachProjectClaims>;
  readonly machineClaims: ReturnType<typeof readMachineClaims>;
  readonly exclusive: Lock;
  readonly purgeCache: Pick<ResolvePurgeCandidate, "execute">;
  readonly frameworkMarketplaceName: string;
}

/** The facts a project's host withdrawal is proven against, read for one project root. */
export type ProjectCleanFactsOf = (projectRoot: string) => Promise<ProjectCleanFacts>;

/** Binds the machine record and the registered marketplaces into the facts of one project. */
export function projectCleanFactsOf(
  claims: Pick<
    CleanClaims,
    "frameworkMarketplaceName" | "machineClaims" | "exclusive" | "purgeCache"
  >,
  marketplaces: Pick<ListMarketplaces, "execute">
): ProjectCleanFactsOf {
  return async (projectRoot) => {
    const { marketplaces: registered } = await marketplaces.execute({ projectRoot });
    return {
      projectRoot,
      marketplaceScopes: new Map(registered.map((m) => [m.name, m.scope] as const)),
      sharedSource: undefined,
      frameworkAlias: claims.frameworkMarketplaceName,
      machine: claims.machineClaims,
      exclusive: (action) => claims.exclusive.withExclusiveAccess(action),
      resolveCacheCandidate: (cacheRoot, segments, label) =>
        claims.purgeCache.execute(cacheRoot, segments, label),
    };
  };
}

/** Releases a cleaned project's claims: its decrement on the shared source, then its refs and user plugins. */
export type ReleaseProjectClaims = (
  projectRoot: string,
  plan: Pick<ProjectCleanPlan, "userPlugins" | "nativeRefs">,
  sharedRoot: string | undefined
) => Promise<void>;

export function claimReleaseOf(
  claims: Pick<CleanClaims, "dropClaim" | "detach">
): ReleaseProjectClaims {
  return async (projectRoot, plan, sharedRoot) => {
    await claims.dropClaim(sharedRoot);
    await claims.detach(projectRoot, plan.userPlugins, plan.nativeRefs);
  };
}
