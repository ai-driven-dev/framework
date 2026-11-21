import { AiddError } from "./aidd-error.js";

export class AssetNotFoundError extends AiddError {
  readonly code = "asset-not-found";
  constructor(assetName: string) {
    super(`Bundled asset not found: '${assetName}'`);
    this.name = "AssetNotFoundError";
  }
}
