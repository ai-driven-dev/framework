import { AiddError } from "./aidd-error.js";

export class AlreadyInitializedError extends AiddError {
  readonly code = "already-initialized";
  constructor(message = "Already initialized. Use `aidd update` to upgrade.") {
    super(message);
    this.name = "AlreadyInitializedError";
  }
}
