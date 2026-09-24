import { describe, expect, it } from "vitest";
import * as errors from "../../src/kernel/errors.js";

describe("NoManifestError", () => {
  it("includes aidd setup hint in message", () => {
    const error = new errors.NoManifestError();
    expect(error.message).toContain("aidd setup");
    expect(error.name).toBe("NoManifestError");
  });
});

describe("AiddFilesDetectedError", () => {
  it("includes setup hint in message", () => {
    const error = new errors.AiddFilesDetectedError();
    expect(error.message).toContain("AIDD files detected but no manifest found");
    expect(error.message).toContain("aidd setup");
    expect(error.name).toBe("AiddFilesDetectedError");
  });
});

describe("FlatTargetExistsError", () => {
  it("has correct error name", () => {
    const error = new errors.FlatTargetExistsError(
      "/out/.github/agents/my-plugin/foo.agent.md",
      "my-plugin"
    );
    expect(error.name).toBe("FlatTargetExistsError");
  });

  it("includes the conflicting path in the message", () => {
    const error = new errors.FlatTargetExistsError(
      "/out/.github/agents/my-plugin/foo.agent.md",
      "my-plugin"
    );
    expect(error.message).toContain("/out/.github/agents/my-plugin/foo.agent.md");
  });

  it("includes the plugin name in the message", () => {
    const error = new errors.FlatTargetExistsError(
      "/out/.github/agents/my-plugin/foo.agent.md",
      "my-plugin"
    );
    expect(error.message).toContain("my-plugin");
  });

  it("mentions --force hint in message", () => {
    const error = new errors.FlatTargetExistsError(
      "/out/.github/agents/my-plugin/foo.agent.md",
      "my-plugin"
    );
    expect(error.message).toContain("--force");
  });
});

describe("OutDirNotDirectoryError", () => {
  it("has correct error name", () => {
    const error = new errors.OutDirNotDirectoryError("/tmp/some-out");
    expect(error.name).toBe("OutDirNotDirectoryError");
  });

  it("includes the outDir path in the message", () => {
    const error = new errors.OutDirNotDirectoryError("/tmp/some-out");
    expect(error.message).toContain("/tmp/some-out");
  });

  it("does not mention source directory in the message", () => {
    const error = new errors.OutDirNotDirectoryError("/tmp/some-out");
    expect(error.message).not.toContain("--source");
    expect(error.message).toContain("not a directory");
  });
});

describe("AlreadyInitializedError", () => {
  it("has default message when no argument provided", () => {
    const error = new errors.AlreadyInitializedError();
    expect(error.name).toBe("AlreadyInitializedError");
    expect(error.message).toContain("Already initialized");
  });

  it("uses provided message when given", () => {
    const error = new errors.AlreadyInitializedError("Custom message here.");
    expect(error.message).toBe("Custom message here.");
  });
});

describe("InputRequiredError", () => {
  it("carries the provided message", () => {
    const error = new errors.InputRequiredError("Prompt answer is required.");
    expect(error.name).toBe("InputRequiredError");
    expect(error.message).toBe("Prompt answer is required.");
  });
});

describe("ToolNotInstalledError", () => {
  it("includes tool ID in message without context", () => {
    const error = new errors.ToolNotInstalledError("claude");
    expect(error.name).toBe("ToolNotInstalledError");
    expect(error.message).toContain("claude");
  });

  it("includes context and tool ID when context is provided", () => {
    const error = new errors.ToolNotInstalledError("cursor", "The target tool");
    expect(error.message).toContain("cursor");
    expect(error.message).toContain("The target tool");
  });
});

describe("HttpRedirectError", () => {
  it("includes the URL in the message and sets error name", () => {
    const error = new errors.HttpRedirectError("https://example.com/redirect");
    expect(error.name).toBe("HttpRedirectError");
    expect(error.message).toContain("https://example.com/redirect");
    expect(error.url).toBe("https://example.com/redirect");
  });
});

