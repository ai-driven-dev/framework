import { describe, expect, it } from "vitest";
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
} from "../../src/orchestration/orchestration.error.js";

describe("AmbiguousPluginMatchError", () => {
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

describe("CategoryMismatchError", () => {
  it("carries its data and says nothing itself", () => {
    const error = new CategoryMismatchError(["vscode"], "ai", ["claude", "cursor"]);
    expect({
      name: error.name,
      wrong: error.wrong,
      category: error.category,
      validToolIds: error.validToolIds,
      message: error.message,
    }).toStrictEqual({
      name: "CategoryMismatchError",
      wrong: ["vscode"],
      category: "ai",
      validToolIds: ["claude", "cursor"],
      message: "",
    });
  });

  it("carries its data and says nothing itself", () => {
    const error = new CategoryMismatchError(["claude", "cursor"], "ide", ["vscode"]);
    expect({
      name: error.name,
      wrong: error.wrong,
      category: error.category,
      validToolIds: error.validToolIds,
      message: error.message,
    }).toStrictEqual({
      name: "CategoryMismatchError",
      wrong: ["claude", "cursor"],
      category: "ide",
      validToolIds: ["vscode"],
      message: "",
    });
  });

  it("carries its stable code", () => {
    expect(new CategoryMismatchError(["vscode"], "ai", ["claude", "cursor"]).code).toBe(
      "category-mismatch"
    );
  });
});

describe("InteractiveOnlyError", () => {
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

describe("InvalidPluginModeConfigError", () => {
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

describe("InvalidSetupToolIdError", () => {
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

describe("NoMarketplacesRegisteredError", () => {
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

describe("TrustDeniedError", () => {
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

describe("UserScopeIdeToolsError", () => {
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

describe("UserScopeNoToolsError", () => {
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

describe("UserScopePluginModeError", () => {
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

describe("UserScopeUnavailableError", () => {
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

describe("UserScopeUnsupportedAiToolsError", () => {
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

describe("SyncFailedError", () => {
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

describe("UnknownAiToolIdError", () => {
  it("carries its data and says nothing itself", () => {
    const error = new UnknownAiToolIdError("zed", ["claude", "cursor"]);
    expect({
      name: error.name,
      tool: error.tool,
      validIds: error.validIds,
      message: error.message,
    }).toStrictEqual({
      name: "UnknownAiToolIdError",
      tool: "zed",
      validIds: ["claude", "cursor"],
      message: "",
    });
  });

  it("carries its stable code", () => {
    expect(new UnknownAiToolIdError("zed", ["claude", "cursor"]).code).toBe("unknown-ai-tool-id");
  });
});

describe("UserScopeFilterUnsupportedError", () => {
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
