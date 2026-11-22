import { ListMarketplacesToRefresh } from "../../../src/contexts/distribution/application/refresh/list-marketplaces-to-refresh.use-case.js";
import {
  RefreshMarketplace,
  type RefreshMarketplaceDeps,
} from "../../../src/contexts/distribution/application/refresh/refresh-marketplace.use-case.js";
import type { MarketplaceCachePort } from "../../../src/contexts/distribution/ports/marketplace-cache.js";
import { RefreshMarketplaces } from "../../../src/orchestration/marketplace/refresh-marketplaces.use-case.js";

/** The refresh scenario over a real refresh use case built from `deps`. */
export function refreshing(
  deps: RefreshMarketplaceDeps & { cache: MarketplaceCachePort }
): RefreshMarketplaces {
  return new RefreshMarketplaces(
    new ListMarketplacesToRefresh(deps.registry, deps.cache),
    new RefreshMarketplace(deps)
  );
}
