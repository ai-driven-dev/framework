export interface HookCleanup {
  /** The line that called the trailer delegate was taken out of `prepare-commit-msg`. */
  readonly lineRemoved: boolean;
  /** The delegate script was removed, which happens only once nothing calls it. */
  readonly delegateRemoved: boolean;
  /** What still calls a delegate that therefore stays: a person has to remove these. */
  readonly stillCalledBy: readonly string[];
}

/** What the previous measurement left in a repository's commit hooks. */
export interface LegacyHookCleaner {
  /** Removes the line and the script it called as one step: the script goes only when the line
   * and every other caller is gone, because a line calling a missing script fails every
   * commit. */
  clean(root: string): Promise<HookCleanup>;
}
