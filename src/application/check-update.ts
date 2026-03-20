import { compareSemver, isSemver } from "../domain/models/semver.js";
import type { CliUpdater } from "../domain/ports/cli-updater.js";
import type { CurrentVersionProvider } from "../domain/ports/current-version-provider.js";
import type { FrameworkResolver } from "../domain/ports/framework-resolver.js";
import type { Logger } from "../domain/ports/logger.js";
import type { ManifestRepository } from "../domain/ports/manifest-repository.js";

function isOutdated(version: string, latest: string): boolean {
  return isSemver(version) && compareSemver(version, latest) < 0;
}

export async function printUpdateBanner(
  cliUpdater: CliUpdater,
  currentVersionProvider: CurrentVersionProvider,
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

    const docsVersion = manifest.getDocsVersion();
    const toolVersion = manifest
      .getInstalledToolIds()
      .map((id) => manifest.getToolVersion(id))
      .find(Boolean);

    if (!docsVersion && !toolVersion) return;

    const latest = await resolver.fetchLatestVersion();

    const docsOutdated = docsVersion !== undefined && isOutdated(docsVersion, latest);
    const toolsOutdated = toolVersion !== undefined && isOutdated(toolVersion, latest);

    if (!docsOutdated && !toolsOutdated) return;

    const current = (docsVersion ?? toolVersion) as string;
    logger.warn(`Update available: v${current.replace(/^v/, "")} → v${latest.replace(/^v/, "")}`);
    logger.warn("Run `aidd update` to update.");
  } catch (err) {
    logger.debug(
      `Framework update check failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}
