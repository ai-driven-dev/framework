import { AiddError } from "./aidd-error.js";

export class ManifestValidationError extends AiddError {
  readonly code = "manifest-validation";
  constructor(message: string) {
    super(message);
    this.name = "ManifestValidationError";
  }
}
