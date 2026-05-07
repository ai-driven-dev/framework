import { compareSemver, isSemver } from "../../domain/models/semver.js";
import type { Logger } from "../../domain/ports/logger.js";
import type { SelfUpdater } from "../../domain/ports/self-updater.js";
import type { VersionReader } from "../../domain/ports/version-reader.js";

interface CheckUpdateOptions {
  skipCliCheck?: boolean;
}

function isOutdated(version: string, latest: string): boolean {
  return isSemver(version) && compareSemver(version, latest) < 0;
}

export class CheckUpdateUseCase {
  constructor(
    private readonly cliUpdater: SelfUpdater,
    private readonly versionReader: VersionReader,
    private readonly logger: Logger
  ) {}

  async execute(options: CheckUpdateOptions = {}): Promise<void> {
    if (options.skipCliCheck) return;
    try {
      const current = this.versionReader.get();
      const { version: latest } = await this.cliUpdater.fetchLatestRelease();
      if (isOutdated(current, latest)) {
        this.logger.warn(
          `CLI update available: v${current.replace(/^v/, "")} → v${latest.replace(/^v/, "")}`
        );
        this.logger.warn("Run `aidd self-update`.");
      }
    } catch (err) {
      this.logger.debug(
        `CLI update check failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}
