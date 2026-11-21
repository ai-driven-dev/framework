import { join } from "node:path";
import { BUILT_CACHE_SUBDIR } from "../../../../shared/domain/layout/aidd-layout.js";
import type { ToolId } from "../../../../shared/domain/tool.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { Logger } from "../../../../shared/ports/logger.js";
import type { ListedMarketplace } from "../../ports/marketplace-listing.js";
import type { PurgeDeclaredCache } from "../purge-declared-cache.js";
import type { RecordSourceReference } from "../record-source-reference.use-case.js";
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
export type SharedFrameworkSourceRequest =
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

export interface SharedFrameworkSourceDeps {
  readonly fs: FileReader & FileWriter;
  readonly logger: Logger;
  /** Records this project against the running version's shared source, when the machine keeps
   * that record. */
  readonly recordReference: Pick<RecordSourceReference, "execute">;
  readonly purgeCache: Pick<PurgeDeclaredCache, "resolveCandidate">;
  /** The name the framework marketplace is registered under; the distribution owns it and
   * composition hands it over. */
  readonly frameworkMarketplaceName: string;
}

/** The machine's shared framework source and this project's own pre-migration copy of it. */
export class SharedFrameworkSource {
  constructor(private readonly deps: SharedFrameworkSourceDeps) {}

  execute(request: SharedFrameworkSourceRequest): Promise<void> {
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
  }: Extract<SharedFrameworkSourceRequest, { kind: "purge-stale-project-cache" }>): Promise<void> {
    if (activation.errors.length > 0) return;
    const framework = marketplaces.find((m) =>
      frameworkSourceIsShared(m.name, m.scope, this.deps.frameworkMarketplaceName)
    );
    if (framework === undefined) return;
    if (activation.binaryMissing.length > 0) {
      this.deps.logger.warn({
        text:
          "This project's own pre-migration framework cache kept: a requested tool's CLI " +
          "was not on PATH this run, so its own registration may still point at it",
        hint: "sync-after-path",
      });
      return;
    }
    if ([...activation.outcomes.values()].some((outcome) => outcome.buildFailed)) {
      this.deps.logger.warn({
        text:
          "This project's own pre-migration framework cache kept: a requested tool's build " +
          "failed this run, so its own registration may still point at it",
        hint: "sync-after-build",
      });
      return;
    }
    const candidate = await this.deps.purgeCache.resolveCandidate(
      projectRoot,
      join(BUILT_CACHE_SUBDIR, this.deps.frameworkMarketplaceName),
      "This project's own pre-migration framework cache"
    );
    if (candidate === null) return;
    await this.deps.fs.deleteDirectory(candidate);
    this.deps.logger.info(`This project's own pre-migration framework cache purged: ${candidate}`);
  }

  /**
   * Refreshed only after native activation proves that the host uses the shared source.
   */
  private async recordSharedSourceReference({
    projectRoot,
    marketplaces,
    outcomes,
  }: Extract<SharedFrameworkSourceRequest, { kind: "record-reference" }>): Promise<void> {
    const framework = marketplaces.find((m) =>
      frameworkSourceIsShared(m.name, m.scope, this.deps.frameworkMarketplaceName)
    );
    if (framework === undefined) return;
    if (
      ![...outcomes.values()].some((outcome) =>
        outcome.marketplaces.some((registration) => registration.alias === framework.name)
      )
    )
      return;
    await this.deps.recordReference.execute({ projectRoot, marketplace: framework });
  }
}
