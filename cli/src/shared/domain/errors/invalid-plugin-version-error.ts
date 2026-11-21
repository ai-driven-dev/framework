import { AiddError } from "./aidd-error.js";

export class InvalidPluginVersionError extends AiddError {
  readonly code = "invalid-plugin-version";
  constructor(version: string) {
    super(`Invalid plugin version: "${version}". Expected semver format (e.g. 1.0.0).`);
    this.name = "InvalidPluginVersionError";
  }
}
