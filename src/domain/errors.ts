import type { ToolCategory } from "./tools/registry.js";

export class AuthenticationError extends Error {
  constructor(source: string) {
    super(`Authentication failed (${source}). Run \`aidd auth login\` to authenticate.`);
    this.name = "AuthenticationError";
  }
}

export class NoFrameworkSourceError extends Error {
  constructor() {
    super("No framework source configured. Use --path for a local framework path.");
    this.name = "NoFrameworkSourceError";
  }
}

export class UpdateError extends Error {
  constructor() {
    super(
      "Update failed. If you saw a 403 error above, ensure your GitHub token includes both repo and read:packages scopes.\n" +
        "Update your token at https://github.com/settings/tokens, then re-run `aidd auth login`."
    );
    this.name = "UpdateError";
  }
}

export class ManifestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ManifestValidationError";
  }
}

export class McpConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "McpConfigError";
  }
}

export class FrameworkResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FrameworkResolutionError";
  }
}

export class InvalidToolIdError extends Error {
  constructor(invalid: string[], validToolIds: readonly string[]) {
    super(`Unknown tool(s): ${invalid.join(", ")}. Valid tools: ${validToolIds.join(", ")}`);
    this.name = "InvalidToolIdError";
  }
}

export class CategoryMismatchError extends Error {
  constructor(wrong: string[], category: ToolCategory, validToolIds: readonly string[]) {
    const label = category === "ai" ? "AI" : "IDE";
    const verb = wrong.length === 1 ? `is not an ${label} tool` : `are not ${label} tools`;
    super(`${wrong.join(", ")} ${verb}. Valid ${label} tools: ${validToolIds.join(", ")}`);
    this.name = "CategoryMismatchError";
  }
}

export class UnregisteredToolError extends Error {
  constructor(toolId: string) {
    super(`Tool '${toolId}' is not registered.`);
    this.name = "UnregisteredToolError";
  }
}

export class ToolNotInManifestError extends Error {
  constructor(toolId: string) {
    super(`Tool '${toolId}' is not installed in the manifest.`);
    this.name = "ToolNotInManifestError";
  }
}

export class InvalidManifestDataError extends Error {
  constructor(detail?: string) {
    super(detail ? `Invalid manifest data: ${detail}` : "Invalid manifest data.");
    this.name = "InvalidManifestDataError";
  }
}

export class InvalidManifestToolIdError extends Error {
  constructor(key: string) {
    super(`Invalid tool id in manifest: '${key}'.`);
    this.name = "InvalidManifestToolIdError";
  }
}

export class InvalidMcpServerConfigError extends Error {
  constructor(name: string) {
    super(`MCP server "${name}" must have either a "command" or "url" field`);
    this.name = "InvalidMcpServerConfigError";
  }
}

export class OpencodeDualConfigError extends Error {
  constructor() {
    super("Both opencode.json and opencode.jsonc exist. Remove one.");
    this.name = "OpencodeDualConfigError";
  }
}

export class PackageManagerDetectionError extends Error {
  constructor(commands: readonly string[]) {
    super(`Could not detect package manager. Run manually:\n  ${commands.join("\n  ")}`);
    this.name = "PackageManagerDetectionError";
  }
}

export class InvalidPluginSourceError extends Error {
  constructor(detail?: string) {
    super(detail ? `Invalid plugin source: ${detail}` : "Invalid plugin source.");
    this.name = "InvalidPluginSourceError";
  }
}

export class InvalidPluginNameError extends Error {
  constructor(name: string) {
    super(
      `Invalid plugin name: "${name}". Use lowercase alphanumeric characters and hyphens only.`
    );
    this.name = "InvalidPluginNameError";
  }
}

export class InvalidPluginVersionError extends Error {
  constructor(version: string) {
    super(`Invalid plugin version: "${version}". Expected semver format (e.g. 1.0.0).`);
    this.name = "InvalidPluginVersionError";
  }
}

export class InvalidPluginManifestError extends Error {
  constructor(detail?: string) {
    super(detail ? `Invalid plugin manifest: ${detail}` : "Invalid plugin manifest.");
    this.name = "InvalidPluginManifestError";
  }
}

export class PluginNotFoundError extends Error {
  constructor(name: string) {
    super(`Plugin '${name}' is not installed.`);
    this.name = "PluginNotFoundError";
  }
}

export class DuplicatePluginError extends Error {
  constructor(name: string) {
    super(`Plugin '${name}' is already installed.`);
    this.name = "DuplicatePluginError";
  }
}

export class PluginFetchError extends Error {
  constructor(detail: string) {
    super(`Failed to fetch plugin: ${detail}`);
    this.name = "PluginFetchError";
  }
}

export class FlatCollisionError extends Error {
  constructor(plugin: string, path: string) {
    super(`Plugin '${plugin}' collides with an existing file at '${path}'.`);
    this.name = "FlatCollisionError";
  }
}

export class InvalidMarketplaceNameError extends Error {
  constructor(detail: string) {
    super(
      `Invalid marketplace name: "${detail}". Use lowercase alphanumeric characters and hyphens only.`
    );
    this.name = "InvalidMarketplaceNameError";
  }
}

export class InvalidMarketplaceScopeError extends Error {
  constructor(scope: string) {
    super(`Invalid marketplace scope: "${scope}". Expected "project" or "user".`);
    this.name = "InvalidMarketplaceScopeError";
  }
}

export class MarketplaceAlreadyRegisteredError extends Error {
  constructor(name: string) {
    super(`Marketplace '${name}' is already registered.`);
    this.name = "MarketplaceAlreadyRegisteredError";
  }
}

export class MarketplaceNotFoundError extends Error {
  constructor(name: string) {
    super(`Marketplace '${name}' is not registered.`);
    this.name = "MarketplaceNotFoundError";
  }
}

export class TrustDeniedError extends Error {
  constructor(name: string) {
    super(`Trust denied for marketplace '${name}'. Aborting.`);
    this.name = "TrustDeniedError";
  }
}

export class PluginNotInMarketplaceError extends Error {
  constructor(plugin: string) {
    super(`Plugin '${plugin}' was not found in any registered marketplace.`);
    this.name = "PluginNotInMarketplaceError";
  }
}

export class VersionMismatchError extends Error {
  constructor(plugin: string, requested: string, actual: string) {
    super(
      `Plugin '${plugin}': requested version '${requested}' does not match catalog version '${actual}'.`
    );
    this.name = "VersionMismatchError";
  }
}

export class AmbiguousPluginMatchError extends Error {
  constructor(plugin: string, marketplaces: readonly string[]) {
    super(
      `Plugin '${plugin}' matches multiple marketplaces: ${marketplaces.join(", ")}. Use --from <marketplace>.`
    );
    this.name = "AmbiguousPluginMatchError";
  }
}

export class OfflineError extends Error {
  constructor(detail: string) {
    super(`Offline: ${detail}`);
    this.name = "OfflineError";
  }
}

export class NoMarketplacesRegisteredError extends Error {
  constructor() {
    super("No marketplaces registered. Use `aidd plugin marketplace add <source>` first.");
    this.name = "NoMarketplacesRegisteredError";
  }
}

export class InteractiveOnlyError extends Error {
  constructor(action: string) {
    super(`'${action}' requires an interactive terminal.`);
    this.name = "InteractiveOnlyError";
  }
}
