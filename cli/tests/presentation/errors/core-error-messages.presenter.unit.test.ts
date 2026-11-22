import { describe, expect, it } from "vitest";
import { AuthStorageError, GhCliError } from "../../../src/contexts/auth/domain/auth.error.js";
import {
  ConflictingIdentityFlagsError,
  IdentityOffWithIdentifierError,
  InvalidIdentityError,
  InvalidReportPeriodError,
  TaskDeclaredNoneWithNameError,
  TaskNameMissingError,
} from "../../../src/contexts/telemetry/domain/telemetry.error.js";
import {
  ElevatedPermissionUpdateError,
  FrameworkResolutionError,
  PackageManagerDetectionError,
  UpdateError,
} from "../../../src/contexts/update/domain/update.error.js";
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
  InvalidPluginNameError,
  InvalidPluginSourceError,
  InvalidPluginVersionError,
  InvalidSourceMarketplaceError,
  JsonParseError,
  ManifestValidationError,
  McpConfigError,
  ToolNotInManifestError,
  UnreadableUserSourceReferencesError,
  UnregisteredToolError,
  VersionMismatchError,
} from "../../../src/shared/domain/shared.error.js";

/** Every error of transport, authentication, update and telemetry, built with fixed arguments, and the exact words it shows. */
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
  [
    () => new InvalidPluginNameError("N"),
    'Invalid plugin name: "N". Use lowercase alphanumeric characters and hyphens only.',
  ],
  [() => new InvalidPluginSourceError(), "Invalid plugin source."],
  [() => new InvalidPluginSourceError("bad url"), "Invalid plugin source: bad url"],
  [
    () => new InvalidPluginVersionError("x"),
    'Invalid plugin version: "x". Expected semver format (e.g. 1.0.0).',
  ],
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
];

describe("the words of the errors of transport, authentication, update and telemetry", () => {
  it.each(cases.map(([build, expected]) => ({ name: build().name, build, expected })))(
    "$name",
    ({ build, expected }) => {
      expect(render(build())).toBe(expected);
    }
  );
});
