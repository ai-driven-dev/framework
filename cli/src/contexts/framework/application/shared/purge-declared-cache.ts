import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { Logger } from "../../../../shared/ports/logger.js";
import { PurgeDeclaredCache } from "../../../machine-claims/application/purge-declared-cache.js";

/** `<cacheRoot>/<relativeSegments>` once proven to sit inside `cacheRoot`, else `null`. The
 * plugin remove and the marketplace settings sync still call it here, until each moves out. */
export function resolveCacheCandidate(
  fs: FileReader,
  logger: Logger,
  cacheRoot: string,
  relativeSegments: string,
  label: string
): Promise<string | null> {
  return new PurgeDeclaredCache(fs, logger).resolveCandidate(cacheRoot, relativeSegments, label);
}
