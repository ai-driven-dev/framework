import { AiddError, InvalidPluginManifestError } from "../../../shared/domain/shared.error.js";

export class InvalidMarketplaceScopeError extends AiddError {
  readonly code = "invalid-marketplace-scope";
  constructor(scope: string) {
    super(`Invalid marketplace scope: "${scope}". Expected "project" or "user".`);
    this.name = "InvalidMarketplaceScopeError";
  }
}

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

export class MarketplaceAlreadyRegisteredError extends AiddError {
  readonly code = "marketplace-already-registered";
  constructor(name: string) {
    super(`Marketplace '${name}' is already registered.`);
    this.name = "MarketplaceAlreadyRegisteredError";
  }
}

export class MarketplaceNotFoundError extends AiddError {
  readonly code = "marketplace-not-found";
  constructor(name: string) {
    super(`Marketplace '${name}' is not registered.`);
    this.name = "MarketplaceNotFoundError";
  }
}

export class PluginFetchError extends AiddError {
  readonly code = "plugin-fetch";
  constructor(detail: string) {
    super(`Failed to fetch plugin: ${detail}`);
    this.name = "PluginFetchError";
  }
}

export class PluginNotInMarketplaceError extends AiddError {
  readonly code = "plugin-not-in-marketplace";
  constructor(plugin: string) {
    super(`Plugin '${plugin}' was not found in any registered marketplace.`);
    this.name = "PluginNotInMarketplaceError";
  }
}

/** An unreadable registry file is never read as an empty one: `save()` reads this same list,
 * appends to it and writes the whole file back, so a silent empty read would delete the
 * marketplaces a person registered on the very next write. */
export class UnreadableMarketplaceRegistryError extends AiddError {
  readonly code = "unreadable-marketplace-registry";
  constructor(path: string, reason: string) {
    super(
      `Cannot read the marketplace registry at ${path}: ${reason}. Repair the file, or ` +
        `delete it to start from an empty registry.`
    );
    this.name = "UnreadableMarketplaceRegistryError";
  }
}
