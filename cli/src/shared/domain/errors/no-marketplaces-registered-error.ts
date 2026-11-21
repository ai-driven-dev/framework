import { AiddError } from "./aidd-error.js";

export class NoMarketplacesRegisteredError extends AiddError {
  readonly code = "no-marketplaces-registered";
  constructor() {
    super("No marketplaces registered. Use `aidd marketplace add <name> <source>` first.");
    this.name = "NoMarketplacesRegisteredError";
  }
}
