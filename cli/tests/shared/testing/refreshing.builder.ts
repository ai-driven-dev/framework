import {
  RefreshMarketplace,
  type RefreshMarketplaceDeps,
} from "../../../src/contexts/distribution/application/refresh-marketplace.use-case.js";
import { RefreshMarketplaces } from "../../../src/orchestration/marketplace/refresh-marketplaces.use-case.js";

/** The refresh scenario over a real refresh use case built from `deps`. */
export function refreshing(deps: RefreshMarketplaceDeps): RefreshMarketplaces {
  return new RefreshMarketplaces(new RefreshMarketplace(deps));
}
