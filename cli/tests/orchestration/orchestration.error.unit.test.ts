import { describe, expect, it } from "vitest";
import {
  AmbiguousPluginMatchError,
  InteractiveOnlyError,
  NoMarketplacesRegisteredError,
  SyncFailedError,
  TrustDeniedError,
  UserScopeFilterUnsupportedError,
  UserScopeUnavailableError,
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
