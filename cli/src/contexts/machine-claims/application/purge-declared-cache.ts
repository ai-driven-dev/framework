import { join } from "node:path";
import { describeError } from "../../../shared/domain/describe-error.js";
import type { FileReader } from "../../../shared/ports/file-reader.js";
import type { Logger } from "../../../shared/ports/logger.js";
import { isStrictlyWithinUserScope } from "../domain/user-scope-containment.js";

/**
 * Proves a path a manifest names sits inside the cache that owns it, before anything deletes it.
 */
export class PurgeDeclaredCache {
  constructor(
    private readonly fs: FileReader,
    private readonly logger: Logger
  ) {}

  /**
   * Returns `<cacheRoot>/<relativeSegments>` once its real, `realpath`-resolved location is proven
   * to sit strictly inside `cacheRoot` — never on the manifest's word alone, since
   * `relativeSegments` is data a corrupted entry could carry a `..` segment in, or a path a
   * symlink could have escaped through after install. `null` for a root or candidate that does
   * not exist (silent), a `realpath` that failed for any other reason (named and kept), or one
   * resolving outside it (named and kept).
   */
  async resolveCandidate(
    cacheRoot: string,
    relativeSegments: string,
    label: string
  ): Promise<string | null> {
    const candidate = join(cacheRoot, relativeSegments);
    let resolvedBoundary: string | null;
    let resolvedCandidate: string | null;
    try {
      resolvedBoundary = await this.tryRealpath(cacheRoot);
      if (resolvedBoundary === null) return null;
      resolvedCandidate = await this.tryRealpath(candidate);
    } catch (error) {
      this.logger.warn(
        `${label} could not be resolved, ${candidate}: ${describeError(error)}; left in place.`
      );
      return null;
    }
    if (resolvedCandidate === null) return null;
    if (!isStrictlyWithinUserScope(resolvedCandidate, resolvedBoundary)) {
      this.logger.warn(
        `${label} does not resolve inside ${cacheRoot}; left in place: ${candidate}`
      );
      return null;
    }
    return candidate;
  }

  private async tryRealpath(path: string): Promise<string | null> {
    try {
      return await this.fs.realpath(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }
}
