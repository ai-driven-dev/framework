import type { CliReleaseSource } from "../ports/cli-release-source.js";
import type { UpdateCheckCache } from "../ports/update-check-cache.js";

/** What was kept for the next run's notice. */
export interface RefreshUpdateCheckResult {
  checkedAt: number;
  latest: string;
}

/** Asks what the latest release is and keeps the answer for the next run's notice. */
export class RefreshUpdateCheck {
  constructor(
    private readonly releases: CliReleaseSource,
    private readonly cache: UpdateCheckCache,
    private readonly now: () => number
  ) {}

  async execute(): Promise<RefreshUpdateCheckResult> {
    const { version } = await this.releases.fetchLatestRelease();
    const kept = { checkedAt: this.now(), latest: version };
    await this.cache.write(kept);
    return kept;
  }
}
