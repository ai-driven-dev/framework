import { AiddError } from "./aidd-error.js";

export class InvalidBuildPathsError extends AiddError {
  readonly code = "invalid-build-paths";
  constructor(sourceDir: string, outDir: string) {
    super(
      `Refusing to build: --out '${outDir}' and --source '${sourceDir}' must not contain each other.`
    );
    this.name = "InvalidBuildPathsError";
  }
}
