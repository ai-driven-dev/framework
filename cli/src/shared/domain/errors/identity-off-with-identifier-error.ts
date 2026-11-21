import { AiddError } from "./aidd-error.js";

/** `aidd telemetry identity --off` given an identifier to set. */
export class IdentityOffWithIdentifierError extends AiddError {
  readonly code = "identity-off-with-identifier";
  constructor() {
    super("--off removes the identity: give it no identifier.");
    this.name = "IdentityOffWithIdentifierError";
  }
}
