import type { Scope } from "../../../shared/domain/scope.js";

/** A registered marketplace, as far as a claim over the shared framework source needs it. */
export interface ListedMarketplace {
  readonly name: string;
  readonly scope: Scope;
}

/** The marketplaces a project's registry holds. The distribution owns the registry and hands
 * over the real one, which satisfies this shape. */
export interface MarketplaceListing {
  list(projectRoot: string): Promise<readonly ListedMarketplace[]>;
}
