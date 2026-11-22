import type { PurgeDeclaredCache } from "../../contexts/machine-claims/application/purge-declared-cache.js";
import type { detachProjectClaims } from "../../contexts/machine-claims/application/removal/detach-project-claims.js";
import type { readMachineClaims } from "../../contexts/machine-claims/application/removal/read-machine-claims.js";
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
  readonly purgeCache: Pick<PurgeDeclaredCache, "resolveCandidate">;
  readonly frameworkMarketplaceName: string;
}
