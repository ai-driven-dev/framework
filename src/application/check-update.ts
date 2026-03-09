import type { FrameworkResolver } from "../domain/ports/framework-resolver.js";
import type { Logger } from "../domain/ports/logger.js";
import type { ManifestRepository } from "../domain/ports/manifest-repository.js";
import { compareSemver } from "./use-cases/status-use-case.js";

function isOutdated(version: string, latest: string): boolean {
  const clean = version.replace(/^v/, "");
  return /^\d+\.\d+\.\d+$/.test(clean) && compareSemver(clean, latest) < 0;
}

export async function printUpdateBanner(
  resolver: FrameworkResolver,
  manifestRepo: ManifestRepository,
  logger: Logger
): Promise<void> {
  try {
    const manifest = await manifestRepo.load();
    if (manifest === null) return;

    const docsVersion = manifest.getDocsVersion();
    const toolVersion = manifest
      .getInstalledToolIds()
      .map((id) => manifest.getToolVersion(id))
      .find(Boolean);

    const anyVersion = docsVersion ?? toolVersion;
    if (!anyVersion) return;

    const latest = (await resolver.fetchLatestVersion()).replace(/^v/, "");

    const docsOutdated = docsVersion !== undefined && isOutdated(docsVersion, latest);
    const toolsOutdated = toolVersion !== undefined && isOutdated(toolVersion, latest);

    if (!docsOutdated && !toolsOutdated) return;

    const current = (docsVersion ?? toolVersion)?.replace(/^v/, "");
    logger.info(`\nUpdate available: v${current} → v${latest}`);
    if (docsOutdated) logger.info("Run `aidd init --force` to update docs.");
    if (toolsOutdated) logger.info("Run `aidd install --all` to update tools.");
  } catch {
    // silent — best-effort check
  }
}
