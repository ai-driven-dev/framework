import type { ToolId } from "../../../shared/domain/tool.js";

/** A registered marketplace, with where this run's build of it lives for one tool. */
export interface BuiltMarketplace {
  readonly name: string;
  readonly builtDir: string;
}

/** The marketplaces the project registers, and, per tool, the ones whose build exists. A
 * marketplace never built, or gone since, is left out of its tool's list: nothing to compare. */
export interface MarketplaceBuilds {
  /** The registered marketplaces a project's own settings declare: a machine-scope one lives in
   * the host's own registry instead. */
  readonly projectScopedNames: readonly string[];
  /** Root of the machine-scope built tree these builds were looked for under. */
  readonly userCacheRoot: string;
  readonly built: ReadonlyMap<ToolId, readonly BuiltMarketplace[]>;
}
