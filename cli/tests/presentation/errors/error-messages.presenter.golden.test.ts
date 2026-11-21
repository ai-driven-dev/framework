import { describe, expect, it } from "vitest";
import { AuthStorageError, GhCliError } from "../../../src/contexts/auth/domain/auth.error.js";
import {
  InvalidMarketplaceScopeError,
  MalformedMarketplaceCatalogError,
  MarketplaceAlreadyRegisteredError,
  MarketplaceNotFoundError,
  PluginFetchError,
  PluginNotInMarketplaceError,
  UnreadableMarketplaceRegistryError,
} from "../../../src/contexts/distribution/domain/distribution.error.js";
import {
  MarketplaceSourceConflictError,
  NativePluginCliError,
  UnreadableBuiltCatalogError,
} from "../../../src/contexts/host-registration/domain/host-registration.error.js";
import {
  ActiveMachineDependentsError,
  AiddFilesDetectedError,
  AlreadyInitializedError,
  DuplicatePluginError,
  InvalidManifestDataError,
  InvalidManifestToolIdError,
  InvalidPluginNameError,
  InvalidPluginScopeError,
  InvalidPluginVersionError,
  MalformedPluginScopeError,
  ManifestUnavailableError,
  MissingPluginMetadataError,
  PluginNotFoundError,
  ProjectScopeUnsupportedError,
  ToolNotInstalledError,
  UnresolvableUserScopeError,
} from "../../../src/contexts/installation/domain/installation.error.js";
import {
  ConflictingIdentityFlagsError,
  IdentityOffWithIdentifierError,
  InvalidIdentityError,
  InvalidReportPeriodError,
  TaskDeclaredNoneWithNameError,
  TaskNameMissingError,
} from "../../../src/contexts/telemetry/domain/telemetry.error.js";
import {
  CapabilityConfigError,
  DualConfigError,
  DuplicateToolIdError,
  InvalidAgentFrontmatterError,
  InvalidHooksDescriptorError,
  InvalidMcpServerConfigError,
  InvalidToolProfileError,
} from "../../../src/contexts/tools/domain/tools.error.js";
import {
  FlatMergeTargetNotJsonError,
  FlatTargetExistsError,
  FrameworkPlaceholderInPluginError,
  InvalidBuildPathsError,
  JsonSchemaValidationError,
  MarketplaceOutDirNotEmptyError,
  OutDirNotDirectoryError,
} from "../../../src/contexts/translate/domain/translate.error.js";
import {
  ElevatedPermissionUpdateError,
  FrameworkResolutionError,
  PackageManagerDetectionError,
  UpdateError,
} from "../../../src/contexts/update/domain/update.error.js";
import {
  AmbiguousPluginMatchError,
  CategoryMismatchError,
  InteractiveOnlyError,
  InvalidPluginModeConfigError,
  InvalidSetupToolIdError,
  NoMarketplacesRegisteredError,
  SyncFailedError,
  TrustDeniedError,
  UnknownAiToolIdError,
  UserScopeFilterUnsupportedError,
  UserScopeIdeToolsError,
  UserScopeNoToolsError,
  UserScopePluginModeError,
  UserScopeUnavailableError,
  UserScopeUnsupportedAiToolsError,
} from "../../../src/orchestration/orchestration.error.js";
import { render } from "../../../src/presentation/errors/error-translator.presenter.js";
import {
  AssetNotFoundError,
  AuthenticationError,
  CatalogFetchAuthError,
  CatalogFetchError,
  CatalogFetchNotFoundError,
  HttpError,
  HttpNotFoundError,
  HttpRedirectError,
  InputRequiredError,
  InvalidInstallScopeError,
  InvalidMarketplaceNameError,
  InvalidPluginManifestError,
  InvalidPluginSourceError,
  InvalidSourceMarketplaceError,
  JsonParseError,
  ManifestValidationError,
  McpConfigError,
  ToolNotInManifestError,
  UnreadableUserSourceReferencesError,
  UnregisteredToolError,
  VersionMismatchError,
} from "../../../src/shared/domain/shared.error.js";

