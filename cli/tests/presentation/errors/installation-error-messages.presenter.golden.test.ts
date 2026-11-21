import { describe, expect, it } from "vitest";
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

/** Every error of installing, registering and orchestrating tools and plugins, built with fixed arguments, and the exact words it shows. */
const cases: [() => Error, string][] = [
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

describe("the words of the errors of installing, registering and orchestrating tools and plugins", () => {
  it.each(cases.map(([build, expected]) => ({ name: build().name, build, expected })))(
    "$name",
    ({ build, expected }) => {
      expect(render(build())).toBe(expected);
    }
  );
});
