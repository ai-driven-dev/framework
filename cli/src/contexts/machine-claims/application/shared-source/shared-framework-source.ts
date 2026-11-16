import { join } from "node:path";
import { BUILT_CACHE_SUBDIR } from "../../../../shared/domain/paths.js";
import type { ToolId } from "../../../../shared/domain/tool.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { Logger } from "../../../../shared/ports/logger.js";
import type { VersionReader } from "../../../../shared/ports/version-reader.js";
import type { ListedMarketplace } from "../../ports/marketplace-listing.js";
import type { UserSourceReferences } from "../../ports/user-source-references.js";
import type { PurgeDeclaredCache } from "../purge-declared-cache.js";
import {
  frameworkSourceIsShared,
  resolveProjectRootForReferences,
  toleratingUnreadableSourceReferences,
} from "../shared-source-reference-support.js";

/** What one tool's host registration observed, as far as the shared source is concerned. */
interface RegistrationEvidence {
  readonly buildFailed: boolean;
  readonly marketplaces: readonly { readonly alias: string }[];
}

/** How a pass of native activation went, as far as the shared source is concerned. */
export interface ActivationEvidence {
  readonly outcomes: ReadonlyMap<ToolId, RegistrationEvidence>;
  readonly binaryMissing: readonly unknown[];
  readonly errors: readonly unknown[];
}

/** Where this machine records which projects use the shared source, and the version it names. */
export interface SharedSourceReferences {
  readonly store: UserSourceReferences;
  readonly version: VersionReader;
}

/** The machine's shared framework source and this project's own pre-migration copy of it. */
export class SharedFrameworkSource {
  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly logger: Logger,
    private readonly references: SharedSourceReferences | undefined,
    private readonly purgeCache: Pick<PurgeDeclaredCache, "resolveCandidate">,
    /** The name the framework marketplace is registered under; the distribution owns it and
     * composition hands it over. */
    private readonly frameworkMarketplaceName: string
  ) {}

  /**
   * Never run before every tool's own native activation: a host's CLI needs the tree it is
   * unregistering from to still exist, and a binary off `PATH` or a failed build can leave a
   * registration still naming this project's own pre-migration cache. `resolveCacheCandidate`
   * refuses anything that does not `realpath` strictly inside `projectRoot`.
   */
  async purgeStaleProjectCache(
    projectRoot: string,
    marketplaces: readonly ListedMarketplace[],
    activation: ActivationEvidence
  ): Promise<void> {
    if (activation.errors.length > 0) return;
    const framework = marketplaces.find((m) =>
      frameworkSourceIsShared(m.name, m.scope, this.frameworkMarketplaceName)
    );
    if (framework === undefined) return;
    if (activation.binaryMissing.length > 0) {
      this.logger.warn(
        "This project's own pre-migration framework cache kept: a requested tool's CLI " +
          "was not on PATH this run, so its own registration may still point at it — run " +
          "`aidd sync` again once every tool's CLI is on PATH."
      );
      return;
    }
    if ([...activation.outcomes.values()].some((outcome) => outcome.buildFailed)) {
      this.logger.warn(
        "This project's own pre-migration framework cache kept: a requested tool's build " +
          "failed this run, so its own registration may still point at it — fix the build " +
          "warning above, then run `aidd sync` again."
      );
      return;
    }
    const candidate = await this.purgeCache.resolveCandidate(
      projectRoot,
      join(BUILT_CACHE_SUBDIR, this.frameworkMarketplaceName),
      "This project's own pre-migration framework cache"
    );
    if (candidate === null) return;
    await this.fs.deleteDirectory(candidate);
    this.logger.info(`This project's own pre-migration framework cache purged: ${candidate}`);
  }

  /**
   * Refreshed only after native activation proves that the host uses the shared source.
   */
  async recordSharedSourceReference(
    projectRoot: string,
    marketplaces: readonly ListedMarketplace[],
    outcomes: ReadonlyMap<ToolId, RegistrationEvidence>
  ): Promise<void> {
    if (this.references === undefined) return;
    const framework = marketplaces.find((m) =>
      frameworkSourceIsShared(m.name, m.scope, this.frameworkMarketplaceName)
    );
    if (framework === undefined) return;
    if (
      ![...outcomes.values()].some((outcome) =>
        outcome.marketplaces.some((registration) => registration.alias === framework.name)
      )
    )
      return;
    await this.recordReferenceForRoot(projectRoot);
  }

  private async recordReferenceForRoot(root: string): Promise<void> {
    const references = this.references;
    if (references === undefined) return;
    await toleratingUnreadableSourceReferences(this.logger, undefined, async () => {
      const resolvedRoot = await resolveProjectRootForReferences(this.fs, root);
      await references.store.addReference(references.version.get(), resolvedRoot);
    });
  }
}
