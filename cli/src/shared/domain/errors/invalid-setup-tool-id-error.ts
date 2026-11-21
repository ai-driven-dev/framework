import { AiddError } from "./aidd-error.js";

export class InvalidSetupToolIdError extends AiddError {
  readonly code = "invalid-setup-tool-id";
  constructor(id: string, validIds: readonly string[]) {
    super(`Invalid tool ID: "${id}". Valid IDs: ${validIds.join(", ")}`);
    this.name = "InvalidSetupToolIdError";
  }
}
