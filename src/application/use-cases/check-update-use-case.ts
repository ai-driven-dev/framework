import { compareSemver, isSemver } from "../../domain/models/semver.js";
import type { Logger } from "../../domain/ports/logger.js";
import type { SelfUpdater } from "../../domain/ports/self-updater.js";
import type { VersionReader } from "../../domain/ports/version-reader.js";

function isOutdated(version: string, latest: string): boolean {
  return isSemver(version) && compareSemver(version, latest) < 0;
}

export async function printUpdateBanner(
  cliUpdater: SelfUpdater,
  currentVersionProvider: VersionReader,
  logger: Logger,
  skipCliCheck = false
): Promise<void> {
  if (skipCliCheck) return;
  try {
    const current = currentVersionProvider.get();
    const { version: latest } = await cliUpdater.fetchLatestRelease();
    if (isOutdated(current, latest)) {
      logger.warn(
        `CLI update available: v${current.replace(/^v/, "")} → v${latest.replace(/^v/, "")}`
      );
      logger.warn("Run `aidd self-update`.");
    }
  } catch (err) {
    logger.debug(`CLI update check failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}
