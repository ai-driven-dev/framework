import { AiddError } from "./aidd-error.js";

export class MarketplaceNotFoundError extends AiddError {
  readonly code = "marketplace-not-found";
  constructor(name: string) {
    super(`Marketplace '${name}' is not registered.`);
    this.name = "MarketplaceNotFoundError";
  }
}
