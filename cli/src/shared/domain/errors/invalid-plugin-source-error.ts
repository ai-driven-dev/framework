import { AiddError } from "./aidd-error.js";

export class InvalidPluginSourceError extends AiddError {
  readonly code = "invalid-plugin-source";
  constructor(detail?: string) {
    super(detail ? `Invalid plugin source: ${detail}` : "Invalid plugin source.");
    this.name = "InvalidPluginSourceError";
  }
}