describe("JsonParseError", () => {
  it("includes the path and cause in the message", () => {
    const error = new errors.JsonParseError("/some/file.json", "Unexpected token");
    expect(error.name).toBe("JsonParseError");
    expect(error.message).toContain("/some/file.json");
    expect(error.message).toContain("Unexpected token");
  });
});

describe("AuthStorageError", () => {
  it("carries the provided message", () => {
    const error = new errors.AuthStorageError("Failed to write auth file");
    expect(error.name).toBe("AuthStorageError");
    expect(error.message).toBe("Failed to write auth file");
  });
});

describe("every error in the catalog", () => {
  const catalogue: readonly {
    readonly build: () => Error;
    readonly name: string;
    readonly message: string;
  }[] = [
    {
      build: () => new errors.CapabilityConfigError("cap broke"),
      name: "CapabilityConfigError",
      message: "cap broke",
    },
    {
      build: () => new errors.CursorProjectScopeUnsupportedError(),
      name: "CursorProjectScopeUnsupportedError",
      message:
        "Cursor plugins only support user-scope install (~/.cursor/plugins/local/). Project-scope is not auto-loaded by Cursor.",
    },
    {
      build: () => new errors.InvalidPluginScopeError("cursor", "project", "user"),
      name: "InvalidPluginScopeError",
      message:
        "Tool 'cursor' does not support scope 'project'. Supported scope: 'user'. Re-run with --scope user or omit the flag.",
    },
    {
      build: () => new errors.AuthenticationError("gh"),
      name: "AuthenticationError",
      message: "Authentication failed (gh). Run `aidd auth login` to authenticate.",
    },
    {
      build: () => new errors.UpdateError(),
      name: "UpdateError",
      message:
        "Update failed. If you saw a 403 error above, ensure your GitHub token includes both repo and read:packages scopes.\nUpdate your token at https://github.com/settings/tokens, then re-run `aidd auth login`.",
    },
    {
      build: () => new errors.ElevatedPermissionUpdateError("npm install -g x@latest"),
      name: "ElevatedPermissionUpdateError",
      message: [
        "Update failed: the global package directory is not writable (EPERM/EACCES).",
        "Pick one:",
        "  1. Run the terminal as Administrator (Windows) or with sudo (macOS/Linux), then re-run `aidd update`.",
        "  2. Move global installs to a user-writable prefix, then re-run the update:",
        "     Windows:  npm config set prefix %APPDATA%\\npm",
        "     macOS/Linux:  npm config set prefix ~/.npm-global",
        "  3. Run the update directly: npm install -g x@latest",
      ].join("\n"),
    },
    {
      build: () => new errors.ManifestValidationError("bad manifest"),
      name: "ManifestValidationError",
      message: "bad manifest",
    },
    {
      build: () => new errors.McpConfigError("bad mcp"),
      name: "McpConfigError",
      message: "bad mcp",
    },
    {
      build: () => new errors.FrameworkResolutionError("no framework"),
      name: "FrameworkResolutionError",
      message: "no framework",
    },
    {
      build: () => new errors.CategoryMismatchError(["vscode"], "ai", ["claude", "cursor"]),
      name: "CategoryMismatchError",
      message: "vscode is not an AI tool. Valid AI tools: claude, cursor",
    },
    {
      build: () => new errors.CategoryMismatchError(["claude", "cursor"], "ide", ["vscode"]),
      name: "CategoryMismatchError",
      message: "claude, cursor are not IDE tools. Valid IDE tools: vscode",
    },
    {
      build: () => new errors.UnregisteredToolError("zed"),
      name: "UnregisteredToolError",
      message: "Tool 'zed' is not registered.",
    },
    {
      build: () => new errors.ToolNotInManifestError("zed"),
      name: "ToolNotInManifestError",
      message: "Tool 'zed' is not installed in the manifest.",
    },
    {
      build: () => new errors.InvalidManifestDataError("version missing"),
      name: "InvalidManifestDataError",
      message: "Invalid manifest data: version missing",
    },
    {
      build: () => new errors.InvalidManifestDataError(),
      name: "InvalidManifestDataError",
      message: "Invalid manifest data.",
    },
    {
      build: () => new errors.InvalidManifestToolIdError("zed"),
      name: "InvalidManifestToolIdError",
      message: "Invalid tool id in manifest: 'zed'.",
    },
    {
      build: () => new errors.InvalidMcpServerConfigError("db"),
      name: "InvalidMcpServerConfigError",
      message: 'MCP server "db" must have either a "command" or "url" field',
    },
    {
      build: () => new errors.OpencodeDualConfigError(),
      name: "OpencodeDualConfigError",
      message: "Both opencode.json and opencode.jsonc exist. Remove one.",
    },
    {
      build: () => new errors.PackageManagerDetectionError(["npm i -g x", "pnpm add -g x"]),
      name: "PackageManagerDetectionError",
      message: "Could not detect package manager. Run manually:\n  npm i -g x\n  pnpm add -g x",
    },
    {
      build: () => new errors.InvalidPluginSourceError("no kind"),
      name: "InvalidPluginSourceError",
      message: "Invalid plugin source: no kind",
    },
    {
      build: () => new errors.InvalidPluginSourceError(),
      name: "InvalidPluginSourceError",
      message: "Invalid plugin source.",
    },
    {
      build: () => new errors.InvalidPluginNameError("My Plugin"),
      name: "InvalidPluginNameError",
      message:
        'Invalid plugin name: "My Plugin". Use lowercase alphanumeric characters and hyphens only.',
    },
    {
      build: () => new errors.InvalidPluginVersionError("latest"),
      name: "InvalidPluginVersionError",
      message: 'Invalid plugin version: "latest". Expected semver format (e.g. 1.0.0).',
    },
    {
      build: () => new errors.MalformedPluginScopeError("aidd-dev", "global"),
      name: "MalformedPluginScopeError",
      message:
        'Plugin "aidd-dev" carries an invalid scope: "global". Expected "project" or "user".',
    },
    {
      build: () => new errors.UnresolvableUserScopeError("cursor"),
      name: "UnresolvableUserScopeError",
      message:
        'Manifest records a user-scope plugin for "cursor", but this tool\'s profile declares no user-scope plugins directory. Refusing to guess a base directory rather than silently resolving under the project root.',
    },
    {
      build: () => new errors.InvalidPluginManifestError("name missing"),
      name: "InvalidPluginManifestError",
      message: "Invalid plugin manifest: name missing",
    },
    {
      build: () => new errors.InvalidPluginManifestError(),
      name: "InvalidPluginManifestError",
      message: "Invalid plugin manifest.",
    },
    {
      build: () => new errors.MalformedMarketplaceCatalogError("/c.json", "not json", true),
      name: "MalformedMarketplaceCatalogError",
      message:
        "Invalid plugin manifest: catalog at \"/c.json\" is malformed (not json). Run 'aidd marketplace refresh --force' to re-fetch a clean copy.",
    },
    {
      build: () => new errors.MalformedMarketplaceCatalogError("/c.json", "not json", false),
      name: "MalformedMarketplaceCatalogError",
      message:
        'Invalid plugin manifest: catalog at "/c.json" is malformed (not json). Fix or re-create the marketplace catalog file.',
    },
    {
      build: () => new errors.PluginNotFoundError("aidd-dev"),
      name: "PluginNotFoundError",
      message: "Plugin 'aidd-dev' is not installed.",
    },
    {
      build: () => new errors.DuplicatePluginError("aidd-dev"),
      name: "DuplicatePluginError",
      message: "Plugin 'aidd-dev' is already installed.",
    },
    {
      build: () => new errors.PluginFetchError("clone refused"),
      name: "PluginFetchError",
      message: "Failed to fetch plugin: clone refused",
    },
    {
      build: () => new errors.InvalidMarketplaceNameError("My Market"),
      name: "InvalidMarketplaceNameError",
      message:
        'Invalid marketplace name: "My Market". Use lowercase alphanumeric characters and hyphens only.',
    },
    {
      build: () => new errors.InvalidMarketplaceScopeError("global"),
      name: "InvalidMarketplaceScopeError",
      message: 'Invalid marketplace scope: "global". Expected "project" or "user".',
    },
    {
      build: () => new errors.MarketplaceAlreadyRegisteredError("aidd"),
      name: "MarketplaceAlreadyRegisteredError",
      message: "Marketplace 'aidd' is already registered.",
    },
    {
      build: () => new errors.MarketplaceNotFoundError("aidd"),
      name: "MarketplaceNotFoundError",
      message: "Marketplace 'aidd' is not registered.",
    },
    {
      build: () => new errors.TrustDeniedError("aidd"),
      name: "TrustDeniedError",
      message: "Trust denied for marketplace 'aidd'. Aborting.",
    },
    {
      build: () => new errors.PluginNotInMarketplaceError("aidd-dev"),
      name: "PluginNotInMarketplaceError",
      message: "Plugin 'aidd-dev' was not found in any registered marketplace.",
    },
    {
      build: () => new errors.VersionMismatchError("aidd-dev", "1.0.0", "2.0.0"),
      name: "VersionMismatchError",
      message:
        "Plugin 'aidd-dev': requested version '1.0.0' does not match catalog version '2.0.0'.",
    },
    {
      build: () => new errors.AmbiguousPluginMatchError("aidd-dev", ["a", "b"]),
      name: "AmbiguousPluginMatchError",
      message: "Plugin 'aidd-dev' matches multiple marketplaces: a, b. Use --from <marketplace>.",
    },
    {
      build: () => new errors.NoMarketplacesRegisteredError(),
      name: "NoMarketplacesRegisteredError",
      message: "No marketplaces registered. Use `aidd marketplace add <name> <source>` first.",
    },
    {
      build: () => new errors.UnreadableMarketplaceRegistryError("/r.json", "EACCES"),
      name: "UnreadableMarketplaceRegistryError",
      message:
        "Cannot read the marketplace registry at /r.json: EACCES. Repair the file, or delete it to start from an empty registry.",
    },
    {
      build: () => new errors.UnreadableUserSourceReferencesError("/refs.json", "EACCES"),
      name: "UnreadableUserSourceReferencesError",
      message:
        "Cannot read the shared-source reference registry at /refs.json: EACCES. Repair the file, or delete it to start from an empty registry.",
    },
    {
      build: () => new errors.InteractiveOnlyError("aidd setup"),
      name: "InteractiveOnlyError",
      message: "'aidd setup' requires an interactive terminal.",
    },
    {
      build: () =>
        new errors.SyncFailedError([
          { scope: "claude", message: "x" },
          { scope: "codex", message: "y" },
        ]),
      name: "SyncFailedError",
      message: "Sync failed for: claude, codex. See the warnings above.",
    },
    {
      build: () => new errors.CatalogFetchNotFoundError("https://x/c.json"),
      name: "CatalogFetchNotFoundError",
      message: "Catalog not found (HTTP 404): https://x/c.json",
    },
    {
      build: () => new errors.CatalogFetchAuthError("https://x/c.json"),
      name: "CatalogFetchAuthError",
      message:
        'Authentication required to fetch catalog from "https://x/c.json". Run `aidd auth login` first or use `--source local --path <dir>`.',
    },
    {
      build: () => new errors.CatalogFetchError("https://x/c.json", "timeout"),
      name: "CatalogFetchError",
      message: 'Failed to fetch catalog from "https://x/c.json": timeout',
    },
    {
      build: () => new errors.MissingPluginMetadataError(),
      name: "MissingPluginMetadataError",
      message:
        "Cannot register github marketplace plugin: catalog entry is missing plugin metadata.",
    },
    {
      build: () => new errors.JsonSchemaValidationError(["a", "b"]),
      name: "JsonSchemaValidationError",
      message: "Manifest validation failed: a; b",
    },
    {
      build: () => new errors.FrameworkPlaceholderInPluginError("aidd-dev", "skills/x.md"),
      name: "FrameworkPlaceholderInPluginError",
      message:
        "Framework placeholder '@{{TOOLS}}/' is not allowed inside plugin 'aidd-dev' (file: skills/x.md).",
    },
    {
      build: () => new errors.InvalidBuildPathsError("/src", "/src/out"),
      name: "InvalidBuildPathsError",
      message:
        "Refusing to build: --out '/src/out' and --source '/src' must not contain each other.",
    },
    {
      build: () => new errors.InvalidSourceMarketplaceError("no plugins"),
      name: "InvalidSourceMarketplaceError",
      message: "Invalid source marketplace: no plugins.",
    },
    {
      build: () => new errors.OutDirNotDirectoryError("/out"),
      name: "OutDirNotDirectoryError",
      message: "Refusing to build: --out '/out' does not exist or is not a directory.",
    },
    {
      build: () => new errors.FlatTargetExistsError("/out/a.md", "aidd-dev"),
      name: "FlatTargetExistsError",
      message:
        "Flat build conflict: '/out/a.md' already exists (plugin 'aidd-dev'). Re-run with --force to overwrite.",
    },
    {
      build: () => new errors.MarketplaceOutDirNotEmptyError("/out"),
      name: "MarketplaceOutDirNotEmptyError",
      message:
        "Refusing to build: '/out' is not empty. Re-run with --force to overwrite files this build produces, or choose an empty --out directory.",
    },
    {
      build: () => new errors.UnknownToolCategoryError("editor"),
      name: "UnknownToolCategoryError",
      message: "Unknown category: editor",
    },
    {
      build: () => new errors.MarketplaceSourceKindError("remote"),
      name: "MarketplaceSourceKindError",
      message: "Not a remote source",
    },
    {
      build: () => new errors.MarketplaceSourceKindError("local"),
      name: "MarketplaceSourceKindError",
      message: "Not a local source",
    },
    {
      build: () => new errors.EmptyLocalSourcePathError(),
      name: "EmptyLocalSourcePathError",
      message: "Local source path must not be empty.",
    },
    {
      build: () => new errors.InvalidSetupToolIdError("zed", ["claude", "cursor"]),
      name: "InvalidSetupToolIdError",
      message: 'Invalid tool ID: "zed". Valid IDs: claude, cursor',
    },
    {
      build: () => new errors.UserScopeUnavailableError(),
      name: "UserScopeUnavailableError",
      message:
        "--scope user is not wired for this command yet — no user-scope manifest repository was provided at construction.",
    },
    {
      build: () => new errors.UserScopeIdeToolsError(["vscode", "zed"]),
      name: "UserScopeIdeToolsError",
      message:
        "--scope user installs no project files, so an IDE tool (vscode, zed) has nothing to install at user scope. Drop --ide, or run `aidd setup --ide <ids>` separately at project scope.",
    },
    {
      build: () => new errors.UserScopeUnsupportedAiToolsError(["cursor", "opencode"]),
      name: "UserScopeUnsupportedAiToolsError",
      message:
        "--scope user drives native activation machine-wide, and cursor, opencode declares no user-scope settings this CLI can point at. Drop it from --ai, or run `aidd setup --ai <ids>` separately at project scope.",
    },
    {
      build: () => new errors.UserScopeNoToolsError(),
      name: "UserScopeNoToolsError",
      message:
        "--scope user with no --ai registers the shared source for no tool at all. Pass `--ai <ids>` naming which tool to activate machine-wide.",
    },
    {
      build: () => new errors.UserScopePluginModeError(),
      name: "UserScopePluginModeError",
      message:
        "--scope user has no manifest entry a plugin can be recorded against yet, so --plugins has nothing to enable. Drop --plugins, or run `aidd plugin install` separately at project scope.",
    },
    {
      build: () => new errors.UserScopeFilterUnsupportedError("--plugin", "sync"),
      name: "UserScopeFilterUnsupportedError",
      message:
        "--scope user tracks nothing --plugin can narrow — it names every requested tool, not one plugin or one file. Drop --plugin, or run `aidd sync` at project scope.",
    },
    {
      build: () => new errors.InvalidPluginModeConfigError("bad mode"),
      name: "InvalidPluginModeConfigError",
      message: "bad mode",
    },
    {
      build: () => new errors.InvalidInstallScopeError("global"),
      name: "InvalidInstallScopeError",
      message: "Invalid scope 'global'. Expected 'project' or 'user'.",
    },
    {
      build: () => new errors.UnknownAiToolIdError("zed", ["claude", "cursor"]),
      name: "UnknownAiToolIdError",
      message: "Unknown AI tool: zed. Valid AI tools: claude, cursor",
    },
    {
      build: () => new errors.NativePluginCliError("claude exited 2"),
      name: "NativePluginCliError",
      message: "claude exited 2",
    },
    {
      build: () => new errors.MarketplaceSourceConflictError("name taken"),
      name: "MarketplaceSourceConflictError",
      message: "name taken",
    },
    {
      build: () => new errors.UnreadableBuiltCatalogError("/built/c.json"),
      name: "UnreadableBuiltCatalogError",
      message:
        "Cannot read the marketplace catalog this project just built, at /built/c.json — nothing was registered for it. Run `aidd sync` again once the source is fixed.",
    },
    {
      build: () => new errors.HttpError(500, "https://x"),
      name: "HttpError",
      message: "Unexpected HTTP 500 from https://x",
    },
    {
      build: () => new errors.HttpNotFoundError("https://x"),
      name: "HttpNotFoundError",
      message: "Resource not found (HTTP 404): https://x",
    },
    {
      build: () => new errors.HttpRedirectError("https://x"),
      name: "HttpRedirectError",
      message: "HTTP redirect without location header from https://x",
    },
    {
      build: () => new errors.JsonParseError("/f.json", "Unexpected token"),
      name: "JsonParseError",
      message: "Cannot parse existing JSON at /f.json: Unexpected token",
    },
    {
      build: () => new errors.AuthStorageError("no write"),
      name: "AuthStorageError",
      message: "no write",
    },
    {
      build: () => new errors.GhCliError("gh exited 1"),
      name: "GhCliError",
      message: "gh exited 1",
    },
    {
      build: () => new errors.AssetNotFoundError("schema.json"),
      name: "AssetNotFoundError",
      message: "Bundled asset not found: 'schema.json'",
    },
    {
      build: () => new errors.NoManifestError(),
      name: "NoManifestError",
      message: "No AIDD manifest found. Run `aidd setup` to initialize your project.",
    },
    {
      build: () => new errors.AiddFilesDetectedError(),
      name: "AiddFilesDetectedError",
      message:
        "AIDD files detected but no manifest found.\nRun `aidd setup` to register existing files.",
    },
    {
      build: () => new errors.AlreadyInitializedError(),
      name: "AlreadyInitializedError",
      message: "Already initialized. Use `aidd update` to upgrade.",
    },
    {
      build: () => new errors.InputRequiredError("answer needed"),
      name: "InputRequiredError",
      message: "answer needed",
    },
    {
      build: () => new errors.ToolNotInstalledError("claude"),
      name: "ToolNotInstalledError",
      message: "claude is not installed",
    },
    {
      build: () => new errors.ToolNotInstalledError("cursor", "The target tool"),
      name: "ToolNotInstalledError",
      message: "The target tool 'cursor' is not installed.",
    },
    {
      build: () => new errors.UnknownTelemetrySinkSchemaVersionError(7),
      name: "UnknownTelemetrySinkSchemaVersionError",
      message: "Unknown telemetry sink schema version '7' — refusing to guess its shape.",
    },
    {
      build: () => new errors.OpencodeExportError("export timed out"),
      name: "OpencodeExportError",
      message: "export timed out",
    },
    {
      build: () => new errors.InvalidReportDayError("--from", "yesterday"),
      name: "InvalidReportDayError",
      message: "Invalid --from 'yesterday'. Expected a UTC day, as YYYY-MM-DD.",
    },
    {
      build: () => new errors.InvalidReportSpanError("0", 90),
      name: "InvalidReportSpanError",
      message: "Invalid --days '0'. Expected an integer between 1 and 90.",
    },
    {
      build: () => new errors.UnreadableIdentityFileError("/id.json", "EISDIR"),
      name: "UnreadableIdentityFileError",
      message: "Could not read the identity file at /id.json (EISDIR).",
    },
    {
      build: () =>
        new errors.TelemetryProjectScopeRequiresYesError("telemetry on", ".aidd/config.json"),
      name: "TelemetryProjectScopeRequiresYesError",
      message:
        "telemetry on writes the git-tracked .aidd/config.json, turning telemetry on for everyone who clones. Pass --yes to confirm.",
    },
    {
      build: () => new errors.EmptyDisplayNameError(),
      name: "EmptyDisplayNameError",
      message: "`aidd telemetry identity use --name` needs a non-empty value.",
    },
    {
      build: () => new errors.IdentityRequiredToLinkError(),
      name: "IdentityRequiredToLinkError",
      message: "No identity to link onto yet. Run `aidd telemetry identity use` first.",
    },
    {
      build: () => new errors.EmptyIdentifierError("link"),
      name: "EmptyIdentifierError",
      message: "`aidd telemetry identity link` needs a non-empty value.",
    },
    {
      build: () => new errors.TelemetrySinkUnwritableError("/sink", new Error("EACCES")),
      name: "TelemetrySinkUnwritableError",
      message: "Telemetry sink directory is not writable: /sink (EACCES)",
    },
    {
      build: () => new errors.TelemetrySinkUnwritableError("/sink", "disk full"),
      name: "TelemetrySinkUnwritableError",
      message: "Telemetry sink directory is not writable: /sink (disk full)",
    },
    {
      build: () => new errors.IdentityWriteError("/id.json", new Error("ENOSPC")),
      name: "IdentityWriteError",
      message: "Could not write the identity file at /id.json (ENOSPC).",
    },
    {
      build: () => new errors.IdentityWriteError("/id.json", "EACCES", "remove"),
      name: "IdentityWriteError",
      message: "Could not remove the identity file at /id.json (EACCES).",
    },
  ];

  it.each(catalogue.map((entry) => [entry.name, entry] as const))(
    "%s says exactly what went wrong",
    (_name, entry) => {
      const error = entry.build();
      expect({ name: error.name, message: error.message }).toStrictEqual({
        name: entry.name,
        message: entry.message,
      });
    }
  );

  it("keeps a malformed catalog an invalid plugin manifest, so existing catches still hold", () => {
    expect(new errors.MalformedMarketplaceCatalogError("/c.json", "x", true)).toBeInstanceOf(
      errors.InvalidPluginManifestError
    );
  });

  it("carries the status code and the URL an HTTP failure came from", () => {
    const error = new errors.HttpError(503, "https://x/y");
    expect({ statusCode: error.statusCode, url: error.url }).toStrictEqual({
      statusCode: 503,
      url: "https://x/y",
    });
  });

  it("carries the URL a 404 came from", () => {
    expect(new errors.HttpNotFoundError("https://x/y").url).toBe("https://x/y");
  });
});
