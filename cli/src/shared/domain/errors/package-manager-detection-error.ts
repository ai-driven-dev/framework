import { AiddError } from "./aidd-error.js";

export class PackageManagerDetectionError extends AiddError {
  readonly code = "package-manager-detection";
  constructor(commands: readonly string[]) {
    super(`Could not detect package manager. Run manually:\n  ${commands.join("\n  ")}`);
    this.name = "PackageManagerDetectionError";
  }
}
