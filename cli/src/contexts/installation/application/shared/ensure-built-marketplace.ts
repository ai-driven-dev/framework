import type { AiToolId } from "../../../../shared/domain/tool.js";
import type { FrameworkBuildMode } from "../../../tools/contract/tool-profile.js";
import type { DeclaredMarketplace } from "../../ports/marketplace-sources.js";

/** One framework build, as the cache runs it. Its result is not read. */
export interface FrameworkBuild {
  execute(options: {
    readonly sourceDir: string;
    readonly outDir: string;
    readonly target: AiToolId;
    readonly mode?: FrameworkBuildMode;
  }): Promise<unknown>;
}

/** The framework builds of every target, and what one target's build differs by. */
export interface FrameworkBuilds {
  /** What a target's built tree carries beyond its source, such as the provider its agents run
   * on, or `undefined` when nothing. A changed variant makes a cached tree stale. */
  variant(target: AiToolId): Promise<string | undefined>;
  /** `undefined` when the target/mode pair has no build. */
  buildFor(
    target: AiToolId,
    mode: FrameworkBuildMode,
    outDir: string,
    variant?: string
  ): FrameworkBuild | undefined;
}

export interface EnsureBuiltMarketplaceCommand {
  readonly projectRoot: string;
  readonly marketplace: DeclaredMarketplace;
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
    options: EnsureBuiltMarketplaceCommand
  ) => Promise<EnsureBuiltMarketplaceResult>;
}
