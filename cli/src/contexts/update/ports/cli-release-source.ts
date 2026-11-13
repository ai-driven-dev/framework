export interface CliRelease {
  version: string;
  /** `null` where the release body could not be read — a private repository with no token. */
  changelog: string | null;
}

/** Where the latest release of the CLI is announced. */
export interface CliReleaseSource {
  fetchLatestRelease(): Promise<CliRelease>;
}
