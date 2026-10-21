import { join } from "node:path";
import { readTextIfPresent } from "../../../kernel/reading/text-file.js";
import type { PrivateStorage } from "../domain/ports/private-storage.js";
import type { ResolutionStore } from "../domain/ports/resolution-store.js";
import {
  parseResolutions,
  type RepositoryResolution,
  renderResolutions,
} from "../domain/repository-resolution.js";
import { RepositoryAliasStoreAdapter } from "./legacy/repository-alias-store-adapter.js";

/** `roots.json`, beside the ledger. */
export class ResolutionStoreAdapter implements ResolutionStore {
  private readonly path: string;
  private readonly aliases: RepositoryAliasStoreAdapter;

  constructor(
    private readonly ledgerDir: string,
    private readonly storage: PrivateStorage
  ) {
    this.path = join(ledgerDir, "roots.json");
    // Its own directory's table, read at every load: no wiring can leave it out.
    this.aliases = new RepositoryAliasStoreAdapter(ledgerDir, storage);
  }

  /** Each repository by its id of now (see `RepositoryAliasStore`). */
  async load(): Promise<Map<string, RepositoryResolution>> {
    const ids = (await this.aliases.load())?.ids;
    const held = parseResolutions(await readTextIfPresent(this.path));
    for (const [key, resolution] of held) {
      const id = ids?.get(resolution.repository_id);
      if (id !== undefined) held.set(key, { ...resolution, repository_id: id });
    }
    return held;
  }

  async save(resolutions: ReadonlyMap<string, RepositoryResolution>): Promise<void> {
    await this.storage.ensureDirectory(this.ledgerDir);
    await this.storage.replace(this.path, renderResolutions(resolutions));
  }
}
