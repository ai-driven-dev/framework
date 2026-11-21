import { AiddError } from "./aidd-error.js";

export class PluginNotInMarketplaceError extends AiddError {
  readonly code = "plugin-not-in-marketplace";
  constructor(plugin: string) {
    super(`Plugin '${plugin}' was not found in any registered marketplace.`);
    this.name = "PluginNotInMarketplaceError";
  }
}
