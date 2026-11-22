import { join } from "node:path";
import type { PrivateStorage } from "../../../../../shared/ports/private-storage.js";
import {
  parseResolutions,
  type RepositoryResolution,
  renderResolutions,
} from "../../../domain/repository-resolution.js";
import type { ResolutionStore } from "../../../ports/resolution-store.js";
import type { RepositoryAliasStoreAdapter } from "../../legacy/repository-alias-store-adapter.js";
import { readTextIfPresent } from "../../reading/text-file.js";

/** `roots.json`, beside the ledger. */
export class ResolutionStoreAdapter implements ResolutionStore {
  private readonly path: string;

  /** `aliases` is this directory's table, read at every load. */
  constructor(
    private readonly ledgerDir: string,
    private readonly storage: PrivateStorage,
    private readonly aliases: RepositoryAliasStoreAdapter
  ) {
    this.path = join(ledgerDir, "roots.json");
  }

  /** Each repository by its id of now (see `RepositoryAliasStore`). */
  async load(): Promise<Map<string, RepositoryResolution>> {
    const ids = await this.aliases.load();
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
