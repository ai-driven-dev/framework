import { AiddError } from "./aidd-error.js";

export class DuplicatePluginError extends AiddError {
  readonly code = "duplicate-plugin";
  constructor(name: string) {
    super(`Plugin '${name}' is already installed.`);
    this.name = "DuplicatePluginError";
  }
}
