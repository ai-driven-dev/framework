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
  logger: Logger
): Promise<void> {
  try {
    const current = currentVersionProvider.get();
    const { version: latest } = await cliUpdater.fetchLatestRelease();
    if (isOutdated(current, latest)) {
      logger.info(
        `\nCLI update available: v${current.replace(/^v/, "")} → v${latest.replace(/^v/, "")}`
      );
      logger.info("Run `aidd self-update`.");
    }
  } catch {
    // silent — best-effort check
  }

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
    logger.info(`\nUpdate available: v${current.replace(/^v/, "")} → v${latest.replace(/^v/, "")}`);
    if (docsOutdated && toolsOutdated) logger.info("Run `aidd update` to update docs and tools.");
    else if (docsOutdated) logger.info("Run `aidd update --docs` to update docs.");
    else if (toolsOutdated) logger.info("Run `aidd update` to update tools.");
  } catch {
    // silent — best-effort check
  }
}
