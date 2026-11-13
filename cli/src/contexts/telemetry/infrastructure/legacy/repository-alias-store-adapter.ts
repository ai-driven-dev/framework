import { join } from "node:path";
import {
  parseRepositoryAliases,
  type RepositoryAliases,
  renderRepositoryAliases,
} from "../../domain/legacy/repository-aliases.js";
import type { PrivateStorage } from "../../domain/ports/private-storage.js";
import type { RepositoryAliasStore } from "../../domain/ports/repository-alias-store.js";
import { readTextIfPresent } from "../reading/text-file.js";

/** `repository-ids.json`, beside the ledger. */
export class RepositoryAliasStoreAdapter implements RepositoryAliasStore {
  private readonly path: string;

  constructor(
    private readonly ledgerDir: string,
    private readonly storage: PrivateStorage
  ) {
    this.path = join(ledgerDir, "repository-ids.json");
  }

  async load(): Promise<RepositoryAliases | null> {
    return parseRepositoryAliases(await readTextIfPresent(this.path));
  }

  async save(aliases: RepositoryAliases): Promise<void> {
    await this.storage.ensureDirectory(this.ledgerDir);
    await this.storage.replace(this.path, renderRepositoryAliases(aliases));
  }
}
