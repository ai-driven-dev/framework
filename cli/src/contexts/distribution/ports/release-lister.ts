export interface ReleaseLister {
  /** Every release tag of `repo`, newest first. The root release rule is distribution's
   * (`rootReleaseTags`). */
  listReleaseTags(repo: string): Promise<string[]>;
}
