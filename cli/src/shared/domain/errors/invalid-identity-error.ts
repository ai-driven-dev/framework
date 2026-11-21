import { AiddError } from "./aidd-error.js";

/** What an identifier must be to name a person. */
export const IDENTITY_RULE = "An identity is one non-empty line of at most 128 characters.";

/** `aidd telemetry on --as` given an identifier that cannot name a person. */
export class InvalidIdentityError extends AiddError {
  readonly code = "invalid-identity";
  constructor() {
    super(`${IDENTITY_RULE} Nothing was changed.`);
    this.name = "InvalidIdentityError";
  }
}
