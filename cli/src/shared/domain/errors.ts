import type { ToolCategory } from "./tool.js";

/** A catalogue error carries a stable kebab-case `code`, the key a presentation table maps to words. */
export abstract class AiddError extends Error {
  abstract readonly code: string;
}

export class CapabilityConfigError extends AiddError {
  readonly code = "capability-config";
  constructor(message: string) {
    super(message);
    this.name = "CapabilityConfigError";
  }
}

export class CursorProjectScopeUnsupportedError extends AiddError {
  readonly code = "cursor-project-scope-unsupported";
  constructor() {
    super(
      "Cursor plugins only support user-scope install (~/.cursor/plugins/local/). Project-scope is not auto-loaded by Cursor."
    );
    this.name = "CursorProjectScopeUnsupportedError";
  }
}

export class InvalidPluginScopeError extends AiddError {
  readonly code = "invalid-plugin-scope";
  constructor(toolId: string, requested: "project" | "user", supported: "project" | "user") {
    super(
      `Tool '${toolId}' does not support scope '${requested}'. Supported scope: '${supported}'. ` +
        `Re-run with --scope ${supported} or omit the flag.`
    );
    this.name = "InvalidPluginScopeError";
  }
}

export class ActiveMachineDependentsError extends AiddError {
  readonly code = "active-machine-dependents";
  constructor(target: string, projects: readonly string[]) {
    super(`Cannot remove ${target}: active projects still depend on it: ${projects.join(", ")}.`);
    this.name = "ActiveMachineDependentsError";
  }
}

export class AuthenticationError extends AiddError {
  readonly code = "authentication";
  constructor(source: string) {
    super(`Authentication failed (${source}). Run \`aidd auth login\` to authenticate.`);
    this.name = "AuthenticationError";
  }
}

export class UpdateError extends AiddError {
  readonly code = "update";
  constructor() {
    super(
      "Update failed. If you saw a 403 error above, ensure your GitHub token includes both repo and read:packages scopes.\n" +
        "Update your token at https://github.com/settings/tokens, then re-run `aidd auth login`."
    );
    this.name = "UpdateError";
  }
}

