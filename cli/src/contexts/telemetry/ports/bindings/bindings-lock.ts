/** Serialises the writers of the bindings directory (session declarations, branch snapshots),
 * apart from the ledger's lock: a declaration is a few lines appended, and must never wait for
 * an ingest that holds the ledger for as long as it reads transcripts. */
export interface BindingsLock {
  /** Runs `work` while no other process writes the bindings. Not re-entrant. */
  exclusively<T>(work: () => Promise<T>): Promise<T>;
}
