import { join } from "node:path";
import { isStrictlyWithin } from "../../../shared/domain/paths.model.js";
import type { FileReader } from "../../../shared/ports/file-reader.js";
import type { Logger } from "../../../shared/ports/logger.js";

/**
 * Proves a path a manifest names sits inside the cache that owns it, before anything deletes it.
 */
export class ResolvePurgeCandidate {
  constructor(
    private readonly fs: FileReader,
    private readonly logger: Logger
  ) {}

  /**
   * Returns `<cacheRoot>/<relativeSegments>` once its real, `realpath`-resolved location is proven
   * to sit strictly inside `cacheRoot`: never on the manifest's word alone, since
   * `relativeSegments` is data a corrupted entry could carry a `..` segment in, or a path a
   * symlink could have escaped through after install. `null` for a root or candidate that does not
   * exist (silent), a candidate present but unresolvable (named and kept), or one resolving
   * outside it (named and kept).
   */
  async execute(
    cacheRoot: string,
    relativeSegments: string,
    label: string
  ): Promise<string | null> {
    const candidate = join(cacheRoot, relativeSegments);
    const resolvedBoundary = await this.fs.realpathIfResolvable(cacheRoot);
    if (resolvedBoundary === undefined) return null;
    const resolvedCandidate = await this.fs.realpathIfResolvable(candidate);
    if (resolvedCandidate === undefined) {
      if (await this.fs.isDirectory(candidate)) {
        this.logger.warn(`${label} could not be resolved, ${candidate}; left in place.`);
      }
      return null;
    }
    if (!isStrictlyWithin(resolvedCandidate, resolvedBoundary)) {
      this.logger.warn(
        `${label} does not resolve inside ${cacheRoot}; left in place: ${candidate}`
      );
      return null;
    }
    return candidate;
  }
}
