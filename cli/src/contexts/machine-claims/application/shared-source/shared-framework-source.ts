import { join } from "node:path";
import { BUILT_CACHE_SUBDIR } from "../../../../shared/domain/layout/aidd-layout.js";
import type { ToolId } from "../../../../shared/domain/tool.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { Logger } from "../../../../shared/ports/logger.js";
import type { ListedMarketplace } from "../../ports/marketplace-listing.js";
import type { PurgeDeclaredCache } from "../purge-declared-cache.js";
import type { RecordSourceReference } from "../record-source-reference.js";
import { frameworkSourceIsShared } from "../shared-source-reference-support.js";

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

/** What the shared source is asked after native activation: to be recorded as referenced by this
 * project, or to have this project's own pre-migration copy of it purged. */
export type SharedSourceRequest =
  | {
      readonly kind: "record-reference";
      readonly projectRoot: string;
      readonly marketplaces: readonly ListedMarketplace[];
      readonly outcomes: ReadonlyMap<ToolId, RegistrationEvidence>;
    }
  | {
      readonly kind: "purge-stale-project-cache";
      readonly projectRoot: string;
      readonly marketplaces: readonly ListedMarketplace[];
      readonly activation: ActivationEvidence;
    };

/** The machine's shared framework source and this project's own pre-migration copy of it. */
export class SharedFrameworkSource {
  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly logger: Logger,
    /** Records this project against the running version's shared source, when the machine keeps
     * that record. */
    private readonly recordReference: Pick<RecordSourceReference, "execute">,
    private readonly purgeCache: Pick<PurgeDeclaredCache, "resolveCandidate">,
    /** The name the framework marketplace is registered under; the distribution owns it and
     * composition hands it over. */
    private readonly frameworkMarketplaceName: string
  ) {}

  execute(request: SharedSourceRequest): Promise<void> {
    return request.kind === "record-reference"
      ? this.recordSharedSourceReference(request)
      : this.purgeStaleProjectCache(request);
  }

  /**
   * Never run before every tool's own native activation: a host's CLI needs the tree it is
   * unregistering from to still exist, and a binary off `PATH` or a failed build can leave a
   * registration still naming this project's own pre-migration cache. `resolveCacheCandidate`
   * refuses anything that does not `realpath` strictly inside `projectRoot`.
   */
  private async purgeStaleProjectCache({
    projectRoot,
    marketplaces,
    activation,
  }: Extract<SharedSourceRequest, { kind: "purge-stale-project-cache" }>): Promise<void> {
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
  private async recordSharedSourceReference({
    projectRoot,
    marketplaces,
    outcomes,
  }: Extract<SharedSourceRequest, { kind: "record-reference" }>): Promise<void> {
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
    await this.recordReference.execute({ projectRoot, marketplace: framework });
  }
}
