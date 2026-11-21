import { AiddError } from "./aidd-error.js";

/** `aidd telemetry on --as` given an identifier that cannot name a person. */
export class InvalidIdentityError extends AiddError {
  readonly code = "invalid-identity";
  constructor() {
    super("An identity is one non-empty line of at most 128 characters. Nothing was changed.");
    this.name = "InvalidIdentityError";
  }
}
