import type { Scope } from "../../../shared/domain/scope.js";
import type { Marketplace } from "../domain/marketplace.js";

/** What names one registered marketplace: a name is unique within a scope. */
export type MarketplaceKey = Pick<Marketplace, "name" | "scope">;

export interface MarketplaceRegistry {
  list(projectRoot: string): Promise<readonly Marketplace[]>;
  save(projectRoot: string, marketplace: Marketplace): Promise<void>;
  delete(projectRoot: string, name: string, scope: Scope): Promise<void>;
  updateLastFetched(projectRoot: string, key: MarketplaceKey, when: string): Promise<void>;
  updateVersion(projectRoot: string, key: MarketplaceKey, version: string): Promise<void>;
}
