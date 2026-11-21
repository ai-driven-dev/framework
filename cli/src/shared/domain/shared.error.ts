/** A catalogue error carries a stable kebab-case `code`, the key a presentation table maps to words. */
export abstract class AiddError extends Error {
  abstract readonly code: string;
  constructor(message?: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class AssetNotFoundError extends AiddError {
  readonly code = "asset-not-found";
  constructor(readonly assetName: string) {
    super();
  }
}

export class AuthenticationError extends AiddError {
  readonly code = "authentication";
  constructor(readonly source: string) {
    super();
  }
}

export class CatalogFetchAuthError extends AiddError {
  readonly code = "catalog-fetch-auth";
  constructor(readonly url: string) {
    super();
  }
}

export class CatalogFetchError extends AiddError {
  readonly code = "catalog-fetch";
  constructor(
    readonly url: string,
    readonly reason: unknown
  ) {
    super();
  }
}

export class CatalogFetchNotFoundError extends AiddError {
  readonly code = "catalog-fetch-not-found";
  constructor(readonly url: string) {
    super();
  }
}

export class HttpError extends AiddError {
  readonly code = "http";
  constructor(
    readonly statusCode: number,
    readonly url: string
  ) {
    super();
  }
}

export class HttpNotFoundError extends AiddError {
  readonly code = "http-not-found";
  constructor(readonly url: string) {
    super();
  }
}

export class HttpRedirectError extends AiddError {
  readonly code = "http-redirect";
  constructor(readonly url: string) {
    super();
  }
}

export class InputRequiredError extends AiddError {
  readonly code = "input-required";
  constructor(readonly detail: string) {
    super();
  }
}

export class InvalidInstallScopeError extends AiddError {
  readonly code = "invalid-install-scope";
  constructor(readonly value: string) {
    super();
  }
}

export class InvalidMarketplaceNameError extends AiddError {
  readonly code = "invalid-marketplace-name";
  constructor(readonly detail: string) {
    super();
  }
}

export class InvalidPluginManifestError extends AiddError {
  readonly code = "invalid-plugin-manifest";
  constructor(readonly detail?: string) {
    super();
  }
}

export class InvalidPluginSourceError extends AiddError {
  readonly code = "invalid-plugin-source";
  constructor(readonly detail?: string) {
    super();
  }
}

export class InvalidSourceMarketplaceError extends AiddError {
  readonly code = "invalid-source-marketplace";
  constructor(readonly detail: string) {
    super();
  }
}

export class JsonParseError extends AiddError {
  readonly code = "json-parse";
  constructor(
    readonly path: string,
    readonly reason: string
  ) {
    super();
  }
}

export class ManifestValidationError extends AiddError {
  readonly code = "manifest-validation";
  constructor(readonly detail: string) {
    super();
  }
}

export class McpConfigError extends AiddError {
  readonly code = "mcp-config";
  constructor(readonly detail: string) {
    super();
  }
}

export class ToolNotInManifestError extends AiddError {
  readonly code = "tool-not-in-manifest";
  constructor(readonly toolId: string) {
    super();
  }
}

/** As `UnreadableMarketplaceRegistryError`: `references.json` is written by appending to
 * what it already holds, so a silent empty read on a corrupted file would delete every
 * other project's own reference on the very next write. */
export class UnreadableUserSourceReferencesError extends AiddError {
  readonly code = "unreadable-user-source-references";
  constructor(
    readonly path: string,
    readonly reason: string
  ) {
    super();
  }
}

export class UnregisteredToolError extends AiddError {
  readonly code = "unregistered-tool";
  constructor(readonly toolId: string) {
    super();
  }
}

export class VersionMismatchError extends AiddError {
  readonly code = "version-mismatch";
  constructor(
    readonly plugin: string,
    readonly requested: string,
    readonly actual: string
  ) {
    super();
  }
}
