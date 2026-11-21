import { AiddError } from "./aidd-error.js";

export class PluginFetchError extends AiddError {
  readonly code = "plugin-fetch";
  constructor(detail: string) {
    super(`Failed to fetch plugin: ${detail}`);
    this.name = "PluginFetchError";
  }
}
