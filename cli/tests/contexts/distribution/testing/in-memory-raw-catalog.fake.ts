import type { RawCatalogFetcher } from "../../../../src/contexts/distribution/ports/raw-catalog-fetcher.js";
import {
  CatalogFetchAuthError,
  CatalogFetchNotFoundError,
} from "../../../../src/shared/domain/shared.error.js";
import type { PluginSourceGitHub } from "../../../../src/shared/domain/source.js";
import {
  CATALOG_PATH,
  HEAD_CATALOG,
  PRIVATE_REPO,
  PUBLIC_REPO,
  STABLE_CATALOG,
  STABLE_REF,
} from "./raw-catalog.contract.js";

/** A forge that holds the contract's world in memory. */
export class InMemoryRawCatalog implements RawCatalogFetcher {
  async fetchCatalog(source: PluginSourceGitHub, catalogPath: string): Promise<string> {
    if (source.repo === PRIVATE_REPO) throw new CatalogFetchAuthError(source.repo);
    if (source.repo !== PUBLIC_REPO || catalogPath !== CATALOG_PATH) {
      throw new CatalogFetchNotFoundError(source.repo);
    }
    return source.ref === STABLE_REF ? STABLE_CATALOG : HEAD_CATALOG;
  }
}
