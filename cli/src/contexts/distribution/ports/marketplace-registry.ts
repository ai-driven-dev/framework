import type { Scope } from "../../../shared/domain/scope.js";
import type { Marketplace } from "../domain/marketplace.js";

export interface MarketplaceRegistry {
  list(projectRoot: string): Promise<readonly Marketplace[]>;
  save(projectRoot: string, marketplace: Marketplace): Promise<void>;
  delete(projectRoot: string, name: string, scope: Scope): Promise<void>;
  updateLastFetched(projectRoot: string, name: string, scope: Scope, when: string): Promise<void>;
  updateVersion(projectRoot: string, name: string, scope: Scope, version: string): Promise<void>;
}
