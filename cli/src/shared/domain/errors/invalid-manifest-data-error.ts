import { AiddError } from "./aidd-error.js";

export class InvalidManifestDataError extends AiddError {
  readonly code = "invalid-manifest-data";
  constructor(detail?: string) {
    super(detail ? `Invalid manifest data: ${detail}` : "Invalid manifest data.");
    this.name = "InvalidManifestDataError";
  }
}
