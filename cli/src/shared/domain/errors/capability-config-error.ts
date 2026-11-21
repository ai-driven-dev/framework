import { AiddError } from "./aidd-error.js";

export class CapabilityConfigError extends AiddError {
  readonly code = "capability-config";
  constructor(message: string) {
    super(message);
    this.name = "CapabilityConfigError";
  }
}
