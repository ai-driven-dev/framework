import type { RepositoryAliases } from "../legacy/repository-aliases.js";

/** The table of ids an earlier version gave repositories, beside the ledger. */
export interface RepositoryAliasStore {
  /** `null` when there is none yet. */
  load(): Promise<RepositoryAliases | null>;
  save(aliases: RepositoryAliases): Promise<void>;
}
