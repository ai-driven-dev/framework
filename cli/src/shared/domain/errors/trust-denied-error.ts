import { AiddError } from "./aidd-error.js";

export class TrustDeniedError extends AiddError {
  readonly code = "trust-denied";
  constructor(name: string) {
    super(`Trust denied for marketplace '${name}'. Aborting.`);
    this.name = "TrustDeniedError";
  }
}
