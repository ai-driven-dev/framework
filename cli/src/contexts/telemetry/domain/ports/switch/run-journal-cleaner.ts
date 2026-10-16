export interface JournalCleanup {
  readonly journalRemoved: boolean;
  /** Files of the journal that git tracks, which are left where they are. */
  readonly trackedKept: boolean;
  readonly ignoreEntryRemoved: boolean;
}

/** The previous measurement's journal in a repository, and the ignore entry that hid it. */
export interface RunJournalCleaner {
  clean(root: string): Promise<JournalCleanup>;
}
