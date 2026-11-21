import { AiddError } from "./aidd-error.js";

export class CatalogFetchNotFoundError extends AiddError {
  readonly code = "catalog-fetch-not-found";
  constructor(url: string) {
    super(`Catalog not found (HTTP 404): ${url}`);
    this.name = "CatalogFetchNotFoundError";
  }
}
