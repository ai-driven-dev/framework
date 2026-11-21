import { AiddError } from "./aidd-error.js";

export class MarketplaceAlreadyRegisteredError extends AiddError {
  readonly code = "marketplace-already-registered";
  constructor(name: string) {
    super(`Marketplace '${name}' is already registered.`);
    this.name = "MarketplaceAlreadyRegisteredError";
  }
}
