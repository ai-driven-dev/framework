import { describe, expect, it } from "vitest";
import {
  AmbiguousPluginMatchError,
  CategoryMismatchError,
  InteractiveOnlyError,
  InvalidPluginModeConfigError,
  InvalidSetupToolIdError,
  NoMarketplacesRegisteredError,
  TrustDeniedError,
  UserScopeIdeToolsError,
  UserScopeNoToolsError,
  UserScopePluginModeError,
  UserScopeUnavailableError,
  UserScopeUnsupportedAiToolsError,
} from "../../src/orchestration/orchestration.error.js";

describe("AmbiguousPluginMatchError", () => {
  it("says exactly what went wrong", () => {
    const error = new AmbiguousPluginMatchError("aidd-dev", ["a", "b"]);
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "AmbiguousPluginMatchError",
      message: "Plugin 'aidd-dev' matches multiple marketplaces: a, b. Use --from <marketplace>.",
    });
  });

  it("carries its stable code", () => {
    expect(new AmbiguousPluginMatchError("aidd-dev", ["a", "b"]).code).toBe(
      "ambiguous-plugin-match"
    );
  });
});

describe("CategoryMismatchError", () => {
  it("says exactly what went wrong (1)", () => {
    const error = new CategoryMismatchError(["vscode"], "ai", ["claude", "cursor"]);
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "CategoryMismatchError",
      message: "vscode is not an AI tool. Valid AI tools: claude, cursor",
    });
  });

  it("says exactly what went wrong (2)", () => {
    const error = new CategoryMismatchError(["claude", "cursor"], "ide", ["vscode"]);
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "CategoryMismatchError",
      message: "claude, cursor are not IDE tools. Valid IDE tools: vscode",
    });
  });

  it("carries its stable code", () => {
    expect(new CategoryMismatchError(["vscode"], "ai", ["claude", "cursor"]).code).toBe(
      "category-mismatch"
    );
  });
});

describe("InteractiveOnlyError", () => {
  it("says exactly what went wrong", () => {
    const error = new InteractiveOnlyError("aidd setup");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "InteractiveOnlyError",
      message: "'aidd setup' requires an interactive terminal.",
    });
  });

  it("carries its stable code", () => {
    expect(new InteractiveOnlyError("aidd setup").code).toBe("interactive-only");
  });
});

describe("InvalidPluginModeConfigError", () => {
  it("says exactly what went wrong", () => {
    const error = new InvalidPluginModeConfigError("bad mode");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "InvalidPluginModeConfigError",
      message: "bad mode",
    });
  });

  it("carries its stable code", () => {
    expect(new InvalidPluginModeConfigError("bad mode").code).toBe("invalid-plugin-mode-config");
  });
});

describe("InvalidSetupToolIdError", () => {
  it("says exactly what went wrong", () => {
    const error = new InvalidSetupToolIdError("zed", ["claude", "cursor"]);
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "InvalidSetupToolIdError",
      message: 'Invalid tool ID: "zed". Valid IDs: claude, cursor',
    });
  });

  it("carries its stable code", () => {
    expect(new InvalidSetupToolIdError("zed", ["claude", "cursor"]).code).toBe(
      "invalid-setup-tool-id"
    );
  });
});

describe("NoMarketplacesRegisteredError", () => {
  it("says exactly what went wrong", () => {
    const error = new NoMarketplacesRegisteredError();
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "NoMarketplacesRegisteredError",
      message: "No marketplaces registered. Use `aidd marketplace add <name> <source>` first.",
    });
  });

  it("carries its stable code", () => {
    expect(new NoMarketplacesRegisteredError().code).toBe("no-marketplaces-registered");
  });
});

describe("TrustDeniedError", () => {
  it("says exactly what went wrong", () => {
    const error = new TrustDeniedError("aidd");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "TrustDeniedError",
      message: "Trust denied for marketplace 'aidd'. Aborting.",
    });
  });

  it("carries its stable code", () => {
    expect(new TrustDeniedError("aidd").code).toBe("trust-denied");
  });
});

describe("UserScopeIdeToolsError", () => {
  it("says exactly what went wrong", () => {
    const error = new UserScopeIdeToolsError(["vscode", "zed"]);
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "UserScopeIdeToolsError",
      message:
        "--global installs no project files, so an editor (vscode, zed) has nothing to install machine-wide. Drop it from --ide, or run `aidd setup --ide <ids>` separately in the project.",
    });
  });

  it("carries its stable code", () => {
    expect(new UserScopeIdeToolsError(["vscode", "zed"]).code).toBe("user-scope-ide-tools");
  });
});

describe("UserScopeNoToolsError", () => {
  it("says exactly what went wrong", () => {
    const error = new UserScopeNoToolsError();
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "UserScopeNoToolsError",
      message:
        "--global with no --ide registers the shared source for no tool at all. Pass `--ide <ids>` naming which tool to activate machine-wide.",
    });
  });

  it("carries its stable code", () => {
    expect(new UserScopeNoToolsError().code).toBe("user-scope-no-tools");
  });
});

describe("UserScopePluginModeError", () => {
  it("says exactly what went wrong", () => {
    const error = new UserScopePluginModeError();
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "UserScopePluginModeError",
      message:
        "--global cannot ask which plugins to install. Pass --plugins all, recommended, none, or comma-separated names.",
    });
  });

  it("carries its stable code", () => {
    expect(new UserScopePluginModeError().code).toBe("user-scope-plugin-mode");
  });
});

describe("UserScopeUnavailableError", () => {
  it("says exactly what went wrong", () => {
    const error = new UserScopeUnavailableError();
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "UserScopeUnavailableError",
      message:
        "--scope user is not wired for this command yet — no user-scope manifest repository was provided at construction.",
    });
  });

  it("carries its stable code", () => {
    expect(new UserScopeUnavailableError().code).toBe("user-scope-unavailable");
  });
});

describe("UserScopeUnsupportedAiToolsError", () => {
  it("says exactly what went wrong", () => {
    const error = new UserScopeUnsupportedAiToolsError(["cursor", "opencode"]);
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "UserScopeUnsupportedAiToolsError",
      message:
        "--global installs through an IDE's own plugin CLI or its user configuration directory, and neither exists for: cursor, opencode. Drop them from --ide, or run `aidd setup --ide <ids>` in the project instead.",
    });
  });

  it("carries its stable code", () => {
    expect(new UserScopeUnsupportedAiToolsError(["cursor", "opencode"]).code).toBe(
      "user-scope-unsupported-ai-tools"
    );
  });
});
