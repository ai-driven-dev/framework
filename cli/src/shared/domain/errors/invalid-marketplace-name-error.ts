import { AiddError } from "./aidd-error.js";

export class InvalidMarketplaceNameError extends AiddError {
  readonly code = "invalid-marketplace-name";
  constructor(detail: string) {
    super(
      `Invalid marketplace name: "${detail}". Use lowercase alphanumeric characters and hyphens only.`
    );
    this.name = "InvalidMarketplaceNameError";
  }
}
