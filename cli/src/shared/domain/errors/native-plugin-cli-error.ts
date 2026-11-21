import { AiddError } from "./aidd-error.js";

export class NativePluginCliError extends AiddError {
  readonly code = "native-plugin-cli";
  constructor(message: string) {
    super(message);
    this.name = "NativePluginCliError";
  }
}
