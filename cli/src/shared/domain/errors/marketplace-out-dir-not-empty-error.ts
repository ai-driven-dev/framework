import { AiddError } from "./aidd-error.js";

export class MarketplaceOutDirNotEmptyError extends AiddError {
  readonly code = "marketplace-out-dir-not-empty";
  constructor(outDir: string) {
    super(
      `Refusing to build: '${outDir}' is not empty. ` +
        "Re-run with --force to overwrite files this build produces, or choose an empty --out directory."
    );
    this.name = "MarketplaceOutDirNotEmptyError";
  }
}
