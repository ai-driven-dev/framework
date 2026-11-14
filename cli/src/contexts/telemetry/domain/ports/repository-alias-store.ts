/** The table of ids an earlier version gave repositories, as it wrote it beside the ledger. */
export interface RepositoryAliasStore {
  /** `null` when there is none. */
  load(): Promise<ReadonlyMap<string, string> | null>;
}
