import type { PurgeDeclaredCache } from "../../contexts/machine-claims/application/purge-declared-cache.js";
import type { ReleaseClaims } from "../../contexts/machine-claims/application/release-claims.js";

/** What a clean asks of the machine record: who still references the shared source, and which
 * cache a manifest names is proven to sit inside its owner. */
export interface CleanClaims {
  readonly release: ReleaseClaims;
  readonly purgeCache: PurgeDeclaredCache;
}
