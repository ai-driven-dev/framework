import { AiddError } from "./aidd-error.js";

/** `aidd telemetry on` told to name the person and to name nobody. */
export class ConflictingIdentityFlagsError extends AiddError {
  readonly code = "conflicting-identity-flags";
  constructor() {
    super("--as names you and --anonymous names nobody: give one of them.");
    this.name = "ConflictingIdentityFlagsError";
  }
}
