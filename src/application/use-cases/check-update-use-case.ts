import { compareSemver, isSemver } from "../../domain/models/semver.js";
import type { FrameworkResolver } from "../../domain/ports/framework-resolver.js";
import type { Logger } from "../../domain/ports/logger.js";
import type { ManifestRepository } from "../../domain/ports/manifest-repository.js";
import type { SelfUpdater } from "../../domain/ports/self-updater.js";
import type { VersionReader } from "../../domain/ports/version-reader.js";

function isOutdated(version: string, latest: string): boolean {
  return isSemver(version) && compareSemver(version, latest) < 0;
}

export async function printUpdateBanner(
  cliUpdater: SelfUpdater,
  currentVersionProvider: VersionReader,
  resolver: FrameworkResolver,
  manifestRepo: ManifestRepository,
  logger: Logger,
  skipCliCheck = false,
  skipFrameworkCheck = false
): Promise<void> {
  if (!skipCliCheck) {
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

  if (skipFrameworkCheck) return;

  try {
    const manifest = await manifestRepo.load();
    if (manifest === null) return;

    const toolVersion = manifest
      .getInstalledToolIds()
      .map((id) => manifest.getToolVersion(id))
      .find(Boolean);

    if (!toolVersion) return;

    const latest = await resolver.fetchLatestVersion();

    if (!isOutdated(toolVersion, latest)) return;

    logger.warn(
      `Update available: v${toolVersion.replace(/^v/, "")} → v${latest.replace(/^v/, "")}`
    );
    logger.warn("Run `aidd update` to update.");
  } catch (err) {
    logger.debug(
      `Framework update check failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}
