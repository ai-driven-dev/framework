export interface ReleaseLister {
  /** Every release tag of `repo`, newest first. The root release rule is distribution's
   * (`rootReleaseTags`). */
  listReleaseTags(repo: string): Promise<string[]>;

  /** The notes of the release tagged `tag`, or null when the repository has no such release or
   * a release without notes. */
  readReleaseBody(repo: string, tag: string): Promise<string | null>;
}
