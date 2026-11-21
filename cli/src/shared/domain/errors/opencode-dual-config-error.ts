import { AiddError } from "./aidd-error.js";

export class OpencodeDualConfigError extends AiddError {
  readonly code = "opencode-dual-config";
  constructor() {
    super("Both opencode.json and opencode.jsonc exist. Remove one.");
    this.name = "OpencodeDualConfigError";
  }
}
