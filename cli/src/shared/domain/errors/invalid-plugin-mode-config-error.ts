import { AiddError } from "./aidd-error.js";

export class InvalidPluginModeConfigError extends AiddError {
  readonly code = "invalid-plugin-mode-config";
  constructor(message: string) {
    super(message);
    this.name = "InvalidPluginModeConfigError";
  }
}
