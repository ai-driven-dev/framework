import { describe, expect, it } from "vitest";
import {
  AmbiguousPluginMatchError,
  InteractiveOnlyError,
  InvalidPluginModeConfigError,
  InvalidSetupToolIdError,
  NoMarketplacesRegisteredError,
  SyncFailedError,
  TrustDeniedError,
  UserScopeFilterUnsupportedError,
  UserScopeIdeToolsError,
  UserScopeNoToolsError,
  UserScopePluginModeError,
  UserScopeUnavailableError,
  UserScopeUnsupportedAiToolsError,
} from "../../src/orchestration/orchestration.error.js";

describe("when several marketplaces match a plugin", () => {
  it("carries its data and says nothing itself", () => {
    const error = new AmbiguousPluginMatchError("aidd-dev", ["a", "b"]);
    expect({
      name: error.name,
      plugin: error.plugin,
      marketplaces: error.marketplaces,
      message: error.message,
    }).toStrictEqual({
      name: "AmbiguousPluginMatchError",
      plugin: "aidd-dev",
      marketplaces: ["a", "b"],
      message: "",
    });
  });

  it("carries its stable code", () => {
    expect(new AmbiguousPluginMatchError("aidd-dev", ["a", "b"]).code).toBe(
      "ambiguous-plugin-match"
    );
  });
});

describe("when a command needs a terminal", () => {
  it("carries its data and says nothing itself", () => {
    const error = new InteractiveOnlyError("aidd setup");
    expect({ name: error.name, action: error.action, message: error.message }).toStrictEqual({
      name: "InteractiveOnlyError",
      action: "aidd setup",
      message: "",
    });
  });

  it("carries its stable code", () => {
    expect(new InteractiveOnlyError("aidd setup").code).toBe("interactive-only");
  });
});

describe("when the plugin mode config is invalid", () => {
  it("carries its data and says nothing itself", () => {
    const error = new InvalidPluginModeConfigError("bad mode");
    expect({ name: error.name, detail: error.detail, message: error.message }).toStrictEqual({
      name: "InvalidPluginModeConfigError",
      detail: "bad mode",
      message: "",
    });
  });

  it("carries its stable code", () => {
    expect(new InvalidPluginModeConfigError("bad mode").code).toBe("invalid-plugin-mode-config");
  });
});

describe("when a setup tool id is invalid", () => {
  it("carries its data and says nothing itself", () => {
    const error = new InvalidSetupToolIdError("zed", ["claude", "cursor"]);
    expect({
      name: error.name,
      id: error.id,
      validIds: error.validIds,
      message: error.message,
    }).toStrictEqual({
      name: "InvalidSetupToolIdError",
      id: "zed",
      validIds: ["claude", "cursor"],
      message: "",
    });
  });

  it("carries its stable code", () => {
    expect(new InvalidSetupToolIdError("zed", ["claude", "cursor"]).code).toBe(
      "invalid-setup-tool-id"
    );
  });
});

describe("when no marketplace is registered", () => {
  it("says nothing itself", () => {
    const error = new NoMarketplacesRegisteredError();
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "NoMarketplacesRegisteredError",
      message: "",
    });
  });

  it("carries its stable code", () => {
    expect(new NoMarketplacesRegisteredError().code).toBe("no-marketplaces-registered");
  });
});

describe("when trust is denied", () => {
  it("carries its data and says nothing itself", () => {
    const error = new TrustDeniedError("aidd");
    expect({
      name: error.name,
      marketplace: error.marketplace,
      message: error.message,
    }).toStrictEqual({
      name: "TrustDeniedError",
      marketplace: "aidd",
      message: "",
    });
  });

  it("carries its stable code", () => {
    expect(new TrustDeniedError("aidd").code).toBe("trust-denied");
  });
});

describe("when an IDE tool is asked at user scope", () => {
  it("carries its data and says nothing itself", () => {
    const error = new UserScopeIdeToolsError(["vscode", "zed"]);
    expect({ name: error.name, ideTools: error.ideTools, message: error.message }).toStrictEqual({
      name: "UserScopeIdeToolsError",
      ideTools: ["vscode", "zed"],
      message: "",
    });
  });

  it("carries its stable code", () => {
    expect(new UserScopeIdeToolsError(["vscode", "zed"]).code).toBe("user-scope-ide-tools");
  });
});

describe("when a user-scope run names no tool", () => {
  it("says nothing itself", () => {
    const error = new UserScopeNoToolsError();
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "UserScopeNoToolsError",
      message: "",
    });
  });

  it("carries its stable code", () => {
    expect(new UserScopeNoToolsError().code).toBe("user-scope-no-tools");
  });
});

describe("when a user-scope run has a bad plugin mode", () => {
  it("says nothing itself", () => {
    const error = new UserScopePluginModeError();
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "UserScopePluginModeError",
      message: "",
    });
  });

  it("carries its stable code", () => {
    expect(new UserScopePluginModeError().code).toBe("user-scope-plugin-mode");
  });
});

describe("when user scope is unavailable", () => {
  it("says nothing itself", () => {
    const error = new UserScopeUnavailableError();
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "UserScopeUnavailableError",
      message: "",
    });
  });

  it("carries its stable code", () => {
    expect(new UserScopeUnavailableError().code).toBe("user-scope-unavailable");
  });
});

describe("when an AI tool has no user scope", () => {
  it("carries its data and says nothing itself", () => {
    const error = new UserScopeUnsupportedAiToolsError(["cursor", "opencode"]);
    expect({ name: error.name, aiTools: error.aiTools, message: error.message }).toStrictEqual({
      name: "UserScopeUnsupportedAiToolsError",
      aiTools: ["cursor", "opencode"],
      message: "",
    });
  });

  it("carries its stable code", () => {
    expect(new UserScopeUnsupportedAiToolsError(["cursor", "opencode"]).code).toBe(
      "user-scope-unsupported-ai-tools"
    );
  });
});

describe("when a sync fails", () => {
  it("carries its data and says nothing itself", () => {
    const error = new SyncFailedError([
      { scope: "claude", error: "x" },
      { scope: "codex", error: "y" },
    ]);
    expect({ name: error.name, errors: error.errors, message: error.message }).toStrictEqual({
      name: "SyncFailedError",
      errors: [
        { scope: "claude", error: "x" },
        { scope: "codex", error: "y" },
      ],
      message: "",
    });
  });

  it("carries its stable code", () => {
    expect(
      new SyncFailedError([
        { scope: "claude", error: "x" },
        { scope: "codex", error: "y" },
      ]).code
    ).toBe("sync-failed");
  });
});

describe("when a user-scope run is given a filter", () => {
  it("carries its data and says nothing itself", () => {
    const error = new UserScopeFilterUnsupportedError("--plugin", "sync");
    expect({
      name: error.name,
      flag: error.flag,
      command: error.command,
      message: error.message,
    }).toStrictEqual({
      name: "UserScopeFilterUnsupportedError",
      flag: "--plugin",
      command: "sync",
      message: "",
    });
  });

  it("carries its stable code", () => {
    expect(new UserScopeFilterUnsupportedError("--plugin", "sync").code).toBe(
      "user-scope-filter-unsupported"
    );
  });
});