export class ElevatedPermissionUpdateError extends AiddError {
  readonly code = "elevated-permission-update";
  constructor(installCommand: string) {
    super(
      "Update failed: the global package directory is not writable (EPERM/EACCES).\n" +
        "Pick one:\n" +
        "  1. Run the terminal as Administrator (Windows) or with sudo (macOS/Linux), then re-run `aidd update`.\n" +
        "  2. Move global installs to a user-writable prefix, then re-run the update:\n" +
        "     Windows:  npm config set prefix %APPDATA%\\npm\n" +
        "     macOS/Linux:  npm config set prefix ~/.npm-global\n" +
        `  3. Run the update directly: ${installCommand}`
    );
    this.name = "ElevatedPermissionUpdateError";
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

export class FrameworkResolutionError extends AiddError {
  readonly code = "framework-resolution";
  constructor(message: string) {
    super(message);
    this.name = "FrameworkResolutionError";
  }
}

export class CategoryMismatchError extends AiddError {
  readonly code = "category-mismatch";
  constructor(wrong: string[], category: ToolCategory, validToolIds: readonly string[]) {
    const label = category === "ai" ? "AI" : "IDE";
    const verb = wrong.length === 1 ? `is not an ${label} tool` : `are not ${label} tools`;
    super(`${wrong.join(", ")} ${verb}. Valid ${label} tools: ${validToolIds.join(", ")}`);
    this.name = "CategoryMismatchError";
  }
}

export class UnregisteredToolError extends AiddError {
  readonly code = "unregistered-tool";
  constructor(toolId: string) {
    super(`Tool '${toolId}' is not registered.`);
    this.name = "UnregisteredToolError";
  }
}

export class DuplicateToolIdError extends AiddError {
  readonly code = "duplicate-tool-id";
  constructor(toolId: string) {
    super(`Tool '${toolId}' is registered twice.`);
    this.name = "DuplicateToolIdError";
  }
}

export class ToolListMismatchError extends AiddError {
  readonly code = "tool-list-mismatch";
  constructor(toolIds: readonly string[]) {
    super(`Tool lists differ on: ${toolIds.join(", ")}.`);
    this.name = "ToolListMismatchError";
  }
}

export type HooksInvariant =
  | "unknown-event"
  | "empty-native-list"
  | "duplicate-native-event"
  | "project-without-file"
  | "loader-with-file"
  | "path-outside-directory"
  | "root-token-without-file"
  | "file-without-root-token"
  | "adapter-not-stamped";

export class InvalidHooksDescriptorError extends AiddError {
  readonly code = "invalid-hooks-descriptor";
  constructor(
    readonly toolId: string,
    readonly invariant: HooksInvariant,
    detail: string
  ) {
    super(`The hooks descriptor of '${toolId}' breaks '${invariant}': ${detail}`);
    this.name = "InvalidHooksDescriptorError";
  }
}

export type ProfileInvariant =
  | "directory-not-relative"
  | "directory-without-trailing-slash"
  | "no-build-contract"
  | "unknown-section"
  | "plugin-sections-disagree"
  | "shipped-config-disagrees";

export class InvalidToolProfileError extends AiddError {
  readonly code = "invalid-tool-profile";
  constructor(
    readonly toolId: string,
    readonly invariant: ProfileInvariant,
    detail: string
  ) {
    super(`The profile of '${toolId}' breaks '${invariant}': ${detail}`);
    this.name = "InvalidToolProfileError";
  }
}

export class ToolNotInManifestError extends AiddError {
  readonly code = "tool-not-in-manifest";
  constructor(toolId: string) {
    super(`Tool '${toolId}' is not installed in the manifest.`);
    this.name = "ToolNotInManifestError";
  }
}

export class InvalidManifestDataError extends AiddError {
  readonly code = "invalid-manifest-data";
  constructor(detail?: string) {
    super(detail ? `Invalid manifest data: ${detail}` : "Invalid manifest data.");
    this.name = "InvalidManifestDataError";
  }
}

export class InvalidManifestToolIdError extends AiddError {
  readonly code = "invalid-manifest-tool-id";
  constructor(key: string) {
    super(`Invalid tool id in manifest: '${key}'.`);
    this.name = "InvalidManifestToolIdError";
  }
}

export class InvalidMcpServerConfigError extends AiddError {
  readonly code = "invalid-mcp-server-config";
  constructor(name: string) {
    super(`MCP server "${name}" must have either a "command" or "url" field`);
    this.name = "InvalidMcpServerConfigError";
  }
}

export class OpencodeDualConfigError extends AiddError {
  readonly code = "opencode-dual-config";
  constructor() {
    super("Both opencode.json and opencode.jsonc exist. Remove one.");
    this.name = "OpencodeDualConfigError";
  }
}

export class KiloDualConfigError extends AiddError {
  readonly code = "kilo-dual-config";
  constructor() {
    super("Both Kilo JSON and JSONC config variants exist at the same location. Remove one.");
    this.name = "KiloDualConfigError";
  }
}

export class PackageManagerDetectionError extends AiddError {
  readonly code = "package-manager-detection";
  constructor(commands: readonly string[]) {
    super(`Could not detect package manager. Run manually:\n  ${commands.join("\n  ")}`);
    this.name = "PackageManagerDetectionError";
  }
}

export class InvalidPluginSourceError extends AiddError {
  readonly code = "invalid-plugin-source";
  constructor(detail?: string) {
    super(detail ? `Invalid plugin source: ${detail}` : "Invalid plugin source.");
    this.name = "InvalidPluginSourceError";
  }
}

export class InvalidPluginNameError extends AiddError {
  readonly code = "invalid-plugin-name";
  constructor(name: string) {
    super(
      `Invalid plugin name: "${name}". Use lowercase alphanumeric characters and hyphens only.`
    );
    this.name = "InvalidPluginNameError";
  }
}

export class InvalidPluginVersionError extends AiddError {
  readonly code = "invalid-plugin-version";
  constructor(version: string) {
    super(`Invalid plugin version: "${version}". Expected semver format (e.g. 1.0.0).`);
    this.name = "InvalidPluginVersionError";
  }
}

// Not `InvalidPluginScopeError`, the CLI-facing "this tool does not support the scope you
// asked for" (`install-scope.ts`): this one is a manifest integrity failure: the recorded
// `scope` field is missing or not one of the two values it may hold.
export class MalformedPluginScopeError extends AiddError {
  readonly code = "malformed-plugin-scope";
  constructor(pluginName: string, scope: unknown) {
    super(
      `Plugin "${pluginName}" carries an invalid scope: ${JSON.stringify(scope)}. Expected "project" or "user".`
    );
    this.name = "MalformedPluginScopeError";
  }
}

export class UnresolvableUserScopeError extends AiddError {
  readonly code = "unresolvable-user-scope";
  constructor(toolId: string) {
    super(
      `Manifest records a user-scope plugin for "${toolId}", but this tool's profile declares no user-scope plugins directory. Refusing to guess a base directory rather than silently resolving under the project root.`
    );
    this.name = "UnresolvableUserScopeError";
  }
}

export class InvalidAgentFrontmatterError extends AiddError {
  readonly code = "invalid-agent-frontmatter";
  constructor(agentName: string, detail: string) {
    super(`Agent '${agentName}' has invalid frontmatter: ${detail}.`);
    this.name = "InvalidAgentFrontmatterError";
  }
}

export class InvalidPluginManifestError extends AiddError {
  readonly code: string = "invalid-plugin-manifest";
  constructor(detail?: string) {
    super(detail ? `Invalid plugin manifest: ${detail}` : "Invalid plugin manifest.");
    this.name = "InvalidPluginManifestError";
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

export class PluginNotFoundError extends AiddError {
  readonly code = "plugin-not-found";
  constructor(name: string) {
    super(`Plugin '${name}' is not installed.`);
    this.name = "PluginNotFoundError";
  }
}

export class DuplicatePluginError extends AiddError {
  readonly code = "duplicate-plugin";
  constructor(name: string) {
    super(`Plugin '${name}' is already installed.`);
    this.name = "DuplicatePluginError";
  }
}

export class PluginFetchError extends AiddError {
  readonly code = "plugin-fetch";
  constructor(detail: string) {
    super(`Failed to fetch plugin: ${detail}`);
    this.name = "PluginFetchError";
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

export class InvalidMarketplaceScopeError extends AiddError {
  readonly code = "invalid-marketplace-scope";
  constructor(scope: string) {
    super(`Invalid marketplace scope: "${scope}". Expected "project" or "user".`);
    this.name = "InvalidMarketplaceScopeError";
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

export class TrustDeniedError extends AiddError {
  readonly code = "trust-denied";
  constructor(name: string) {
    super(`Trust denied for marketplace '${name}'. Aborting.`);
    this.name = "TrustDeniedError";
  }
}

export class PluginNotInMarketplaceError extends AiddError {
  readonly code = "plugin-not-in-marketplace";
  constructor(plugin: string) {
    super(`Plugin '${plugin}' was not found in any registered marketplace.`);
    this.name = "PluginNotInMarketplaceError";
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

export class AmbiguousPluginMatchError extends AiddError {
  readonly code = "ambiguous-plugin-match";
  constructor(plugin: string, marketplaces: readonly string[]) {
    super(
      `Plugin '${plugin}' matches multiple marketplaces: ${marketplaces.join(", ")}. Use --from <marketplace>.`
    );
    this.name = "AmbiguousPluginMatchError";
  }
}

export class NoMarketplacesRegisteredError extends AiddError {
  readonly code = "no-marketplaces-registered";
  constructor() {
    super("No marketplaces registered. Use `aidd marketplace add <name> <source>` first.");
    this.name = "NoMarketplacesRegisteredError";
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

export class InteractiveOnlyError extends AiddError {
  readonly code = "interactive-only";
  constructor(action: string) {
    super(`'${action}' requires an interactive terminal.`);
    this.name = "InteractiveOnlyError";
  }
}

/** Each failure already reached the user through its own `output.warn` line, so this names
 * only the scopes and lets `errorHandler` be the one place turning a partly failed sync
 * into a non-zero exit. */
export class SyncFailedError extends AiddError {
  readonly code = "sync-failed";
  constructor(errors: readonly { scope: string; message: string }[]) {
    super(`Sync failed for: ${errors.map((e) => e.scope).join(", ")}. See the warnings above.`);
    this.name = "SyncFailedError";
  }
}

export class CatalogFetchNotFoundError extends AiddError {
  readonly code = "catalog-fetch-not-found";
  constructor(url: string) {
    super(`Catalog not found (HTTP 404): ${url}`);
    this.name = "CatalogFetchNotFoundError";
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

export class MissingPluginMetadataError extends AiddError {
  readonly code = "missing-plugin-metadata";
  constructor() {
    super("Cannot register github marketplace plugin: catalog entry is missing plugin metadata.");
    this.name = "MissingPluginMetadataError";
  }
}

export class JsonSchemaValidationError extends AiddError {
  readonly code = "json-schema-validation";
  constructor(errors: string[]) {
    super(`Manifest validation failed: ${errors.join("; ")}`);
    this.name = "JsonSchemaValidationError";
  }
}

export class FrameworkPlaceholderInPluginError extends AiddError {
  readonly code = "framework-placeholder-in-plugin";
  constructor(pluginName: string, relativePath: string) {
    super(
      `Framework placeholder '@{{TOOLS}}/' is not allowed inside plugin '${pluginName}' (file: ${relativePath}).`
    );
    this.name = "FrameworkPlaceholderInPluginError";
  }
}

export class InvalidBuildPathsError extends AiddError {
  readonly code = "invalid-build-paths";
  constructor(sourceDir: string, outDir: string) {
    super(
      `Refusing to build: --out '${outDir}' and --source '${sourceDir}' must not contain each other.`
    );
    this.name = "InvalidBuildPathsError";
  }
}

export class InvalidSourceMarketplaceError extends AiddError {
  readonly code = "invalid-source-marketplace";
  constructor(detail: string) {
    super(`Invalid source marketplace: ${detail}.`);
    this.name = "InvalidSourceMarketplaceError";
  }
}

export class OutDirNotDirectoryError extends AiddError {
  readonly code = "out-dir-not-directory";
  constructor(outDir: string) {
    super(`Refusing to build: --out '${outDir}' does not exist or is not a directory.`);
    this.name = "OutDirNotDirectoryError";
  }
}

export class FlatMergeTargetNotJsonError extends AiddError {
  readonly code = "flat-merge-target-not-json";
  constructor(shownPath: string, parseMessage: string) {
    super(`${shownPath} is not valid JSON (${parseMessage}); left untouched.`);
    this.name = "FlatMergeTargetNotJsonError";
  }
}

export class FlatTargetExistsError extends AiddError {
  readonly code = "flat-target-exists";
  constructor(targetPath: string, pluginName: string) {
    super(
      `Flat build conflict: '${targetPath}' already exists (plugin '${pluginName}'). ` +
        "Re-run with --force to overwrite."
    );
    this.name = "FlatTargetExistsError";
  }
}

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

export class InvalidSetupToolIdError extends AiddError {
  readonly code = "invalid-setup-tool-id";
  constructor(id: string, validIds: readonly string[]) {
    super(`Invalid tool ID: "${id}". Valid IDs: ${validIds.join(", ")}`);
    this.name = "InvalidSetupToolIdError";
  }
}

export class UserScopeUnavailableError extends AiddError {
  readonly code = "user-scope-unavailable";
  constructor() {
    super(
      "--scope user is not wired for this command yet — no user-scope manifest " +
        "repository was provided at construction."
    );
    this.name = "UserScopeUnavailableError";
  }
}

export class UserScopeIdeToolsError extends AiddError {
  readonly code = "user-scope-ide-tools";
  constructor(ideTools: readonly string[]) {
    super(
      `--global installs no project files, so an editor (${ideTools.join(", ")}) has ` +
        "nothing to install machine-wide. Drop it from --ide, or run `aidd setup --ide <ids>` " +
        "separately in the project."
    );
    this.name = "UserScopeIdeToolsError";
  }
}

export class UserScopeUnsupportedAiToolsError extends AiddError {
  readonly code = "user-scope-unsupported-ai-tools";
  constructor(aiTools: readonly string[]) {
    super(
      `--global installs through an IDE's own plugin CLI or its user configuration directory, and neither exists for: ${aiTools.join(", ")}. ` +
        "Drop them from --ide, or run `aidd setup --ide <ids>` in the project instead."
    );
    this.name = "UserScopeUnsupportedAiToolsError";
  }
}

export class UserScopeNoToolsError extends AiddError {
  readonly code = "user-scope-no-tools";
  constructor() {
    super(
      "--global with no --ide registers the shared source for no tool at all. Pass " +
        "`--ide <ids>` naming which tool to activate machine-wide."
    );
    this.name = "UserScopeNoToolsError";
  }
}

export class UserScopePluginModeError extends AiddError {
  readonly code = "user-scope-plugin-mode";
  constructor() {
    super(
      "--global cannot ask which plugins to install. Pass --plugins all, recommended, " +
        "none, or comma-separated names."
    );
    this.name = "UserScopePluginModeError";
  }
}

export class UserScopeFilterUnsupportedError extends AiddError {
  readonly code = "user-scope-filter-unsupported";
  constructor(flag: string, command: string) {
    super(
      `--scope user tracks nothing ${flag} can narrow — it names every requested tool, ` +
        `not one plugin or one file. Drop ${flag}, or run \`aidd ${command}\` at project scope.`
    );
    this.name = "UserScopeFilterUnsupportedError";
  }
}

export class InvalidPluginModeConfigError extends AiddError {
  readonly code = "invalid-plugin-mode-config";
  constructor(message: string) {
    super(message);
    this.name = "InvalidPluginModeConfigError";
  }
}

export class InvalidInstallScopeError extends AiddError {
  readonly code = "invalid-install-scope";
  constructor(value: string) {
    super(`Invalid scope '${value}'. Expected 'project' or 'user'.`);
    this.name = "InvalidInstallScopeError";
  }
}

export class UnknownAiToolIdError extends AiddError {
  readonly code = "unknown-ai-tool-id";
  constructor(tool: string, validIds: readonly string[]) {
    super(`Unknown AI tool: ${tool}. Valid AI tools: ${validIds.join(", ")}`);
    this.name = "UnknownAiToolIdError";
  }
}

export class NativePluginCliError extends AiddError {
  readonly code = "native-plugin-cli";
  constructor(message: string) {
    super(message);
    this.name = "NativePluginCliError";
  }
}

/** A host's own marketplace registry already holds this catalog's declared name pointed at a
 * genuinely *different* catalog, so registering it would steal or mislabel that name. A
 * project's local alias diverging from its catalog's declared name is not this, and is never
 * refused. */
export class MarketplaceSourceConflictError extends AiddError {
  readonly code = "marketplace-source-conflict";
  constructor(message: string) {
    super(message);
    this.name = "MarketplaceSourceConflictError";
  }
}

/** A host-facing registration must be keyed by the catalog's own declared name, and an
 * unreadable catalog leaves this CLI no other fact to key it by. Registering nothing beats
 * writing this project's local alias: a manifest that guessed would claim a `hostName` the
 * host was never asked to hold. */
export class UnreadableBuiltCatalogError extends AiddError {
  readonly code = "unreadable-built-catalog";
  constructor(path: string) {
    super(
      `Cannot read the marketplace catalog this project just built, at ${path} — nothing was ` +
        "registered for it. Run `aidd sync` again once the source is fixed."
    );
    this.name = "UnreadableBuiltCatalogError";
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

export class JsonParseError extends AiddError {
  readonly code = "json-parse";
  constructor(path: string, cause: string) {
    super(`Cannot parse existing JSON at ${path}: ${cause}`);
    this.name = "JsonParseError";
  }
}

export class AuthStorageError extends AiddError {
  readonly code = "auth-storage";
  constructor(message: string) {
    super(message);
    this.name = "AuthStorageError";
  }
}

export class GhCliError extends AiddError {
  readonly code = "gh-cli";
  constructor(message: string) {
    super(message);
    this.name = "GhCliError";
  }
}

export class AssetNotFoundError extends AiddError {
  readonly code = "asset-not-found";
  constructor(assetName: string) {
    super(`Bundled asset not found: '${assetName}'`);
    this.name = "AssetNotFoundError";
  }
}
export type ManifestUnavailableCode = "manifest-missing" | "manifest-corrupted";

const MANIFEST_UNAVAILABLE_MESSAGE: Record<ManifestUnavailableCode, string> = {
  "manifest-missing": "No AIDD manifest found. Run `aidd setup` to initialize your project.",
  "manifest-corrupted":
    "Manifest is corrupted (invalid JSON). Run `aidd clean --force` and re-initialize.",
};

/** A project's manifest cannot be had, for the reason the stable `code` names.
 *
 * Both messages name a command, so target 03 §9.3 keys them on a presentation code-to-message
 * table. That translator is not built yet: until it is, the words stay here, as ratchet debt. */
export class ManifestUnavailableError extends AiddError {
  constructor(
    readonly code: ManifestUnavailableCode,
    options?: ErrorOptions
  ) {
    super(MANIFEST_UNAVAILABLE_MESSAGE[code], options);
    this.name = "ManifestUnavailableError";
  }
}

export class AiddFilesDetectedError extends AiddError {
  readonly code = "aidd-files-detected";
  constructor() {
    super(
      "AIDD files detected but no manifest found.\nRun `aidd setup` to register existing files."
    );
    this.name = "AiddFilesDetectedError";
  }
}

export class AlreadyInitializedError extends AiddError {
  readonly code = "already-initialized";
  constructor(message = "Already initialized. Use `aidd update` to upgrade.") {
    super(message);
    this.name = "AlreadyInitializedError";
  }
}

export class InputRequiredError extends AiddError {
  readonly code = "input-required";
  constructor(message: string) {
    super(message);
    this.name = "InputRequiredError";
  }
}

export class ToolNotInstalledError extends AiddError {
  readonly code = "tool-not-installed";
  constructor(toolId: string, context?: string) {
    super(context ? `${context} '${toolId}' is not installed.` : `${toolId} is not installed`);
    this.name = "ToolNotInstalledError";
  }
}

/** A report period that cannot be answered; the message says what to give instead. */
export class InvalidReportPeriodError extends AiddError {
  readonly code = "invalid-report-period";
  constructor(message: string) {
    super(message);
    this.name = "InvalidReportPeriodError";
  }
}

/** `aidd telemetry task --none` given a name or a ticket. */
export class TaskDeclaredNoneWithNameError extends AiddError {
  readonly code = "task-declared-none-with-name";
  constructor() {
    super("--none declares no task: give it neither a name nor --ticket.");
    this.name = "TaskDeclaredNoneWithNameError";
  }
}

/** `aidd telemetry task` given neither a name nor `--none`. */
export class TaskNameMissingError extends AiddError {
  readonly code = "task-name-missing";
  constructor() {
    super(
      "A task needs a name: aidd telemetry task <name> [--ticket <ref>], or --none. See what the work is bound to with aidd telemetry status."
    );
    this.name = "TaskNameMissingError";
  }
}

/** `aidd telemetry on` told to name the person and to name nobody. */
export class ConflictingIdentityFlagsError extends AiddError {
  readonly code = "conflicting-identity-flags";
  constructor() {
    super("--as names you and --anonymous names nobody: give one of them.");
    this.name = "ConflictingIdentityFlagsError";
  }
}

/** `aidd telemetry identity --off` given an identifier to set. */
export class IdentityOffWithIdentifierError extends AiddError {
  readonly code = "identity-off-with-identifier";
  constructor() {
    super("--off removes the identity: give it no identifier.");
    this.name = "IdentityOffWithIdentifierError";
  }
}

/** `aidd telemetry on --as` given an identifier that cannot name a person. */
export class InvalidIdentityError extends AiddError {
  readonly code = "invalid-identity";
  constructor(message: string) {
    super(message);
    this.name = "InvalidIdentityError";
  }
}

/** One scope a machine-wide run could not finish, reported so the rest of the run still goes on. */
export interface GlobalExecutionError {
  scope: string;
  message: string;
}
