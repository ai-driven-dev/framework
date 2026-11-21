import { InvalidPluginManifestError } from "./invalid-plugin-manifest-error.js";

// Extends InvalidPluginManifestError so existing `instanceof` checks still hold, adding the
// recovery: a cached catalog heals by re-fetch, a user-provided source only by hand.
export class MalformedMarketplaceCatalogError extends InvalidPluginManifestError {
  readonly code = "malformed-marketplace-catalog";
  constructor(path: string, detail: string, cached: boolean) {
    const recovery = cached
      ? "Run 'aidd marketplace refresh --force' to re-fetch a clean copy."
      : "Fix or re-create the marketplace catalog file.";
    super(`catalog at "${path}" is malformed (${detail}). ${recovery}`);
    this.name = "MalformedMarketplaceCatalogError";
  }
}
