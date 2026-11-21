import { AiddError } from "./aidd-error.js";

export class VersionMismatchError extends AiddError {
  readonly code = "version-mismatch";
  constructor(plugin: string, requested: string, actual: string) {
    super(
      `Plugin '${plugin}': requested version '${requested}' does not match catalog version '${actual}'.`
    );
    this.name = "VersionMismatchError";
  }
}
