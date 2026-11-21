import { AiddError } from "./aidd-error.js";

export class MissingPluginMetadataError extends AiddError {
  readonly code = "missing-plugin-metadata";
  constructor() {
    super("Cannot register github marketplace plugin: catalog entry is missing plugin metadata.");
    this.name = "MissingPluginMetadataError";
  }
}
