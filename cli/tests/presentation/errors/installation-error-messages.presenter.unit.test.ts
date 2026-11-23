import { describe, expect, it } from "vitest";
import {
  MarketplaceSourceConflictError,
  NativePluginCliError,
  UnreadableBuiltCatalogError,
} from "../../../src/contexts/host-registration/contract/host-registration.error.js";
import {
  ActiveMachineDependentsError,
  AiddFilesDetectedError,
  AlreadyInitializedError,
  DuplicatePluginError,
  InvalidManifestDataError,
  InvalidManifestToolIdError,
  InvalidPluginScopeError,
  MalformedPluginScopeError,
  ManifestMigrationError,
  ManifestUnavailableError,
  MissingPluginMetadataError,
  PluginNotFoundError,
  ProjectHooksEditedError,
  ProjectScopeUnsupportedError,
  SharedSourceUnregisteredError,
  ToolNotInstalledError,
  UnresolvableUserScopeError,
  UnsupportedManifestVersionError,
} from "../../../src/contexts/installation/contract/installation.error.js";
import {
  EditedAfterInstallError,
  NoUserPluginsDirectoryError,
  PluginDirectoryDisappearedError,
  PluginDirectoryOutsideBoundaryError,
  UnprovenInstallDigestError,
  UpdateParentEscapesBoundaryError,
  UpdatePathEscapesPluginError,
  UserManifestBusyError,
} from "../../../src/contexts/machine-claims/contract/machine-claims.error.js";
import {
  AmbiguousPluginMatchError,
  CategoryMismatchError,
  InteractiveOnlyError,
  InvalidPluginModeConfigError,
  InvalidSetupToolIdError,
  NoMarketplacesRegisteredError,
  SyncFailedError,
  TrustDeniedError,
  UserPluginUpdatePartialError,
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
  [
    () => new MarketplaceSourceConflictError("conflict"),
    "conflict Reconcile the host source manually before retrying `aidd sync`.",
  ],
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
  [
    () => new AlreadyInitializedError("clean-then-setup"),
    "Already initialized. Run `aidd clean --force` then `aidd setup` to reset completely.",
  ],
  [
    () =>
      new ProjectHooksEditedError(
        "claude project hooks for 'p' were edited after install; detach refused."
      ),
    "claude project hooks for 'p' were edited after install; detach refused. Rerun aidd sync --force to restore it, or aidd clean --force to remove it.",
  ],
  [
    () =>
      new ProjectHooksEditedError(
        "claude hook script 'a/b.sh' was edited during reinstall; removal refused."
      ),
    "claude hook script 'a/b.sh' was edited during reinstall; removal refused. Rerun aidd sync --force to restore it, or aidd clean --force to remove it.",
  ],
  [
    () =>
      new SharedSourceUnregisteredError(
        "claude: the shared framework source is not registered, so 'p' cannot be rebuilt"
      ),
    "claude: the shared framework source is not registered, so 'p' cannot be rebuilt; run `aidd setup --global`.",
  ],
  [
    () =>
      new UnsupportedManifestVersionError(
        "manifest version 10 was written by a newer CLI than this one."
      ),
    "Invalid manifest data: manifest version 10 was written by a newer CLI than this one. Run `aidd update` to update this CLI, then try again.",
  ],
  [
    () =>
      new UnsupportedManifestVersionError(
        "manifest version 5 predates version 8, the oldest one this CLI reads. No published CLI can write this version: delete m on this machine",
        "user"
      ),
    "Invalid manifest data: manifest version 5 predates version 8, the oldest one this CLI reads. No published CLI can write this version: delete m on this machine, then run `aidd setup --global` to reinstall the framework.",
  ],
  [
    () => new ManifestMigrationError("m", "disk full"),
    "Cannot move the host registrations out of m: disk full. The manifest is unchanged; run the command again once the file can be written.",
  ],
  [() => new DuplicatePluginError("p"), "Plugin 'p' is already installed."],
  [() => new InvalidManifestDataError(), "Invalid manifest data."],
  [() => new InvalidManifestDataError("detail"), "Invalid manifest data: detail"],
  [() => new InvalidManifestToolIdError("k"), "Invalid tool id in manifest: 'k'."],
  [
    () => new InvalidPluginScopeError("cursor", "project", "user"),
    "Tool 'cursor' does not support scope 'project'. Supported scope: 'user'. Re-run with --scope user or omit the flag.",
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
    () => new UserPluginUpdatePartialError("cursor", { cause: new Error("disk full") }),
    "cursor: user plugin file update failed after preflight; a native ref may already have been updated and file bytes may be partial. Canonical claim not saved; reconcile manually before retrying.",
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
  [
    () => new UnprovenInstallDigestError("cursor", "p", "a.md"),
    "cursor: 'p' file 'a.md' has an unproven install digest; removal refused.",
  ],
  [
    () => new EditedAfterInstallError("cursor", "p", "a.md"),
    "cursor: 'p' file 'a.md' was edited after install; removal refused.",
  ],
  [
    () => new NoUserPluginsDirectoryError("cursor"),
    "cursor: no user plugins directory is declared.",
  ],
  [
    () => new PluginDirectoryOutsideBoundaryError("cursor", "p", "/base"),
    "cursor: 'p' directory is not safely inside /base; update refused.",
  ],
  [
    () => new UpdatePathEscapesPluginError("cursor", "p", "../x"),
    "cursor: 'p' update path '../x' escapes its plugin directory.",
  ],
  [
    () => new UpdateParentEscapesBoundaryError("cursor", "p", "/out", "/base"),
    "cursor: 'p' update parent '/out' escapes /base.",
  ],
  [
    () => new PluginDirectoryDisappearedError("cursor", "p"),
    "cursor: 'p' directory disappeared during update.",
  ],
  [
    () => new UserManifestBusyError("/m.lock"),
    "User manifest is busy: /m.lock. Retry after the other AIDD operation finishes.",
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
