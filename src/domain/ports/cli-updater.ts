export interface CliRelease {
  version: string;
  changelog: string;
}

export interface CliUpdater {
  fetchLatestRelease(): Promise<CliRelease>;
  install(): void;
}
