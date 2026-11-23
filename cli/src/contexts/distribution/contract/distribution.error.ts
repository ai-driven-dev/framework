import type { Scope } from "../../../shared/domain/scope.js";
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

/** What a refused clone tells the person to do next, by how the remote is reached. */
export type CredentialAdvice = "ssh-key" | "token";

export class PluginFetchError extends AiddError {
  readonly code = "plugin-fetch";
  constructor(
    readonly detail: string,
    readonly advice?: CredentialAdvice
  ) {
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

/** Removing the framework marketplace by name: every project on the machine shares it, so only
 * a clean undoes it. `scope` is the scope the removal was asked at. */
export class SharedMarketplaceRemovalError extends AiddError {
  readonly code = "shared-marketplace-removal";
  constructor(
    readonly marketplace: string,
    readonly scope: Scope
  ) {
    super();
  }
}
