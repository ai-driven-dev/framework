export interface ReleaseLister {
  /** Bare `v<semver>` tags only, newest first: release-please's per-component tags are not
   * install units, since the marketplace manifest lives at the repository root. */
  listRootReleases(repo: string): Promise<string[]>;
}
