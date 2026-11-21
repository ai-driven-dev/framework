import type { Scope } from "../../../shared/domain/scope.js";
import type { PluginSource } from "../../../shared/domain/source.js";
import type { AiToolId } from "../../../shared/domain/tool.js";
import type { FrameworkBuildMode } from "../../tools/contract/tool-profile.js";

/** The marketplace to build, as far as a build reads it: the name plugins are filed under, where it
 * is fetched from, and the scope it lives at. A registered marketplace satisfies this shape. */
export interface MarketplaceToBuild {
  readonly name: string;
  readonly source: PluginSource;
  readonly scope: Scope;
}

export interface EnsureBuiltMarketplaceRequest {
  readonly projectRoot: string;
  readonly marketplace: MarketplaceToBuild;
  readonly target: AiToolId;
  readonly mode: FrameworkBuildMode;
  readonly forceRefresh?: boolean;
}

export interface EnsureBuiltMarketplaceResult {
  readonly builtDir: string;
  readonly version: string | undefined;
  readonly rebuilt: boolean;
}

/** Where a marketplace's source landed on this machine, and the version its catalog declares. The
 * distribution resolves it and hands over the real one, which satisfies this shape. */
export interface ResolvedMarketplace {
  readonly localPath: string;
  readonly catalog: { readonly version?: string } | null;
}

/**
 * Guarantees a per-target built tree exists in cache, so install consumers read the same
 * transformed content a build produces: resolves the source, then caches its build.
 */
export interface BuiltMarketplaceEnsurer {
  readonly execute: (
    options: EnsureBuiltMarketplaceRequest
  ) => Promise<EnsureBuiltMarketplaceResult>;
}
