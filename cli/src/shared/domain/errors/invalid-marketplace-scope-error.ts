import { AiddError } from "./aidd-error.js";

export class InvalidMarketplaceScopeError extends AiddError {
  readonly code = "invalid-marketplace-scope";
  constructor(scope: string) {
    super(`Invalid marketplace scope: "${scope}". Expected "project" or "user".`);
    this.name = "InvalidMarketplaceScopeError";
  }
}
