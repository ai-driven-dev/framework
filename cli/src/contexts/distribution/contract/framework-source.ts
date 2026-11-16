import type { MarketplaceScope } from "../../../shared/domain/scope.js";

/** Where the framework marketplace comes from: a repository (`repo`, optionally at a `ref`) when
 * `kind` is `"remote"`, a directory (`path`) when it is `"local"`. Each field is read only for
 * its own kind. */
export interface FrameworkSource {
  readonly kind: "remote" | "local";
  readonly repo: string;
  readonly ref: string | undefined;
  readonly path: string;
}

/** The framework marketplace as registered: its name and the scope it ended up at. */
export interface EnsuredFrameworkMarketplace {
  readonly name: string;
  readonly scope: MarketplaceScope;
}
