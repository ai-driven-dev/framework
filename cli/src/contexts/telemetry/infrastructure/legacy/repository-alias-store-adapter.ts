import { join } from "node:path";
import { parseRepositoryAliases } from "../../domain/legacy/repository-aliases.js";
import type { RepositoryAliasStore } from "../../ports/repository-alias-store.js";
import { readTextIfPresent } from "../reading/text-file.js";

/** `repository-ids.json`, beside the ledger: read, never written. */
export class RepositoryAliasStoreAdapter implements RepositoryAliasStore {
  private readonly path: string;

  constructor(ledgerDir: string) {
    this.path = join(ledgerDir, "repository-ids.json");
  }

  async load(): Promise<ReadonlyMap<string, string> | null> {
    return parseRepositoryAliases(await readTextIfPresent(this.path));
  }
}
