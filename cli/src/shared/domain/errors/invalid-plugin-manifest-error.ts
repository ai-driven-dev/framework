import { AiddError } from "./aidd-error.js";

export class InvalidPluginManifestError extends AiddError {
  readonly code: string = "invalid-plugin-manifest";
  constructor(detail?: string) {
    super(detail ? `Invalid plugin manifest: ${detail}` : "Invalid plugin manifest.");
    this.name = "InvalidPluginManifestError";
  }
}
