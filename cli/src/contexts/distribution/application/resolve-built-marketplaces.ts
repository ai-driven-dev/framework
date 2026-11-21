import { resolve } from "node:path";
import {
  builtMarketplaceDir,
  userBuiltMarketplaceDir,
} from "../../../shared/domain/layout/aidd-layout.js";
import type { AiToolId } from "../../../shared/domain/tool.js";
import type { FileReader } from "../../../shared/ports/file-reader.js";
import type { VersionReader } from "../../../shared/ports/version-reader.js";
import type { BuiltMarketplace, MarketplaceBuilds } from "../contract/built-marketplaces.js";
import { FRAMEWORK_MARKETPLACE_NAME } from "../contract/marketplace.js";
import type { Marketplace } from "../domain/marketplace.js";
import type { MarketplaceRegistry } from "../ports/marketplace-registry.js";

export interface ResolveBuiltMarketplacesCommand {
  projectRoot: string;
  toolIds: readonly AiToolId[];
}

export interface ResolveBuiltMarketplacesDeps {
  readonly fs: FileReader;
  readonly registry: MarketplaceRegistry;
  /** Root of a user-scope marketplace's built tree, mirroring `CacheBuiltMarketplace`'s own
   * `userCacheRoot`. No default: a caller with nothing real to pass would silently recompute a
   * path this run never built. */
  readonly userCacheRoot: () => string;
  /** This run's own CLI version: the shared source is one directory per version, so recomputing
   * the expected path needs the same version a build would use. No default: an empty version
   * collapses `join(…, "", …)` to the pre-version path shape, a different, wrong path silently
   * recomputed rather than a failure. */
  readonly currentVersion: VersionReader;
}

/**
 * Recomputes, never reads back, where each registered marketplace was built for each tool:
 * `builtMarketplaceDir` and `userBuiltMarketplaceDir` are the same pure functions
 * `CacheBuiltMarketplace` calls to decide where it builds, so nothing here triggers a build.
 */
export class ResolveBuiltMarketplaces {
  constructor(private readonly deps: ResolveBuiltMarketplacesDeps) {}

  async execute(command: ResolveBuiltMarketplacesCommand): Promise<MarketplaceBuilds> {
    const registered = await this.deps.registry.list(command.projectRoot);
    const built = new Map<AiToolId, readonly BuiltMarketplace[]>();
    for (const toolId of command.toolIds) {
      const marketplaces: BuiltMarketplace[] = [];
      for (const marketplace of registered) {
        const builtDir = await this.resolvedBuiltDir(command.projectRoot, marketplace, toolId);
        if (builtDir !== undefined) marketplaces.push({ name: marketplace.name, builtDir });
      }
      built.set(toolId, marketplaces);
    }
    return {
      registeredNames: registered.map((m) => m.name),
      userCacheRoot: this.deps.userCacheRoot(),
      built,
    };
  }

  /**
   * `undefined` when nothing resolves at the computed path, which means either it was never built
   * or it no longer exists: neither a fact a check may turn into a conflict.
   *
   * The reserved framework name always resolves to the shared, machine-scope path, even where the
   * registry still records `scope: "project"`: honouring that record would compute the
   * pre-migration path as "expected", which the host's own registration already matches, and
   * doctor would report nothing wrong in the one state it most needs to name. Every other
   * marketplace still resolves by its own recorded `scope`.
   */
  private async resolvedBuiltDir(
    projectRoot: string,
    marketplace: Marketplace,
    toolId: AiToolId
  ): Promise<string | undefined> {
    const raw =
      marketplace.scope === "user" || marketplace.name === FRAMEWORK_MARKETPLACE_NAME
        ? userBuiltMarketplaceDir({
            userConfigDir: this.deps.userCacheRoot(),
            cliVersion: this.deps.currentVersion.get(),
            marketplaceName: marketplace.name,
            target: toolId,
          })
        : builtMarketplaceDir(projectRoot, marketplace.name, toolId);
    return this.deps.fs.realpath(resolve(raw)).catch(() => undefined);
  }
}
