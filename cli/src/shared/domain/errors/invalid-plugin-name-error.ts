import { AiddError } from "./aidd-error.js";

export class InvalidPluginNameError extends AiddError {
  readonly code = "invalid-plugin-name";
  constructor(name: string) {
    super(
      `Invalid plugin name: "${name}". Use lowercase alphanumeric characters and hyphens only.`
    );
    this.name = "InvalidPluginNameError";
  }
}
