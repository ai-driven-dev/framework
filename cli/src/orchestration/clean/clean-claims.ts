import type { PurgeDeclaredCache } from "../../contexts/machine-claims/application/purge-declared-cache.js";
import type { ReleaseClaims } from "../../contexts/machine-claims/application/release-claims.js";

/** What a clean asks of the machine record: who still references the shared source, and which
 * cache a manifest names is proven to sit inside its owner. Plus the name that shared source is
 * registered under, which the distribution owns and composition hands over. */
export interface CleanClaims {
  readonly release: ReleaseClaims;
  readonly purgeCache: PurgeDeclaredCache;
  readonly frameworkMarketplaceName: string;
}
