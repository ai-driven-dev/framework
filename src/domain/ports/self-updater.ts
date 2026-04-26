export interface CliRelease {
  version: string;
  changelog: string;
}

export interface SelfUpdater {
  fetchLatestRelease(): Promise<CliRelease>;
  install(): string;
}
