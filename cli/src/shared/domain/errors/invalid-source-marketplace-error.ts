import { AiddError } from "./aidd-error.js";

export class InvalidSourceMarketplaceError extends AiddError {
  readonly code = "invalid-source-marketplace";
  constructor(detail: string) {
    super(`Invalid source marketplace: ${detail}.`);
    this.name = "InvalidSourceMarketplaceError";
  }
}
