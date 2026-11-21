import { AiddError } from "./aidd-error.js";

export class CatalogFetchAuthError extends AiddError {
  readonly code = "catalog-fetch-auth";
  constructor(url: string) {
    super(
      `Authentication required to fetch catalog from "${url}". Run \`aidd auth login\` first or use \`--source local --path <dir>\`.`
    );
    this.name = "CatalogFetchAuthError";
  }
}
