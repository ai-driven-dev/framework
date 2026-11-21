import { AiddError } from "./aidd-error.js";

export class CatalogFetchError extends AiddError {
  readonly code = "catalog-fetch";
  constructor(url: string, detail: string) {
    super(`Failed to fetch catalog from "${url}": ${detail}`);
    this.name = "CatalogFetchError";
  }
}
