import type { CliReleaseSource } from "../ports/cli-release-source.js";
import type { UpdateCheckCache } from "../ports/update-check-cache.js";

/** Asks what the latest release is and keeps the answer for the next run's notice. */
export class RefreshUpdateCheck {
  constructor(
    private readonly releases: CliReleaseSource,
    private readonly cache: UpdateCheckCache,
    private readonly now: () => number
  ) {}

  async execute(): Promise<void> {
    const { version } = await this.releases.fetchLatestRelease();
    await this.cache.write({ checkedAt: this.now(), latest: version });
  }
}
