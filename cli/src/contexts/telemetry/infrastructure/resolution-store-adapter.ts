import { join } from "node:path";
import { readTextIfPresent } from "../../../kernel/reading/text-file.js";
import type { PrivateStorage } from "../domain/ports/private-storage.js";
import type { ResolutionStore } from "../domain/ports/resolution-store.js";
import {
  parseResolutions,
  type RepositoryResolution,
  renderResolutions,
} from "../domain/repository-resolution.js";

/** `roots.json`, beside the ledger. */
export class ResolutionStoreAdapter implements ResolutionStore {
  private readonly path: string;

  constructor(
    private readonly ledgerDir: string,
    private readonly storage: PrivateStorage
  ) {
    this.path = join(ledgerDir, "roots.json");
  }

  async load(): Promise<Map<string, RepositoryResolution>> {
    return parseResolutions(await readTextIfPresent(this.path));
  }

  async save(resolutions: ReadonlyMap<string, RepositoryResolution>): Promise<void> {
    await this.storage.ensureDirectory(this.ledgerDir);
    await this.storage.replace(this.path, renderResolutions(resolutions));
  }
}
