import { AiddError } from "../../../shared/domain/shared.error.js";

export class InvalidMarketplaceScopeError extends AiddError {
  readonly code = "invalid-marketplace-scope";
  constructor(readonly scope: string) {
    super();
  }
}

// A cached catalog heals by re-fetch, a user-provided source only by hand.
export class MalformedMarketplaceCatalogError extends AiddError {
  readonly code = "malformed-marketplace-catalog";
  constructor(
    readonly path: string,
    readonly detail: string,
    readonly cached: boolean
  ) {
    super();
  }
}

export class MarketplaceAlreadyRegisteredError extends AiddError {
  readonly code = "marketplace-already-registered";
  constructor(readonly marketplace: string) {
    super();
  }
}

export class MarketplaceNotFoundError extends AiddError {
  readonly code = "marketplace-not-found";
  constructor(readonly marketplace: string) {
    super();
  }
}

export class PluginFetchError extends AiddError {
  readonly code = "plugin-fetch";
  constructor(readonly detail: string) {
    super();
  }
}

export class PluginNotInMarketplaceError extends AiddError {
  readonly code = "plugin-not-in-marketplace";
  constructor(readonly plugin: string) {
    super();
  }
}

/** An unreadable registry file is never read as an empty one: `save()` reads this same list,
 * appends to it and writes the whole file back, so a silent empty read would delete the
 * marketplaces a person registered on the very next write. */
export class UnreadableMarketplaceRegistryError extends AiddError {
  readonly code = "unreadable-marketplace-registry";
  constructor(
    readonly path: string,
    readonly reason: string
  ) {
    super();
  }
}
