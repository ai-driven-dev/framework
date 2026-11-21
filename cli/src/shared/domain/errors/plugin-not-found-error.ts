import { AiddError } from "./aidd-error.js";

export class PluginNotFoundError extends AiddError {
  readonly code = "plugin-not-found";
  constructor(name: string) {
    super(`Plugin '${name}' is not installed.`);
    this.name = "PluginNotFoundError";
  }
}
