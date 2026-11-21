/** A catalogue error carries a stable kebab-case `code`, the key a presentation table maps to words. */
export abstract class AiddError extends Error {
  abstract readonly code: string;
}

export class AssetNotFoundError extends AiddError {
  readonly code = "asset-not-found";
  constructor(assetName: string) {
    super(`Bundled asset not found: '${assetName}'`);
    this.name = "AssetNotFoundError";
  }
}

export class AuthenticationError extends AiddError {
  readonly code = "authentication";
  constructor(source: string) {
    super(`Authentication failed (${source}). Run \`aidd auth login\` to authenticate.`);
    this.name = "AuthenticationError";
  }
}

export class CatalogFetchAuthError extends AiddError {
  readonly code = "catalog-fetch-auth";
  constructor(url: string) {
    super(
      `Authentication required to fetch catalog from "${url}". Run \`aidd auth login\` first or use \`--source local --path <dir>\`.`
    );
    this.name = "CatalogFetchAuthError";
  }
}

export class CatalogFetchError extends AiddError {
  readonly code = "catalog-fetch";
  constructor(url: string, detail: string) {
    super(`Failed to fetch catalog from "${url}": ${detail}`);
    this.name = "CatalogFetchError";
  }
}

export class CatalogFetchNotFoundError extends AiddError {
  readonly code = "catalog-fetch-not-found";
  constructor(url: string) {
    super(`Catalog not found (HTTP 404): ${url}`);
    this.name = "CatalogFetchNotFoundError";
  }
}

export class HttpError extends AiddError {
  readonly code = "http";
  constructor(
    readonly statusCode: number,
    readonly url: string
  ) {
    super(`Unexpected HTTP ${statusCode} from ${url}`);
    this.name = "HttpError";
  }
}

export class HttpNotFoundError extends AiddError {
  readonly code = "http-not-found";
  constructor(readonly url: string) {
    super(`Resource not found (HTTP 404): ${url}`);
    this.name = "HttpNotFoundError";
  }
}

export class HttpRedirectError extends AiddError {
  readonly code = "http-redirect";
  constructor(readonly url: string) {
    super(`HTTP redirect without location header from ${url}`);
    this.name = "HttpRedirectError";
  }
}

export class InputRequiredError extends AiddError {
  readonly code = "input-required";
  constructor(message: string) {
    super(message);
    this.name = "InputRequiredError";
  }
}

export class InvalidInstallScopeError extends AiddError {
  readonly code = "invalid-install-scope";
  constructor(value: string) {
    super(`Invalid scope '${value}'. Expected 'project' or 'user'.`);
    this.name = "InvalidInstallScopeError";
  }
}

export class InvalidMarketplaceNameError extends AiddError {
  readonly code = "invalid-marketplace-name";
  constructor(detail: string) {
    super(
      `Invalid marketplace name: "${detail}". Use lowercase alphanumeric characters and hyphens only.`
    );
    this.name = "InvalidMarketplaceNameError";
  }
}

export class InvalidPluginManifestError extends AiddError {
  readonly code: string = "invalid-plugin-manifest";
  constructor(detail?: string) {
    super(detail ? `Invalid plugin manifest: ${detail}` : "Invalid plugin manifest.");
    this.name = "InvalidPluginManifestError";
  }
}

export class InvalidPluginSourceError extends AiddError {
  readonly code = "invalid-plugin-source";
  constructor(detail?: string) {
    super(detail ? `Invalid plugin source: ${detail}` : "Invalid plugin source.");
    this.name = "InvalidPluginSourceError";
  }
}

export class InvalidSourceMarketplaceError extends AiddError {
  readonly code = "invalid-source-marketplace";
  constructor(detail: string) {
    super(`Invalid source marketplace: ${detail}.`);
    this.name = "InvalidSourceMarketplaceError";
  }
}

export class JsonParseError extends AiddError {
  readonly code = "json-parse";
  constructor(path: string, cause: string) {
    super(`Cannot parse existing JSON at ${path}: ${cause}`);
    this.name = "JsonParseError";
  }
}

export class ManifestValidationError extends AiddError {
  readonly code = "manifest-validation";
  constructor(message: string) {
    super(message);
    this.name = "ManifestValidationError";
  }
}

export class McpConfigError extends AiddError {
  readonly code = "mcp-config";
  constructor(message: string) {
    super(message);
    this.name = "McpConfigError";
  }
}

export class ToolNotInManifestError extends AiddError {
  readonly code = "tool-not-in-manifest";
  constructor(toolId: string) {
    super(`Tool '${toolId}' is not installed in the manifest.`);
    this.name = "ToolNotInManifestError";
  }
}

/** As `UnreadableMarketplaceRegistryError`: `references.json` is written by appending to
 * what it already holds, so a silent empty read on a corrupted file would delete every
 * other project's own reference on the very next write. */
export class UnreadableUserSourceReferencesError extends AiddError {
  readonly code = "unreadable-user-source-references";
  constructor(path: string, reason: string) {
    super(
      `Cannot read the shared-source reference registry at ${path}: ${reason}. Repair the ` +
        `file, or delete it to start from an empty registry.`
    );
    this.name = "UnreadableUserSourceReferencesError";
  }
}

export class UnregisteredToolError extends AiddError {
  readonly code = "unregistered-tool";
  constructor(toolId: string) {
    super(`Tool '${toolId}' is not registered.`);
    this.name = "UnregisteredToolError";
  }
}

export class VersionMismatchError extends AiddError {
  readonly code = "version-mismatch";
  constructor(plugin: string, requested: string, actual: string) {
    super(
      `Plugin '${plugin}': requested version '${requested}' does not match catalog version '${actual}'.`
    );
    this.name = "VersionMismatchError";
  }
}