/** Every catalogued error, built with fixed arguments, and the exact words it shows. */
const cases: [() => Error, string][] = [
  [() => new AssetNotFoundError("a.md"), "Bundled asset not found: 'a.md'"],
  [
    () => new AuthenticationError("HTTP 401"),
    "Authentication failed (HTTP 401). Run `aidd auth login` to authenticate.",
  ],
  [
    () => new CatalogFetchAuthError("https://x.test/c.json"),
    'Authentication required to fetch catalog from "https://x.test/c.json". Run `aidd auth login` first or use `--source local --path <dir>`.',
  ],
  [
    () => new CatalogFetchError("https://x.test/c.json", "boom"),
    'Failed to fetch catalog from "https://x.test/c.json": boom',
  ],
  [
    () => new CatalogFetchNotFoundError("https://x.test/c.json"),
    "Catalog not found (HTTP 404): https://x.test/c.json",
  ],
  [() => new HttpError(500, "https://x.test/a"), "Unexpected HTTP 500 from https://x.test/a"],
  [
    () => new HttpNotFoundError("https://x.test/a"),
    "Resource not found (HTTP 404): https://x.test/a",
  ],
  [
    () => new HttpRedirectError("https://x.test/a"),
    "HTTP redirect without location header from https://x.test/a",
  ],
  [() => new InputRequiredError("--tools flag is required"), "--tools flag is required"],
  [
    () => new InvalidInstallScopeError("team"),
    "Invalid scope 'team'. Expected 'project' or 'user'.",
  ],
  [
    () => new InvalidMarketplaceNameError("Bad Name"),
    'Invalid marketplace name: "Bad Name". Use lowercase alphanumeric characters and hyphens only.',
  ],
  [() => new InvalidPluginManifestError(), "Invalid plugin manifest."],
  [() => new InvalidPluginManifestError("bad field"), "Invalid plugin manifest: bad field"],
  [() => new InvalidPluginSourceError(), "Invalid plugin source."],
  [() => new InvalidPluginSourceError("bad url"), "Invalid plugin source: bad url"],
  [() => new InvalidSourceMarketplaceError("no name"), "Invalid source marketplace: no name."],
  [
    () => new JsonParseError("a.json", "Unexpected token"),
    "Cannot parse existing JSON at a.json: Unexpected token",
  ],
  [() => new ManifestValidationError("manifest invalid"), "manifest invalid"],
  [() => new McpConfigError("mcp invalid"), "mcp invalid"],
  [() => new ToolNotInManifestError("cursor"), "Tool 'cursor' is not installed in the manifest."],
  [
    () => new UnreadableUserSourceReferencesError("/p/references.json", "bad json"),
    "Cannot read the shared-source reference registry at /p/references.json: bad json. Repair the file, or delete it to start from an empty registry.",
  ],
  [() => new UnregisteredToolError("cursor"), "Tool 'cursor' is not registered."],
  [
    () => new VersionMismatchError("p", "1.0.0", "2.0.0"),
    "Plugin 'p': requested version '1.0.0' does not match catalog version '2.0.0'.",
  ],
  [() => new AuthStorageError("storage failed"), "storage failed"],
  [() => new GhCliError("gh failed"), "gh failed"],
  [
    () => new ElevatedPermissionUpdateError("npm i -g x"),
    "Update failed: the global package directory is not writable (EPERM/EACCES).\nPick one:\n  1. Run the terminal as Administrator (Windows) or with sudo (macOS/Linux), then re-run `aidd update`.\n  2. Move global installs to a user-writable prefix, then re-run the update:\n     Windows:  npm config set prefix %APPDATA%\\npm\n     macOS/Linux:  npm config set prefix ~/.npm-global\n  3. Run the update directly: npm i -g x",
  ],
  [() => new FrameworkResolutionError("no framework"), "no framework"],
  [
    () => new PackageManagerDetectionError(["npm i -g a", "pnpm add -g a"]),
    "Could not detect package manager. Run manually:\n  npm i -g a\n  pnpm add -g a",
  ],
  [
    () => new UpdateError(),
    "Update failed. If you saw a 403 error above, ensure your GitHub token includes both repo and read:packages scopes.\nUpdate your token at https://github.com/settings/tokens, then re-run `aidd auth login`.",
  ],
  [
    () => new ConflictingIdentityFlagsError(),
    "--as names you and --anonymous names nobody: give one of them.",
  ],
  [
    () => new IdentityOffWithIdentifierError(),
    "--off removes the identity: give it no identifier.",
  ],
  [
    () => new InvalidIdentityError(),
    "An identity is one non-empty line of at most 128 characters. Nothing was changed.",
  ],
  [() => new InvalidReportPeriodError("period invalid"), "period invalid"],
  [
    () => new TaskDeclaredNoneWithNameError(),
    "--none declares no task: give it neither a name nor --ticket.",
  ],
  [
    () => new TaskNameMissingError(),
    "A task needs a name: aidd telemetry task <name> [--ticket <ref>], or --none. See what the work is bound to with aidd telemetry status.",
  ],
  [
    () => new InvalidMarketplaceScopeError("team"),
    'Invalid marketplace scope: "team". Expected "project" or "user".',
  ],
  [
    () => new MalformedMarketplaceCatalogError("/p/c.json", "bad", true),
    "Invalid plugin manifest: catalog at \"/p/c.json\" is malformed (bad). Run 'aidd marketplace refresh --force' to re-fetch a clean copy.",
  ],
  [
    () => new MalformedMarketplaceCatalogError("/p/c.json", "bad", false),
    'Invalid plugin manifest: catalog at "/p/c.json" is malformed (bad). Fix or re-create the marketplace catalog file.',
  ],
  [() => new MarketplaceAlreadyRegisteredError("m"), "Marketplace 'm' is already registered."],
  [() => new MarketplaceNotFoundError("m"), "Marketplace 'm' is not registered."],
  [() => new PluginFetchError("boom"), "Failed to fetch plugin: boom"],
  [
    () => new PluginNotInMarketplaceError("p"),
    "Plugin 'p' was not found in any registered marketplace.",
  ],
  [
    () => new UnreadableMarketplaceRegistryError("/p/r.json", "bad"),
    "Cannot read the marketplace registry at /p/r.json: bad. Repair the file, or delete it to start from an empty registry.",
  ],
  [
    () => new FlatMergeTargetNotJsonError("a.json", "bad"),
    "a.json is not valid JSON (bad); left untouched.",
  ],
  [
    () => new FlatTargetExistsError("/o/x", "p"),
    "Flat build conflict: '/o/x' already exists (plugin 'p'). Re-run with --force to overwrite.",
  ],
  [
    () => new FrameworkPlaceholderInPluginError("p", "a.md"),
    "Framework placeholder '@{{TOOLS}}/' is not allowed inside plugin 'p' (file: a.md).",
  ],
  [
    () => new InvalidBuildPathsError("src", "out"),
    "Refusing to build: --out 'out' and --source 'src' must not contain each other.",
  ],
  [() => new JsonSchemaValidationError(["a", "b"]), "Manifest validation failed: a; b"],
  [
    () => new MarketplaceOutDirNotEmptyError("/o"),
    "Refusing to build: '/o' is not empty. Re-run with --force to overwrite files this build produces, or choose an empty --out directory.",
  ],
  [
    () => new OutDirNotDirectoryError("/o"),
    "Refusing to build: --out '/o' does not exist or is not a directory.",
  ],
  [() => new CapabilityConfigError("cfg invalid"), "cfg invalid"],
  [() => new DuplicateToolIdError("cursor"), "Tool 'cursor' is registered twice."],
  [() => new InvalidAgentFrontmatterError("a", "bad"), "Agent 'a' has invalid frontmatter: bad."],
  [
    () => new InvalidHooksDescriptorError("claude", "unknown-event", "detail"),
    "The hooks descriptor of 'claude' breaks 'unknown-event': detail",
  ],
  [
    () => new InvalidMcpServerConfigError("srv"),
    'MCP server "srv" must have either a "command" or "url" field',
  ],
  [
    () => new InvalidToolProfileError("claude", "no-build-contract", "detail"),
    "The profile of 'claude' breaks 'no-build-contract': detail",
  ],
  [
    () => new DualConfigError("opencode", "opencode.json and opencode.jsonc exist"),
    "Both opencode.json and opencode.jsonc exist. Remove one.",
  ],
  [() => new MarketplaceSourceConflictError("conflict"), "conflict"],
  [() => new NativePluginCliError("cli failed"), "cli failed"],
  [
    () => new UnreadableBuiltCatalogError("/p/c.json"),
    "Cannot read the marketplace catalog this project just built, at /p/c.json — nothing was registered for it. Run `aidd sync` again once the source is fixed.",
  ],
  [
    () => new ActiveMachineDependentsError("t", ["a", "b"]),
    "Cannot remove t: active projects still depend on it: a, b.",
  ],
  [
    () => new AiddFilesDetectedError(),
    "AIDD files detected but no manifest found.\nRun `aidd setup` to register existing files.",
  ],
  [() => new AlreadyInitializedError(), "Already initialized. Use `aidd update` to upgrade."],
  [() => new AlreadyInitializedError("custom"), "custom"],
  [() => new DuplicatePluginError("p"), "Plugin 'p' is already installed."],
  [() => new InvalidManifestDataError(), "Invalid manifest data."],
  [() => new InvalidManifestDataError("detail"), "Invalid manifest data: detail"],
  [() => new InvalidManifestToolIdError("k"), "Invalid tool id in manifest: 'k'."],
  [
    () => new InvalidPluginNameError("N"),
    'Invalid plugin name: "N". Use lowercase alphanumeric characters and hyphens only.',
  ],
  [
    () => new InvalidPluginScopeError("cursor", "project", "user"),
    "Tool 'cursor' does not support scope 'project'. Supported scope: 'user'. Re-run with --scope user or omit the flag.",
  ],
  [
    () => new InvalidPluginVersionError("x"),
    'Invalid plugin version: "x". Expected semver format (e.g. 1.0.0).',
  ],
  [
    () => new MalformedPluginScopeError("p", "team"),
    'Plugin "p" carries an invalid scope: "team". Expected "project" or "user".',
  ],
  [
    () => new ManifestUnavailableError("manifest-missing"),
    "No AIDD manifest found. Run `aidd setup` to initialize your project.",
  ],
  [
    () => new ManifestUnavailableError("manifest-corrupted"),
    "Manifest is corrupted (invalid JSON). Run `aidd clean --force` and re-initialize.",
  ],
  [
    () => new MissingPluginMetadataError(),
    "Cannot register github marketplace plugin: catalog entry is missing plugin metadata.",
  ],
  [() => new PluginNotFoundError("p"), "Plugin 'p' is not installed."],
  [
    () => new ProjectScopeUnsupportedError(),
    "Cursor plugins only support user-scope install (~/.cursor/plugins/local/). Project-scope is not auto-loaded by Cursor.",
  ],
  [() => new ToolNotInstalledError("cursor"), "cursor is not installed"],
  [() => new ToolNotInstalledError("cursor", "Tool"), "Tool 'cursor' is not installed."],
  [
    () => new UnresolvableUserScopeError("cursor"),
    'Manifest records a user-scope plugin for "cursor", but this tool\'s profile declares no user-scope plugins directory. Refusing to guess a base directory rather than silently resolving under the project root.',
  ],
  [
    () => new AmbiguousPluginMatchError("p", ["a", "b"]),
    "Plugin 'p' matches multiple marketplaces: a, b. Use --from <marketplace>.",
  ],
  [
    () => new CategoryMismatchError(["x"], "ai", ["claude"]),
    "x is not an AI tool. Valid AI tools: claude",
  ],
  [
    () => new CategoryMismatchError(["x", "y"], "ide", ["vscode"]),
    "x, y are not IDE tools. Valid IDE tools: vscode",
  ],
  [() => new InteractiveOnlyError("a"), "'a' requires an interactive terminal."],
  [() => new InvalidPluginModeConfigError("mode invalid"), "mode invalid"],
  [() => new InvalidSetupToolIdError("x", ["a", "b"]), 'Invalid tool ID: "x". Valid IDs: a, b'],
  [
    () => new NoMarketplacesRegisteredError(),
    "No marketplaces registered. Use `aidd marketplace add <name> <source>` first.",
  ],
  [
    () => new SyncFailedError([{ scope: "a", error: "m" }]),
    "Sync failed for: a. See the warnings above.",
  ],
  [() => new TrustDeniedError("m"), "Trust denied for marketplace 'm'. Aborting."],
  [() => new UnknownAiToolIdError("x", ["a"]), "Unknown AI tool: x. Valid AI tools: a"],
  [
    () => new UserScopeFilterUnsupportedError("--plugin", "sync"),
    "--scope user tracks nothing --plugin can narrow — it names every requested tool, not one plugin or one file. Drop --plugin, or run `aidd sync` at project scope.",
  ],
  [
    () => new UserScopeIdeToolsError(["vscode"]),
    "--global installs no project files, so an editor (vscode) has nothing to install machine-wide. Drop it from --ide, or run `aidd setup --ide <ids>` separately in the project.",
  ],
  [
    () => new UserScopeNoToolsError(),
    "--global with no --ide registers the shared source for no tool at all. Pass `--ide <ids>` naming which tool to activate machine-wide.",
  ],
  [
    () => new UserScopePluginModeError(),
    "--global cannot ask which plugins to install. Pass --plugins all, recommended, none, or comma-separated names.",
  ],
  [
    () => new UserScopeUnavailableError(),
    "--scope user is not wired for this command yet — no user-scope manifest repository was provided at construction.",
  ],
  [
    () => new UserScopeUnsupportedAiToolsError(["x"]),
    "--global installs through an IDE's own plugin CLI or its user configuration directory, and neither exists for: x. Drop them from --ide, or run `aidd setup --ide <ids>` in the project instead.",
  ],
];

describe("the words of each catalogued error", () => {
  it.each(cases.map(([build, expected]) => ({ name: build().name, build, expected })))(
    "$name",
    ({ build, expected }) => {
      expect(render(build())).toBe(expected);
    }
  );
});
